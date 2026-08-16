const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const ClassMember = require("../models/ClassMember.model.js");
const JoinRequest = require("../models/JoinRequest.model.js");

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

  it("owner cannot be converted into a ClassMember via join-request approval (C2)", async () => {
    // joinClassService already blocks a teacher from requesting to join their
    // own class, so this legacy/out-of-band shape can't arise through the
    // normal HTTP join flow. Insert the JoinRequest directly to prove the
    // service-level guard holds regardless of how such a document got there.
    const teacher = await registerAndLogin({
      email: "owner-selfjoin@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Statistics I", subject: "Statistics" });
    const classId = createRes.body.data.class._id;

    const meRes = await teacher.get("/api/v1/users/me");
    const ownerId = meRes.body.data.user._id;

    const rogueRequest = await JoinRequest.create({
      class: classId,
      user: ownerId,
      type: "request",
      status: "pending",
    });

    const approveRes = await teacher.patch(
      `/api/v1/class/requests/${rogueRequest._id}/approve`,
    );
    expect(approveRes.status).toBe(409);

    const ownerMembershipRow = await ClassMember.findOne({
      classId,
      userId: ownerId,
    });
    expect(ownerMembershipRow).toBeNull();
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
    // Pinned so the guard rewrite in class.service.js can't silently change
    // the message the client renders (JoinClassForm passes it through raw).
    expect(forbiddenRes.body.message).toBe("You are not a member of this class");

    const missingId = new mongoose.Types.ObjectId().toString();
    const notFoundRes = await teacher.get(`/api/v1/class/${missingId}`);
    expect(notFoundRes.status).toBe(404);
  });

  // I8: leave/remove preserve the ClassMember row (history), not the access.
  it("a member who left is forbidden from reading the class", async () => {
    const teacher = await registerAndLogin({
      email: "owner-left@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-left@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Left Class", subject: "Art" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/class/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/class/requests/${requestId}/approve`);

    // No leave endpoint exists yet (Phase 1 item 14) — set the row directly.
    await ClassMember.updateOne({ classId }, { $set: { status: "left" } });

    const detailsRes = await student.get(`/api/v1/class/${classId}`);
    expect(detailsRes.status).toBe(403);
  });

  it("a member who was removed is forbidden from reading the class", async () => {
    const teacher = await registerAndLogin({
      email: "owner-removed@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-removed@example.com",
      role: "student",
    });

    const createRes = await teacher
      .post("/api/v1/class")
      .send({ name: "Removed Class", subject: "Music" });
    const classId = createRes.body.data.class._id;
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/class/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;
    await teacher.patch(`/api/v1/class/requests/${requestId}/approve`);

    // No remove endpoint exists yet (Phase 1 item 15) — set the row directly.
    await ClassMember.updateOne({ classId }, { $set: { status: "removed" } });

    const detailsRes = await student.get(`/api/v1/class/${classId}`);
    expect(detailsRes.status).toBe(403);
  });

  // PRD § 7.2: a teacher cannot manage a class they do not own.
  it("a teacher cannot approve a join request on a class they do not own", async () => {
    const ownerTeacher = await registerAndLogin({
      email: "owner-a@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "owner-b@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-cross-teacher-approve@example.com",
      role: "student",
    });

    const createRes = await ownerTeacher
      .post("/api/v1/class")
      .send({ name: "Teacher A's Class", subject: "Physics" });
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/class/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;

    const approveRes = await otherTeacher.patch(
      `/api/v1/class/requests/${requestId}/approve`,
    );
    expect(approveRes.status).toBe(403);
  });

  it("a teacher cannot reject a join request on a class they do not own", async () => {
    const ownerTeacher = await registerAndLogin({
      email: "owner-c@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "owner-d@example.com",
      role: "teacher",
    });
    const student = await registerAndLogin({
      email: "student-cross-teacher-reject@example.com",
      role: "student",
    });

    const createRes = await ownerTeacher
      .post("/api/v1/class")
      .send({ name: "Teacher C's Class", subject: "Chemistry" });
    const joinCode = createRes.body.data.class.joinCode;

    const joinRes = await student
      .post("/api/v1/class/join")
      .send({ code: joinCode });
    const requestId = joinRes.body.data.joinRequest._id;

    const rejectRes = await otherTeacher.patch(
      `/api/v1/class/requests/${requestId}/reject`,
    );
    expect(rejectRes.status).toBe(403);
  });
});
