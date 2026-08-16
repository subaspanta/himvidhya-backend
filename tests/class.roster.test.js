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

describe("GET /api/v1/classes/:classId/members", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/members`,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-member", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-1@example.com",
      role: "teacher",
    });
    const outsider = await registerAndLogin({
      email: "roster-outsider-1@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Chemistry II", subject: "Chemistry" });
    const classId = createRes.body.data.class._id;

    const res = await outsider.get(`/api/v1/classes/${classId}/members`);
    expect(res.status).toBe(403);
  });

  it("returns the roster for an active member", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-2@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "roster-student-2@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Physics III", subject: "Physics" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

    const res = await student.get(`/api/v1/classes/${classId}/members`);
    expect(res.status).toBe(200);
    expect(res.body.data.membersCount).toBe(1);
    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.members[0].user.email).toBe(
      "roster-student-2@example.com",
    );
  });

  it("returns 200 with an empty roster for the owner with zero ClassMember rows (C2)", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-3@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Zoology", subject: "Biology" });
    const classId = createRes.body.data.class._id;

    const res = await teacher.get(`/api/v1/classes/${classId}/members`);
    expect(res.status).toBe(200);
    expect(res.body.data.membersCount).toBe(0);
    expect(res.body.data.members).toHaveLength(0);
  });

  it("excludes left and removed members", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-4@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "roster-student-4@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Botany", subject: "Biology" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

    const rosterBefore = await teacher.get(
      `/api/v1/classes/${classId}/members`,
    );
    expect(rosterBefore.body.data.membersCount).toBe(1);

    // No leave endpoint exists yet (Implementation.md item 14, the next
    // task), so this reaches the left state with a direct write, mirroring
    // the archiveClass precedent used before item 11 existed.
    await ClassMember.updateOne({ classId }, { $set: { status: "left" } });

    const rosterAfter = await teacher.get(
      `/api/v1/classes/${classId}/members`,
    );
    expect(rosterAfter.status).toBe(200);
    expect(rosterAfter.body.data.membersCount).toBe(0);
    expect(rosterAfter.body.data.members).toHaveLength(0);
  });

  it("stays readable on an archived class", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-5@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Meteorology", subject: "Earth Science" });
    const classId = createRes.body.data.class._id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.get(`/api/v1/classes/${classId}/members`);
    expect(res.status).toBe(200);
  });

  it("returns 404 for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-6@example.com",
      role: "teacher",
    });

    const res = await teacher.get(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/members`,
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/classes/:classId — thinned response", () => {
  it("no longer returns a members array, but still returns membersCount", async () => {
    const teacher = await registerAndLogin({
      email: "roster-owner-7@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "roster-student-7@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Anthropology", subject: "Social Science" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

    const res = await teacher.get(`/api/v1/classes/${classId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.class.membersCount).toBe(1);
    expect(res.body.data.class.members).toBeUndefined();
  });
});
