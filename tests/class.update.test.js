const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const Class = require("../models/Class.model.js");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});

async function registerAndLogin(overrides) {
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/auth/register").send({
    name: "Test User",
    password: "Passw0rd!",
    ...overrides,
  });
  expect(res.status).toBe(201);
  return agent;
}

// No archive endpoint exists yet (item 11 lands in the next task), so this
// file reaches the archived state with a direct write, mirroring the
// precedent in class.archive.test.js.
async function archiveClass(classId) {
  await Class.updateOne({ _id: classId }, { $set: { status: "archived" } });
}

describe("PATCH /api/v1/classes/:classId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .patch(`/api/v1/classes/${new mongoose.Types.ObjectId()}`)
      .send({ name: "New Name" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a student", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-1@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "update-student-1@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Algebra", subject: "Math" });
    const classId = createRes.body.data.class.id;

    const res = await student
      .patch(`/api/v1/classes/${classId}`)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for a teacher who does not own the class", async () => {
    const owner = await registerAndLogin({
      email: "update-owner-2@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "update-other-teacher@example.com",
      role: "teacher",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "Biology", subject: "Science" });
    const classId = createRes.body.data.class.id;

    const res = await otherTeacher
      .patch(`/api/v1/classes/${classId}`)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the class is archived", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-archived@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Archived Chem", subject: "Chemistry" });
    const classId = createRes.body.data.class.id;

    await archiveClass(classId);

    const res = await teacher
      .patch(`/api/v1/classes/${classId}`)
      .send({ name: "New Name" });
    expect(res.status).toBe(403);
  });

  it("updates fields for the owner on an active class and persists them", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-3@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Physics", subject: "Science" });
    const classId = createRes.body.data.class.id;

    const res = await teacher.patch(`/api/v1/classes/${classId}`).send({
      name: "Physics II",
      description: "Advanced mechanics",
      college: "MIT",
      semester: "Fall 2026",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.class.name).toBe("Physics II");
    expect(res.body.data.class.description).toBe("Advanced mechanics");
    expect(res.body.data.class.college).toBe("MIT");
    expect(res.body.data.class.semester).toBe("Fall 2026");

    const persisted = await Class.findById(classId).lean();
    expect(persisted.name).toBe("Physics II");
    expect(persisted.description).toBe("Advanced mechanics");
  });

  it("returns 404 for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-4@example.com",
      role: "teacher",
    });

    const res = await teacher
      .patch(`/api/v1/classes/${new mongoose.Types.ObjectId()}`)
      .send({ name: "New Name" });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed classId, not a 500", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-5@example.com",
      role: "teacher",
    });

    const res = await teacher
      .patch("/api/v1/classes/not-a-valid-id")
      .send({ name: "New Name" });
    expect(res.status).toBe(404);
  });

  it("returns 422 when name exceeds 100 characters", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-6@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Geometry", subject: "Math" });
    const classId = createRes.body.data.class.id;

    const res = await teacher
      .patch(`/api/v1/classes/${classId}`)
      .send({ name: "x".repeat(101) });
    expect(res.status).toBe(422);
  });

  it("returns 422 for an empty body", async () => {
    const teacher = await registerAndLogin({
      email: "update-owner-7@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Calculus", subject: "Math" });
    const classId = createRes.body.data.class.id;

    const res = await teacher.patch(`/api/v1/classes/${classId}`).send({});
    expect(res.status).toBe(422);
  });
});
