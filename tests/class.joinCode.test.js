const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const ClassMember = require("../models/ClassMember.model.js");

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

describe("POST /api/v1/classes/:classId/join-code/regenerate", () => {
  it("returns 403 for a non-owner teacher", async () => {
    const owner = await registerAndLogin({
      email: "joincode-owner-1@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "joincode-other-1@example.com",
      role: "teacher",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "Trigonometry", subject: "Math" });
    const classId = createRes.body.data.class.id;

    const res = await otherTeacher.post(
      `/api/v1/classes/${classId}/join-code/regenerate`,
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when the class is archived", async () => {
    const teacher = await registerAndLogin({
      email: "joincode-owner-2@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Linguistics", subject: "Linguistics" });
    const classId = createRes.body.data.class.id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.post(
      `/api/v1/classes/${classId}/join-code/regenerate`,
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({
      email: "joincode-owner-3@example.com",
      role: "teacher",
    });

    const res = await teacher.post(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/join-code/regenerate`,
    );
    expect(res.status).toBe(404);
  });

  it("generates a new code, invalidates the old one, and leaves membership untouched", async () => {
    const teacher = await registerAndLogin({
      email: "joincode-owner-4@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "joincode-student-4@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Astronomy", subject: "Astronomy" });
    const classId = createRes.body.data.class.id;
    const oldCode = createRes.body.data.class.code;

    // Get the student into active membership before regenerating, so we
    // can prove the regeneration doesn't disturb it (PRD § 7.3).
    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: oldCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

    const regenRes = await teacher.post(
      `/api/v1/classes/${classId}/join-code/regenerate`,
    );
    expect(regenRes.status).toBe(200);
    const newCode = regenRes.body.data.class.code;
    expect(newCode).not.toBe(oldCode);

    // Old code no longer resolves to any class.
    const staleJoinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: oldCode });
    expect(staleJoinRes.status).toBe(404);

    // New code does resolve and can be joined by a different student.
    const secondStudent = await registerAndLogin({
      email: "joincode-student-5@example.com",
      role: "student",
    });
    const newJoinRes = await secondStudent
      .post("/api/v1/classes/join")
      .send({ code: newCode });
    expect(newJoinRes.status).toBe(201);

    // Existing active membership survived the regeneration untouched.
    const membership = await ClassMember.findOne({
      classId,
      status: "active",
    });
    expect(membership).not.toBeNull();
  });

  it("produces a different code on each successive regeneration", async () => {
    const teacher = await registerAndLogin({
      email: "joincode-owner-6@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Robotics", subject: "Engineering" });
    const classId = createRes.body.data.class.id;
    const firstCode = createRes.body.data.class.code;

    const firstRegen = await teacher.post(
      `/api/v1/classes/${classId}/join-code/regenerate`,
    );
    const secondCode = firstRegen.body.data.class.code;

    const secondRegen = await teacher.post(
      `/api/v1/classes/${classId}/join-code/regenerate`,
    );
    const thirdCode = secondRegen.body.data.class.code;

    expect(new Set([firstCode, secondCode, thirdCode]).size).toBe(3);
  });
});
