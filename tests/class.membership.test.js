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

describe("ClassMember-backed membership", () => {
  it("owner sees their own class in /class/my with no ClassMember row (C2)", async () => {
    const teacher = await registerAndLogin({
      email: "owner-c2@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Physics I", subject: "Physics" });
    expect(createRes.status).toBe(201);
    const classId = createRes.body.data.class._id;

    const memberRowCount = await ClassMember.countDocuments({ classId });
    expect(memberRowCount).toBe(0);

    const listRes = await teacher.get("/api/v1/class/my");
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.classes.map((c) => c.id);
    expect(ids).toContain(classId);
  });

  it("join → approve creates an active ClassMember and surfaces in roster and /class/my", async () => {
    const teacher = await registerAndLogin({
      email: "owner-join@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-join@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Chemistry I", subject: "Chemistry" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student.post("/api/v1/class/join").send({ code: joinCode });
    expect(joinRes.status).toBe(201);
    const requestId = joinRes.body.data.joinRequest._id;

    const approveRes = await teacher.patch(
      `/api/v1/class/requests/${requestId}/approve`,
    );
    expect(approveRes.status).toBe(200);

    const row = await ClassMember.findOne({ classId });
    expect(row).not.toBeNull();
    expect(row.status).toBe("active");

    const studentClasses = await student.get("/api/v1/class/my");
    expect(studentClasses.status).toBe(200);
    expect(studentClasses.body.data.classes.map((c) => c.id)).toContain(classId);

    const detailsRes = await student.get(`/api/v1/class/${classId}`);
    expect(detailsRes.status).toBe(200);
    const { members, membersCount } = detailsRes.body.data.class;
    expect(membersCount).toBe(1);
    expect(members).toHaveLength(1);
    expect(members[0]).not.toHaveProperty("role");
    expect(members[0].user.email).toBe("student-join@example.com");
  });

  it("approving an already-active member returns 409", async () => {
    const teacher = await registerAndLogin({
      email: "owner-dup@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-dup@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Biology I", subject: "Biology" });
    const joinCode = createRes.body.data.class.joinCode;

    const firstJoin = await student.post("/api/v1/class/join").send({ code: joinCode });
    const firstRequestId = firstJoin.body.data.joinRequest._id;
    const approveRes = await teacher.patch(
      `/api/v1/class/requests/${firstRequestId}/approve`,
    );
    expect(approveRes.status).toBe(200);

    // Already an active member — re-joining is rejected before a second
    // pending request can even be created.
    const secondJoin = await student.post("/api/v1/class/join").send({ code: joinCode });
    expect(secondJoin.status).toBe(409);
  });

  it("roster excludes the owner", async () => {
    const teacher = await registerAndLogin({
      email: "owner-roster@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-roster@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "History I", subject: "History" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student.post("/api/v1/class/join").send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/class/requests/${requestId}/approve`);

    const detailsRes = await teacher.get(`/api/v1/class/${classId}`);
    expect(detailsRes.status).toBe(200);
    const emails = detailsRes.body.data.class.members.map((m) => m.user.email);
    expect(emails).not.toContain("owner-roster@example.com");
    expect(emails).toContain("student-roster@example.com");
  });

  it("non-member is forbidden and a nonexistent class id is not found", async () => {
    const teacher = await registerAndLogin({
      email: "owner-forbidden@example.com",
      role: "teacher",
    });
    const outsider = await registerAndLogin({
      email: "outsider@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Geography I", subject: "Geography" });
    const classId = createRes.body.data.class._id;

    const forbiddenRes = await outsider.get(`/api/v1/class/${classId}`);
    expect(forbiddenRes.status).toBe(403);

    const missingId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await teacher.get(`/api/v1/class/${missingId}`);
    expect(notFoundRes.status).toBe(404);
  });
});
