/**
 * Migrate embedded Class.members[] into the first-class ClassMember collection.
 *
 * Deliberately reads the raw `classes` collection rather than the Class model:
 * once the schema drops `members`, Mongoose would strip the very field this
 * script exists to read. Raw access keeps the script runnable afterwards.
 *
 * Usage (from server/):
 *   node scripts/migrate-classmember.js --dry-run   # default; plans, writes nothing
 *   node scripts/migrate-classmember.js --backup    # JSON dump before mutating
 *   node scripts/migrate-classmember.js --run
 *   node scripts/migrate-classmember.js --verify    # exits 1 on any failed check
 *
 * Writes are upserts keyed on (classId, userId), so the script is idempotent
 * and safe to re-run after a partial failure.
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const CLASSES = "classes";
const CLASS_MEMBERS = "classmembers";
const USERS = "users";

const id = (value) => (value == null ? null : String(value));

/**
 * Read every class and decide what should exist in `classmembers`.
 * Pure inspection — performs no writes.
 */
async function buildPlan(db) {
  const classes = await db.collection(CLASSES).find({}).toArray();
  const userIds = new Set(
    (
      await db
        .collection(USERS)
        .find({}, { projection: { _id: 1 } })
        .toArray()
    ).map((u) => id(u._id)),
  );

  const operations = [];
  const skippedOwners = [];
  const orphans = [];
  const classSummaries = [];

  for (const cls of classes) {
    const hasEmbedded = Array.isArray(cls.members);
    const embedded = hasEmbedded ? cls.members : [];
    const ownerId = id(cls.owner);

    let ownerSkips = 0;
    let orphanSkips = 0;
    let planned = 0;

    for (const member of embedded) {
      const userId = id(member.user);

      if (userId == null) {
        orphanSkips += 1;
        orphans.push({
          classId: id(cls._id),
          userId,
          reason: "missing user ref",
        });
        continue;
      }

      // C2: the owner is never a ClassMember. The old pre-save hook inserted the
      // creator as a `role: "teacher"` member on every class, so this normally
      // fires exactly once per class.
      if (ownerId != null && userId === ownerId) {
        ownerSkips += 1;
        skippedOwners.push({ classId: id(cls._id), userId });
        continue;
      }

      if (!userIds.has(userId)) {
        orphanSkips += 1;
        orphans.push({
          classId: id(cls._id),
          userId,
          reason: "user not found",
        });
        continue;
      }

      operations.push({
        classId: cls._id,
        userId: member.user,
        joinedAt: member.joinedAt || cls.createdAt || new Date(),
      });
      planned += 1;
    }

    classSummaries.push({
      classId: id(cls._id),
      hasEmbedded,
      embeddedCount: embedded.length,
      ownerSkips,
      orphanSkips,
      expected: planned,
    });
  }

  return { operations, skippedOwners, orphans, classSummaries };
}

/**
 * Apply a plan. Upsert-keyed on (classId, userId) so re-running is a no-op.
 */
async function applyPlan(db, plan) {
  const collection = db.collection(CLASS_MEMBERS);
  let inserted = 0;
  let updated = 0;

  for (const op of plan.operations) {
    const now = new Date();
    const result = await collection.updateOne(
      { classId: op.classId, userId: op.userId },
      {
        $set: { status: "active", updatedAt: now },
        $setOnInsert: { joinedAt: op.joinedAt, createdAt: now },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) inserted += 1;
    else updated += 1;
  }

  return { inserted, updated };
}

/**
 * JSON dump of the collections this migration touches. Stands in for mongodump,
 * which is not installed in this environment.
 */
async function backupCollections(db, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  const written = {};

  for (const name of [CLASSES, CLASS_MEMBERS]) {
    const docs = await db.collection(name).find({}).toArray();
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2));

    // Read back so the backup is proven readable, not merely written.
    const roundTripped = JSON.parse(fs.readFileSync(file, "utf8"));
    if (roundTripped.length !== docs.length) {
      throw new Error(
        `Backup verification failed for ${name}: wrote ${docs.length}, read back ${roundTripped.length}`,
      );
    }

    written[name] = { count: docs.length, file };
  }

  return { outDir, written };
}

