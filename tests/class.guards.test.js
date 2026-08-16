const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Class = require("../models/Class.model.js");
const ClassMember = require("../models/ClassMember.model.js");
const User = require("../models/User.model.js");
const {
  loadClassOrThrow,
  assertActiveMember,
  assertClassOwner,
  assertClassWritable,
} = require("../services/guards/class.guards.js");
const { ForbiddenError, NotFoundError } = require("../utils/error/errors.js");

let mongod;
let owner;
let student;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await ClassMember.init();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  owner = await User.create({
    name: "Owner Teacher",
    email: `owner-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "teacher",
  });

  student = await User.create({
    name: "Some Student",
    email: `student-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "student",
  });
});

afterEach(async () => {
  await Promise.all([
    Class.deleteMany({}),
    ClassMember.deleteMany({}),
    User.deleteMany({}),
  ]);
});

async function createClass(overrides = {}) {
  return Class.create({
    name: "Guarded Class",
    joinCode: await Class.generateUniqueCode(),
    owner: owner._id,
    ...overrides,
  });
}

describe("loadClassOrThrow", () => {
  it("returns the class for an id that resolves", async () => {
    const classDoc = await createClass();

    const loaded = await loadClassOrThrow(classDoc._id);

    expect(loaded._id.toString()).toBe(classDoc._id.toString());
  });

  it("throws NotFoundError for an id that resolves to nothing", async () => {
    const missingId = new mongoose.Types.ObjectId();

    await expect(loadClassOrThrow(missingId)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError rather than a cast error for a malformed id", async () => {
    await expect(loadClassOrThrow("not-an-object-id")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("populates the owner on request", async () => {
    const classDoc = await createClass();

    const loaded = await loadClassOrThrow(classDoc._id, {
      populateOwner: true,
    });

    expect(loaded.owner.name).toBe("Owner Teacher");
  });
});

describe("assertClassOwner", () => {
  // The live fail-open risk: owner is a raw ObjectId on most reads and a
  // populated User subdocument on the class-detail read. Both must compare
  // identically, in both directions.
  it("accepts the owner when owner is a raw ObjectId", async () => {
    const classDoc = await createClass();

    expect(() => assertClassOwner(classDoc, owner._id)).not.toThrow();
  });

  it("accepts the owner when owner is a populated User subdocument", async () => {
    const classDoc = await createClass();
    const populated = await Class.findById(classDoc._id).populate(
      "owner",
      "name email avatar role",
    );

    expect(() => assertClassOwner(populated, owner._id)).not.toThrow();
  });

  it("rejects a non-owner when owner is a raw ObjectId", async () => {
    const classDoc = await createClass();

    expect(() => assertClassOwner(classDoc, student._id)).toThrow(
      ForbiddenError,
    );
  });

  it("rejects a non-owner when owner is a populated User subdocument", async () => {
    const classDoc = await createClass();
    const populated = await Class.findById(classDoc._id).populate(
      "owner",
      "name email avatar role",
    );

    expect(() => assertClassOwner(populated, student._id)).toThrow(
      ForbiddenError,
    );
  });

  it("compares identically on a lean class document", async () => {
    const classDoc = await createClass();
    const lean = await Class.findById(classDoc._id).lean();

    expect(() => assertClassOwner(lean, owner._id)).not.toThrow();
    expect(() => assertClassOwner(lean, student._id)).toThrow(ForbiddenError);
  });

  it("uses the caller-supplied message when one is given", async () => {
    const classDoc = await createClass();

    expect(() =>
      assertClassOwner(classDoc, student._id, {
        message: "Only the class teacher can approve requests",
      }),
    ).toThrow("Only the class teacher can approve requests");
  });
});

describe("assertActiveMember", () => {
  it("authorizes the owner with no ClassMember row in existence (C2)", async () => {
    const classDoc = await createClass();

    await expect(ClassMember.countDocuments({})).resolves.toBe(0);

    const result = await assertActiveMember(classDoc, owner._id);

    expect(result.isOwner).toBe(true);
    expect(result.membership).toBeNull();
  });

  it("authorizes the owner when the class document has a populated owner", async () => {
    const classDoc = await createClass();
    const populated = await Class.findById(classDoc._id).populate(
      "owner",
      "name email avatar role",
    );

    const result = await assertActiveMember(populated, owner._id);

    expect(result.isOwner).toBe(true);
  });

  it("authorizes a student holding an active membership", async () => {
    const classDoc = await createClass();
    await ClassMember.create({
      classId: classDoc._id,
      userId: student._id,
      status: "active",
    });

    const result = await assertActiveMember(classDoc, student._id);

    expect(result.isOwner).toBe(false);
    expect(result.membership.status).toBe("active");
  });

  it("rejects a user with no membership row at all", async () => {
    const classDoc = await createClass();

    await expect(assertActiveMember(classDoc, student._id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  // I8: leave and remove preserve the row; they must not preserve the access.
  it("rejects a member whose status is left", async () => {
    const classDoc = await createClass();
    await ClassMember.create({
      classId: classDoc._id,
      userId: student._id,
      status: "left",
    });

    await expect(assertActiveMember(classDoc, student._id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("rejects a member whose status is removed", async () => {
    const classDoc = await createClass();
    await ClassMember.create({
      classId: classDoc._id,
      userId: student._id,
      status: "removed",
    });

    await expect(assertActiveMember(classDoc, student._id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("does not read membership from a different class", async () => {
    const classDoc = await createClass();
    const otherClass = await createClass({ name: "Other Class" });
    await ClassMember.create({
      classId: otherClass._id,
      userId: student._id,
      status: "active",
    });

    await expect(assertActiveMember(classDoc, student._id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("authorizes an active member of an archived class (C5 — reads stay open)", async () => {
    const classDoc = await createClass({ status: "archived" });
    await ClassMember.create({
      classId: classDoc._id,
      userId: student._id,
      status: "active",
    });

    const result = await assertActiveMember(classDoc, student._id);

    expect(result.isOwner).toBe(false);
  });

  it("uses the caller-supplied message when one is given", async () => {
    const classDoc = await createClass();

    await expect(
      assertActiveMember(classDoc, student._id, {
        message: "You are not a member of this class",
      }),
    ).rejects.toThrow("You are not a member of this class");
  });
});

describe("assertClassWritable", () => {
  it("passes on an active class", async () => {
    const classDoc = await createClass();

    expect(() => assertClassWritable(classDoc)).not.toThrow();
  });

  it("throws ForbiddenError on an archived class (C6)", async () => {
    const classDoc = await createClass({ status: "archived" });

    expect(() => assertClassWritable(classDoc)).toThrow(ForbiddenError);
  });

  // The guard is a plain status check and knows nothing about which
  // operations are exempt — archive/restore and join-request rejection are
  // exempt because their callers do not invoke it, not because it lets them
  // through. Anything that reaches it and is archived gets a 403.
  it("knows nothing about exempt operations", async () => {
    const classDoc = await createClass({ status: "archived" });

    expect(assertClassWritable.length).toBe(1);
    expect(() => assertClassWritable(classDoc)).toThrow(ForbiddenError);
  });
});
