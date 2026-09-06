import mongoose from "mongoose";
import {MongoMemoryServer} from "mongodb-memory-server";
import ClassMember from "../models/ClassMember.model.js";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Ensure indexes are built before the uniqueness test relies on them.
  await ClassMember.init();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await ClassMember.deleteMany({});
});

describe("ClassMember model", () => {
  it("rejects a duplicate (classId, userId) insert", async () => {
    const classId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    await ClassMember.create({ classId, userId });

    await expect(ClassMember.create({ classId, userId })).rejects.toThrow();
  });

  it("has no role field (C2)", () => {
    expect(ClassMember.schema.path("role")).toBeUndefined();
  });

  it("defaults status to active", async () => {
    const doc = await ClassMember.create({
      classId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
    });

    expect(doc.status).toBe("active");
  });

  it("only accepts lowercase status values (C3)", async () => {
    const doc = new ClassMember({
      classId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      status: "ACTIVE",
    });

    await expect(doc.validate()).rejects.toThrow();
  });
});