/**
 * The six checks from Implementation.md § 6.4. Every one must pass.
 */
async function verifyMigration(db) {
  const classes = await db.collection(CLASSES).find({}).toArray();
  const members = await db.collection(CLASS_MEMBERS).find({}).toArray();
  const users = await db
    .collection(USERS)
    .find({}, { projection: { _id: 1 } })
    .toArray();

  const classById = new Map(classes.map((c) => [id(c._id), c]));
  const userIds = new Set(users.map((u) => id(u._id)));
  const checks = [];

  const membersByClass = new Map();
  for (const m of members) {
    const key = id(m.classId);
    if (!membersByClass.has(key)) membersByClass.set(key, []);
    membersByClass.get(key).push(m);
  }

  // 1. Count parity — assert the skipped-owner count rather than assuming 1.
  //    Classes with no embedded array (created after the cutover) are exempt.
  const parityFailures = [];
  let parityChecked = 0;
  for (const cls of classes) {
    if (!Array.isArray(cls.members)) continue;
    parityChecked += 1;

    const ownerId = id(cls.owner);
    const ownerRows = cls.members.filter((m) => id(m.user) === ownerId).length;
    const orphanRows = cls.members.filter((m) => {
      const uid = id(m.user);
      return uid !== ownerId && (uid == null || !userIds.has(uid));
    }).length;

    const expected = cls.members.length - ownerRows - orphanRows;
    const actual = (membersByClass.get(id(cls._id)) || []).length;

    if (actual !== expected) {
      parityFailures.push({
        classId: id(cls._id),
        embedded: cls.members.length,
        ownerRowsSkipped: ownerRows,
        orphanRowsSkipped: orphanRows,
        expected,
        actual,
      });
    }
  }
  checks.push({
    name: "count parity",
    passed: parityFailures.length === 0,
    details: { classesChecked: parityChecked, failures: parityFailures },
  });

  // 2. No owner rows (C2).
  const ownerRows = members.filter((m) => {
    const cls = classById.get(id(m.classId));
    return cls && id(cls.owner) === id(m.userId);
  });
  checks.push({
    name: "no owner rows",
    passed: ownerRows.length === 0,
    details: {
      offenders: ownerRows.map((m) => ({
        classId: id(m.classId),
        userId: id(m.userId),
      })),
    },
  });

  // 3. Uniqueness — the index must exist, and no (classId, userId) may repeat.
  const indexes = await db.collection(CLASS_MEMBERS).indexes();
  const uniqueIndex = indexes.find(
    (ix) => ix.unique && ix.key && ix.key.classId === 1 && ix.key.userId === 1,
  );
  const seen = new Map();
  const duplicates = [];
  for (const m of members) {
    const key = `${id(m.classId)}:${id(m.userId)}`;
    if (seen.has(key)) duplicates.push(key);
    else seen.set(key, true);
  }
  checks.push({
    name: "uniqueness",
    passed: Boolean(uniqueIndex) && duplicates.length === 0,
    details: { uniqueIndexPresent: Boolean(uniqueIndex), duplicates },
  });

  // 4. Every row that came from an embedded array is active.
  const embeddedPairs = new Set();
  for (const cls of classes) {
    if (!Array.isArray(cls.members)) continue;
    for (const m of cls.members) {
      embeddedPairs.add(`${id(cls._id)}:${id(m.user)}`);
    }
  }
  const notActive = members.filter(
    (m) =>
      embeddedPairs.has(`${id(m.classId)}:${id(m.userId)}`) &&
      m.status !== "active",
  );
  checks.push({
    name: "status active",
    passed: notActive.length === 0,
    details: {
      offenders: notActive.map((m) => ({
        classId: id(m.classId),
        userId: id(m.userId),
        status: m.status,
      })),
    },
  });

  // 5. No orphans.
  const orphanRows = members.filter(
    (m) => !classById.has(id(m.classId)) || !userIds.has(id(m.userId)),
  );
  checks.push({
    name: "no orphans",
    passed: orphanRows.length === 0,
    details: {
      offenders: orphanRows.map((m) => ({
        classId: id(m.classId),
        userId: id(m.userId),
        classMissing: !classById.has(id(m.classId)),
        userMissing: !userIds.has(id(m.userId)),
      })),
    },
  });

  // 6. Spot check up to three classes: the migrated roster must equal the
  //    embedded array minus the owner and minus orphans.
  const spotFailures = [];
  const spotSample = classes
    .filter((c) => Array.isArray(c.members))
    .slice(0, 3);
  for (const cls of spotSample) {
    const ownerId = id(cls.owner);
    const expected = cls.members
      .map((m) => id(m.user))
      .filter((uid) => uid !== ownerId && uid != null && userIds.has(uid))
      .sort();
    const actual = (membersByClass.get(id(cls._id)) || [])
      .filter((m) => m.status === "active")
      .map((m) => id(m.userId))
      .sort();

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      spotFailures.push({ classId: id(cls._id), expected, actual });
    }
  }
  checks.push({
    name: "roster spot check",
    passed: spotFailures.length === 0,
    details: { classesChecked: spotSample.length, failures: spotFailures },
  });

  return { passed: checks.every((c) => c.passed), checks };
}

