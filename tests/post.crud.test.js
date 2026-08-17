const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const Post = require("../models/Post.model.js");

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

async function createClassAndTeacher(email) {
  const teacher = await registerAndLogin({ email, role: "teacher" });
  const createRes = await teacher
    .post("/api/v1/classes")
    .send({ name: "CRUD Class", subject: "Physics" });
  expect(createRes.status).toBe(201);
  return { teacher, classId: createRes.body.data.class._id, joinCode: createRes.body.data.class.joinCode };
}

async function joinAndApprove(teacher, classId, joinCode, studentEmail) {
  const student = await registerAndLogin({ email: studentEmail, role: "student" });
  const joinRes = await student.post("/api/v1/classes/join").send({ code: joinCode });
  expect(joinRes.status).toBe(201);
  const requestId = joinRes.body.data.joinRequest._id;
  const approveRes = await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);
  expect(approveRes.status).toBe(200);
  return student;
}

describe("POST /classes/:classId/posts", () => {
  it("creates a post as the class owner (201)", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-create-owner@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Welcome", content: "First post" });

    expect(res.status).toBe(201);
    expect(res.body.data.post.title).toBe("Welcome");
    expect(res.body.data.post.isPinned).toBe(false);
    expect(res.body.data.post.deletedAt).toBeNull();
  });

  it("401s when unauthenticated", async () => {
    const { classId } = await createClassAndTeacher("crud-create-unauth@example.com");

    const res = await request(app)
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Welcome", content: "First post" });

    expect(res.status).toBe(401);
  });

  it("403s for a student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("crud-create-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "crud-create-student-2@example.com");

    const res = await student
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Welcome", content: "First post" });

    expect(res.status).toBe(403);
  });

  it("403s for a teacher who does not own the class", async () => {
    const { classId } = await createClassAndTeacher("crud-create-otherteacher@example.com");
    const otherTeacher = await registerAndLogin({
      email: "crud-create-otherteacher-2@example.com",
      role: "teacher",
    });

    const res = await otherTeacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Welcome", content: "First post" });

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-create-archived@example.com");
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Welcome", content: "First post" });

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({ email: "crud-create-noclass@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher
      .post(`/api/v1/classes/${missingId}/posts`)
      .send({ title: "Welcome", content: "First post" });

    expect(res.status).toBe(404);
  });

  it("422s when title is missing", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-create-notitle@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ content: "No title here" });

    expect(res.status).toBe(422);
  });

  it("422s when content is missing", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-create-nocontent@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "No content here" });

    expect(res.status).toBe(422);
  });

  it("422s when title exceeds the max length", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-create-longtitle@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "a".repeat(201), content: "Content" });

    expect(res.status).toBe(422);
  });

  it("trims whitespace from title and content", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-create-trim@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "  Padded Title  ", content: "  Padded content  " });

    expect(res.status).toBe(201);
    expect(res.body.data.post.title).toBe("Padded Title");
    expect(res.body.data.post.content).toBe("Padded content");
  });
});

describe("GET /posts/:postId", () => {
  it("returns for an active member", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("crud-get-member@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "crud-get-member-2@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Readable", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await student.get(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.post.title).toBe("Readable");
  });

  it("returns for the owner", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-get-owner@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Readable", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await teacher.get(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(200);
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-get-unauth@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Readable", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await request(app).get(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(401);
  });

  it("403s for a non-member", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-get-nonmember@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Readable", content: "Content" });
    const postId = createRes.body.data.post._id;
    const outsider = await registerAndLogin({ email: "crud-get-outsider@example.com", role: "student" });

    const res = await outsider.get(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent postId", async () => {
    const teacher = await registerAndLogin({ email: "crud-get-nopost@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.get(`/api/v1/posts/${missingId}`);

    expect(res.status).toBe(404);
  });

  it("404s for a malformed postId", async () => {
    const teacher = await registerAndLogin({ email: "crud-get-badpost@example.com", role: "teacher" });

    const res = await teacher.get("/api/v1/posts/not-an-object-id");

    expect(res.status).toBe(404);
  });

  it("200s reading a post on an archived class", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-get-archived@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Readable", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.get(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(200);
  });

  it("still returns a soft-deleted post with deletedAt populated", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-get-tombstone@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Will be deleted", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.delete(`/api/v1/posts/${postId}`);

    const res = await teacher.get(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.post.deletedAt).not.toBeNull();
  });
});

describe("PATCH /posts/:postId", () => {
  it("author can update", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-patch-author@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await teacher.patch(`/api/v1/posts/${postId}`).send({ title: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.data.post.title).toBe("Updated");
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-patch-unauth@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await request(app).patch(`/api/v1/posts/${postId}`).send({ title: "Updated" });

    expect(res.status).toBe(401);
  });

  it("403s a non-author teacher", async () => {
    const { teacher: owner, classId } = await createClassAndTeacher("crud-patch-nonauthor-owner@example.com");
    const otherTeacher = await registerAndLogin({
      email: "crud-patch-nonauthor-2@example.com",
      role: "teacher",
    });
    const createRes = await owner
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await otherTeacher.patch(`/api/v1/posts/${postId}`).send({ title: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("403s a student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("crud-patch-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "crud-patch-student-2@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await student.patch(`/api/v1/posts/${postId}`).send({ title: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-patch-archived@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.patch(`/api/v1/posts/${postId}`).send({ title: "Updated" });

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent postId", async () => {
    const teacher = await registerAndLogin({ email: "crud-patch-nopost@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.patch(`/api/v1/posts/${missingId}`).send({ title: "Updated" });

    expect(res.status).toBe(404);
  });

  it("422s on an empty body", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-patch-empty@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await teacher.patch(`/api/v1/posts/${postId}`).send({});

    expect(res.status).toBe(422);
  });

  it("409s editing an already-deleted post", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-patch-deleted@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "Original", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.delete(`/api/v1/posts/${postId}`);

    const res = await teacher.patch(`/api/v1/posts/${postId}`).send({ title: "Updated" });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /posts/:postId", () => {
  it("author can soft-delete (200, deletedAt set)", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-delete-author@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "To delete", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await teacher.delete(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.post.deletedAt).not.toBeNull();

    const dbPost = await Post.findById(postId);
    expect(dbPost.deletedAt).not.toBeNull();
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-delete-unauth@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "To delete", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await request(app).delete(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(401);
  });

  it("403s a non-author", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("crud-delete-nonauthor@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "crud-delete-nonauthor-2@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "To delete", content: "Content" });
    const postId = createRes.body.data.post._id;

    const res = await student.delete(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-delete-archived@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "To delete", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.delete(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent postId", async () => {
    const teacher = await registerAndLogin({ email: "crud-delete-nopost@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.delete(`/api/v1/posts/${missingId}`);

    expect(res.status).toBe(404);
  });

  it("409s deleting an already-deleted post", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-delete-twice@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "To delete", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.delete(`/api/v1/posts/${postId}`);

    const res = await teacher.delete(`/api/v1/posts/${postId}`);

    expect(res.status).toBe(409);
  });

  it("excludes a soft-deleted post from the class feed", async () => {
    const { teacher, classId } = await createClassAndTeacher("crud-delete-feed@example.com");
    const createRes = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({ title: "To delete", content: "Content" });
    const postId = createRes.body.data.post._id;
    await teacher.delete(`/api/v1/posts/${postId}`);

    const feedRes = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.posts.map((p) => p._id)).not.toContain(postId);
  });
});
