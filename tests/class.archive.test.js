const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const Class = require("../models/Class.model.js");
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

// No archive endpoint exists yet (Implementation.md Phase 1 item 11, not
// built on this branch), so tests reach the archived state with a direct
// write to the fixture, mirroring the rogue-JoinRequest precedent in
// class.membership.test.js.
async function archiveClass(classId) {
  await Class.updateOne({ _id: classId }, { $set: { status: "archived" } });
}

describe("Archived class — reads stay open (C5, DR1)", () => {
  it("owner can still GET an archived class", async () => {
    const teacher = await registerAndLogin({
      email: "archive-owner-read@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Archived Physics", subject: "Physics" });
    expect(createRes.status).toBe(201);
    const classId = createRes.body.data.class._id;

    await archiveClass(classId);

    const detailsRes = await teacher.get(`/api/v1/classes/${classId}`);
    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.class.status).toBe("archived");
  });

  it("an active member can still GET an archived class", async () => {
    const teacher = await registerAndLogin({
      email: "archive-member-read-owner@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "archive-member-read-student@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Archived Chemistry", subject: "Chemistry" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);

    await archiveClass(classId);

    const detailsRes = await student.get(`/api/v1/classes/${classId}`);
    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.class.status).toBe("archived");
    expect(
      detailsRes.body.data.class.members.map((m) => m.user.email),
    ).toContain("archive-member-read-student@example.com");
  });
});

describe("Archived class — ordinary writes return 403 (C6, DR2, item 19)", () => {
  it("joining an archived class returns 403, not 400", async () => {
    const teacher = await registerAndLogin({
      email: "archive-join-owner@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "archive-join-student@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Archived Biology", subject: "Biology" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    await archiveClass(classId);

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    expect(joinRes.status).toBe(403);
  });

  it("approving a join request on an archived class returns 403 and creates no membership", async () => {
    const teacher = await registerAndLogin({
      email: "archive-approve-owner@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "archive-approve-student@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Archived History", subject: "History" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;

    await archiveClass(classId);

    const approveRes = await teacher.patch(
      `/api/v1/classes/requests/${requestId}/approve`,
    );
    expect(approveRes.status).toBe(403);

    const memberRowCount = await ClassMember.countDocuments({ classId });
    expect(memberRowCount).toBe(0);
  });

  it("rejecting a join request on an archived class still succeeds (documented exemption)", async () => {
    const teacher = await registerAndLogin({
      email: "archive-reject-owner@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "archive-reject-student@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Archived Geography", subject: "Geography" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/classes/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;

    await archiveClass(classId);

    const rejectRes = await teacher.patch(
      `/api/v1/classes/requests/${requestId}/reject`,
    );
    expect(rejectRes.status).toBe(200);
  });
});
