const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ClassMember = require("../models/ClassMember.model.js");
const {
  buildPlan,
  applyPlan,
  backupCollections,
  verifyMigration,
  CLASSES,
  CLASS_MEMBERS,
  USERS,
} = require("../scripts/migrate-classmember.js");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // § 6.2 step 1: the model and its indexes exist before the script runs.
  await ClassMember.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const db = mongoose.connection.db;
  await db.collection(CLASSES).deleteMany({});
  await db.collection(CLASS_MEMBERS).deleteMany({});
  await db.collection(USERS).deleteMany({});
});

/**
 * Seeds two users, one class owned by userA with userA mimicking the old
 * pre-save hook (role: "teacher", inserted as a member) and userB as a
 * genuine student member.
 */
async function seedBasicClass(db) {
  const ownerId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();

  await db.collection(USERS).insertMany([
    { _id: ownerId, name: "Owner Teacher", role: "teacher" },
    { _id: studentId, name: "Student One", role: "student" },
  ]);

  const classId = new mongoose.Types.ObjectId();
  const createdAt = new Date("2026-01-01T00:00:00Z");

  await db.collection(CLASSES).insertOne({
    _id: classId,
    name: "Algebra I",
    owner: ownerId,
    status: "active",
    createdAt,
    members: [
      { user: ownerId, role: "teacher", joinedAt: createdAt },
      { user: studentId, role: "student", joinedAt: new Date("2026-01-05T00:00:00Z") },
    ],
  });

  return { ownerId, studentId, classId };
}

describe("migrate-classmember", () => {
  it("plans one ClassMember row per class, skipping the owner", async () => {
    const db = mongoose.connection.db;
    const { studentId, classId } = await seedBasicClass(db);

    const plan = await buildPlan(db);

    expect(plan.operations).toHaveLength(1);
    expect(String(plan.operations[0].classId)).toBe(String(classId));
    expect(String(plan.operations[0].userId)).toBe(String(studentId));
    expect(plan.skippedOwners).toHaveLength(1);
    expect(plan.orphans).toHaveLength(0);
  });

  it("skips a member whose user no longer resolves (orphan)", async () => {
    const db = mongoose.connection.db;
    const ownerId = new mongoose.Types.ObjectId();
    const ghostUserId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    await db.collection(USERS).insertOne({ _id: ownerId, name: "Owner", role: "teacher" });
    await db.collection(CLASSES).insertOne({
      _id: classId,
      name: "Ghost Class",
      owner: ownerId,
      status: "active",
      createdAt: new Date(),
      members: [
        { user: ownerId, role: "teacher" },
        { user: ghostUserId, role: "student" },
      ],
    });

    const plan = await buildPlan(db);

    expect(plan.operations).toHaveLength(0);
    expect(plan.orphans).toHaveLength(1);
    expect(String(plan.orphans[0].userId)).toBe(String(ghostUserId));
  });

  it("run then verify passes all six checks, and is idempotent on re-run", async () => {
    const db = mongoose.connection.db;
    await seedBasicClass(db);

    const plan = await buildPlan(db);
    const first = await applyPlan(db, plan);
    expect(first.inserted).toBe(1);
    expect(first.updated).toBe(0);

    const firstVerify = await verifyMigration(db);
    expect(firstVerify.passed).toBe(true);
    for (const check of firstVerify.checks) {
      expect(check.passed).toBe(true);
    }

    const countAfterFirst = await db.collection(CLASS_MEMBERS).countDocuments();

    // Re-run: idempotent, no duplicate rows.
    const plan2 = await buildPlan(db);
    const second = await applyPlan(db, plan2);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(1);

    const countAfterSecond = await db.collection(CLASS_MEMBERS).countDocuments();
    expect(countAfterSecond).toBe(countAfterFirst);

    const secondVerify = await verifyMigration(db);
    expect(secondVerify.passed).toBe(true);
  });

  it("verify fails count parity when a non-owner row is missing", async () => {
    const db = mongoose.connection.db;
    const { studentId } = await seedBasicClass(db);
    // Migrate nothing — the student row is missing from classmembers.
    void studentId;

    const result = await verifyMigration(db);

    expect(result.passed).toBe(false);
    const parity = result.checks.find((c) => c.name === "count parity");
    expect(parity.passed).toBe(false);
    expect(parity.details.failures).toHaveLength(1);
  });

  it("verify fails the owner-row check if an owner is migrated by mistake", async () => {
    const db = mongoose.connection.db;
    const { ownerId, studentId, classId } = await seedBasicClass(db);

    // Deliberately insert a bad row for the owner to prove the check catches it.
    await db.collection(CLASS_MEMBERS).insertOne({
      classId,
      userId: ownerId,
      status: "active",
      joinedAt: new Date(),
    });
    await db.collection(CLASS_MEMBERS).insertOne({
      classId,
      userId: studentId,
      status: "active",
      joinedAt: new Date(),
    });

    const result = await verifyMigration(db);

    expect(result.passed).toBe(false);
    const ownerCheck = result.checks.find((c) => c.name === "no owner rows");
    expect(ownerCheck.passed).toBe(false);
    expect(ownerCheck.details.offenders).toHaveLength(1);
  });

  it("backup writes and round-trips a readable JSON dump", async () => {
    const db = mongoose.connection.db;
    await seedBasicClass(db);

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "classmember-backup-"));
    const result = await backupCollections(db, outDir);

    expect(result.written[CLASSES].count).toBe(1);
    expect(fs.existsSync(result.written[CLASSES].file)).toBe(true);

    const dumped = JSON.parse(fs.readFileSync(result.written[CLASSES].file, "utf8"));
    expect(dumped).toHaveLength(1);

    fs.rmSync(outDir, { recursive: true, force: true });
  });
});
