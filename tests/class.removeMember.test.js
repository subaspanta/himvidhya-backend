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

async function createAndJoin(teacher, student, classPayload) {
  const createRes = await teacher.post("/api/v1/classes").send(classPayload);
  const classId = createRes.body.data.class.id;
  const joinCode = createRes.body.data.class.code;

  const joinRes = await student
    .post("/api/v1/classes/join")
    .send({ code: joinCode });
  const requestId = joinRes.body.data.joinRequest._id;
  await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

  return classId;
}

async function getUserId(agent) {
  const res = await agent.get("/api/v1/users/me");
  return res.body.data.user._id;
}

describe("DELETE /api/v1/classes/:classId/members/:userId", () => {
  it("returns 403 for a non-owner teacher", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-1@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "remove-other-teacher-1@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "remove-student-1@example.com",
      role: "student",
    });

    const classId = await createAndJoin(owner, student, {
      name: "Optics",
      subject: "Physics",
    });
    const studentId = await getUserId(student);

    const res = await otherTeacher.delete(
      `/api/v1/classes/${classId}/members/${studentId}`,
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for a student caller", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-2@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "remove-student-2@example.com",
      role: "student",
    });

    const classId = await createAndJoin(owner, student, {
      name: "Thermodynamics",
      subject: "Physics",
    });
    const studentId = await getUserId(student);

    const res = await student.delete(
      `/api/v1/classes/${classId}/members/${studentId}`,
    );
    expect(res.status).toBe(403);
  });

  it("removes an active member for the owner and preserves the row", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-3@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "remove-student-3@example.com",
      role: "student",
    });

    const classId = await createAndJoin(owner, student, {
      name: "Electromagnetism",
      subject: "Physics",
    });
    const studentId = await getUserId(student);

    const res = await owner.delete(
      `/api/v1/classes/${classId}/members/${studentId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.membership.status).toBe("removed");

    const row = await ClassMember.findOne({ classId, userId: studentId });
    expect(row).not.toBeNull();
    expect(row.status).toBe("removed");
  });

  it("returns 404 when the target has no active membership row", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-4@example.com",
      role: "teacher",
    });
    const neverJoined = await registerAndLogin({
      email: "remove-never-joined-4@example.com",
      role: "student",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "Quantum Mechanics", subject: "Physics" });
    const classId = createRes.body.data.class.id;
    const targetId = await getUserId(neverJoined);

    const res = await owner.delete(
      `/api/v1/classes/${classId}/members/${targetId}`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed userId, not a 500", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-5@example.com",
      role: "teacher",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "Fluid Dynamics", subject: "Physics" });
    const classId = createRes.body.data.class.id;

    const res = await owner.delete(
      `/api/v1/classes/${classId}/members/not-a-valid-id`,
    );
    expect(res.status).toBe(404);
  });

  it("succeeds on an archived class", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-6@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "remove-student-6@example.com",
      role: "student",
    });

    const classId = await createAndJoin(owner, student, {
      name: "Acoustics",
      subject: "Physics",
    });
    const studentId = await getUserId(student);
    await owner.post(`/api/v1/classes/${classId}/archive`);

    const res = await owner.delete(
      `/api/v1/classes/${classId}/members/${studentId}`,
    );
    expect(res.status).toBe(200);
  });

  it("removed student loses class access", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-7@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "remove-student-7@example.com",
      role: "student",
    });

    const classId = await createAndJoin(owner, student, {
      name: "Nuclear Physics",
      subject: "Physics",
    });
    const studentId = await getUserId(student);

    await owner.delete(`/api/v1/classes/${classId}/members/${studentId}`);

    const res = await student.get(`/api/v1/classes/${classId}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent classId", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-8@example.com",
      role: "teacher",
    });

    const res = await owner.delete(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/members/${new mongoose.Types.ObjectId()}`,
    );
    expect(res.status).toBe(404);
  });

  it("re-approval after removal reactivates the same row rather than duplicating it", async () => {
    const owner = await registerAndLogin({
      email: "remove-owner-9@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "remove-student-9@example.com",
      role: "student",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "Astrophysics", subject: "Physics" });
    const classId = createRes.body.data.class.id;
    const joinCode = createRes.body.data.class.code;
    const studentId = await getUserId(student);

    const firstJoinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const firstRequestId = firstJoinRes.body.data.joinRequest._id;
    await owner.patch(`/api/v1/classes/requests/${firstRequestId}/approve`);

    await owner.delete(`/api/v1/classes/${classId}/members/${studentId}`);

    const secondJoinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const secondRequestId = secondJoinRes.body.data.joinRequest._id;
    const approveRes = await owner.patch(
      `/api/v1/classes/requests/${secondRequestId}/approve`,
    );
    expect(approveRes.status).toBe(200);

    const rows = await ClassMember.find({ classId });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
  });
});
