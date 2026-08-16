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
  const classId = createRes.body.data.class._id;
  const joinCode = createRes.body.data.class.joinCode;

  const joinRes = await student
    .post("/api/v1/classes/join")
    .send({ code: joinCode });
  const requestId = joinRes.body.data.joinRequest._id;
  await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

  return classId;
}

describe("DELETE /api/v1/classes/:classId/members/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).delete(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/members/me`,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-member", async () => {
    const teacher = await registerAndLogin({
      email: "leave-owner-1@example.com",
      role: "teacher",
    });
    const outsider = await registerAndLogin({
      email: "leave-outsider-1@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Ecology", subject: "Biology" });
    const classId = createRes.body.data.class._id;

    const res = await outsider.delete(
      `/api/v1/classes/${classId}/members/me`,
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when the owner calls it on their own class", async () => {
    const teacher = await registerAndLogin({
      email: "leave-owner-2@example.com",
      role: "teacher",
      // Owner never registers as a student, so this exercises the route
      // guard rather than role authorization — a teacher hitting their
      // own class's leave endpoint.
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Genetics", subject: "Biology" });
    const classId = createRes.body.data.class._id;

    // The route restricts this action to the student role (only students
    // ever become ClassMember rows — C2), so a teacher caller is rejected
    // by the role ladder before reaching the owner-specific guard.
    const res = await teacher.delete(`/api/v1/classes/${classId}/members/me`);
    expect(res.status).toBe(403);
  });

  it("sets status to left for an active member and preserves the row", async () => {
    const teacher = await registerAndLogin({
      email: "leave-owner-3@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "leave-student-3@example.com",
      role: "student",
    });

    const classId = await createAndJoin(teacher, student, {
      name: "Immunology",
      subject: "Biology",
    });

    const res = await student.delete(`/api/v1/classes/${classId}/members/me`);
    expect(res.status).toBe(200);
    expect(res.body.data.membership.status).toBe("left");

    const row = await ClassMember.findOne({ classId });
    expect(row).not.toBeNull();
    expect(row.status).toBe("left");
  });

  it("succeeds on an archived class", async () => {
    const teacher = await registerAndLogin({
      email: "leave-owner-4@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "leave-student-4@example.com",
      role: "student",
    });

    const classId = await createAndJoin(teacher, student, {
      name: "Microbiology",
      subject: "Biology",
    });
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await student.delete(`/api/v1/classes/${classId}/members/me`);
    expect(res.status).toBe(200);
  });

  it("returns 403 when leaving a second time", async () => {
    const teacher = await registerAndLogin({
      email: "leave-owner-5@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "leave-student-5@example.com",
      role: "student",
    });

    const classId = await createAndJoin(teacher, student, {
      name: "Virology",
      subject: "Biology",
    });

    const firstLeave = await student.delete(
      `/api/v1/classes/${classId}/members/me`,
    );
    expect(firstLeave.status).toBe(200);

    const secondLeave = await student.delete(
      `/api/v1/classes/${classId}/members/me`,
    );
    expect(secondLeave.status).toBe(403);
  });

  it("returns 404 for a nonexistent classId", async () => {
    const student = await registerAndLogin({
      email: "leave-student-6@example.com",
      role: "student",
    });

    const res = await student.delete(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/members/me`,
    );
    expect(res.status).toBe(404);
  });

  it("rejoining after leave reactivates the same row rather than duplicating it", async () => {
    const teacher = await registerAndLogin({
      email: "leave-owner-7@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "leave-student-7@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Pathology", subject: "Biology" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const firstJoinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const firstRequestId = firstJoinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/classes/requests/${firstRequestId}/approve`);

    const leaveRes = await student.delete(
      `/api/v1/classes/${classId}/members/me`,
    );
    expect(leaveRes.status).toBe(200);

    const secondJoinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const secondRequestId = secondJoinRes.body.data.joinRequest._id;
    const approveRes = await teacher.patch(
      `/api/v1/classes/requests/${secondRequestId}/approve`,
    );
    expect(approveRes.status).toBe(200);

    const rows = await ClassMember.find({ classId });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
  });
});