function printPlan(plan) {
  console.log(`Classes inspected:        ${plan.classSummaries.length}`);
  console.log(`ClassMember rows planned: ${plan.operations.length}`);
  console.log(`Owner rows skipped (C2):  ${plan.skippedOwners.length}`);
  console.log(`Orphan rows skipped:      ${plan.orphans.length}`);

  if (plan.orphans.length > 0) {
    console.log("\nOrphans:");
    for (const o of plan.orphans) {
      console.log(`  class ${o.classId} user ${o.userId} — ${o.reason}`);
    }
  }

  console.log("\nPer class:");
  for (const s of plan.classSummaries) {
    console.log(
      `  ${s.classId}  embedded=${s.hasEmbedded ? s.embeddedCount : "n/a"}  ` +
        `ownerSkips=${s.ownerSkips}  orphanSkips=${s.orphanSkips}  planned=${s.expected}`,
    );
  }
}

function printVerification(result) {
  for (const check of result.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.name}`);
    if (!check.passed) {
      console.log(`      ${JSON.stringify(check.details, null, 2)}`);
    }
  }
  console.log(
    `\n${result.passed ? "All six checks passed." : "Verification FAILED."}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--run")
    ? "run"
    : args.includes("--verify")
      ? "verify"
      : args.includes("--backup")
        ? "backup"
        : "dry-run";

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Connected to database: ${db.databaseName}\nMode: ${mode}\n`);

  let exitCode = 0;

  try {
    if (mode === "backup") {
      const outDir = path.join(
        scriptDirectory,
        "..",
        "backups",
        `pre-classmember-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      );
      const result = await backupCollections(db, outDir);
      console.log(`Backup written to ${result.outDir}`);
      for (const [name, info] of Object.entries(result.written)) {
        console.log(`  ${name}: ${info.count} documents`);
      }
    } else if (mode === "verify") {
      const result = await verifyMigration(db);
      printVerification(result);
      if (!result.passed) exitCode = 1;
    } else {
      const plan = await buildPlan(db);
      printPlan(plan);

      if (mode === "run") {
        const result = await applyPlan(db, plan);
        console.log(
          `\nApplied. Inserted ${result.inserted}, updated ${result.updated}.`,
        );
        console.log("Run with --verify next.");
      } else {
        console.log("\nDry run — nothing written. Re-run with --run to apply.");
      }
    }
  } catch (error) {
    console.error("Migration error:", error.message);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }

  process.exit(exitCode);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export {
  buildPlan,
  applyPlan,
  backupCollections,
  verifyMigration,
  CLASSES,
  CLASS_MEMBERS,
  USERS,
};
