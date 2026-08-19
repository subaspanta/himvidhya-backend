const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const Comment = require("../models/Comment.model.js");

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
    .send({ name: "Comments Class", subject: "Physics" });
  expect(createRes.status).toBe(201);
  return {
    teacher,
    classId: createRes.body.data.class.id,
    joinCode: createRes.body.data.class.code,
  };
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

async function createPost(teacher, classId, overrides = {}) {
  const res = await teacher
    .post(`/api/v1/classes/${classId}/posts`)
    .send({ title: "Discussion", content: "Post body", ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.post._id;
}

describe("POST /posts/:postId/comments", () => {
  it("creates a comment as an active student member (201)", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("cmt-create-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "cmt-create-student-2@example.com");
    const postId = await createPost(teacher, classId);

    const res = await student.post(`/api/v1/posts/${postId}/comments`).send({ content: "Nice post" });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.content).toBe("Nice post");
    expect(res.body.data.comment.deletedAt).toBeNull();
    expect(res.body.data.comment.authorId).toMatchObject({ name: "Test User", role: "student" });
  });

  it("creates a comment as the class owner (201)", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-owner@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Owner reply" });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.authorId.role).toBe("teacher");
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-unauth@example.com");
    const postId = await createPost(teacher, classId);

    const res = await request(app).post(`/api/v1/posts/${postId}/comments`).send({ content: "Hi" });

    expect(res.status).toBe(401);
  });

  it("403s for a non-member", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-nonmember@example.com");
    const postId = await createPost(teacher, classId);
    const outsider = await registerAndLogin({ email: "cmt-create-outsider@example.com", role: "student" });

    const res = await outsider.post(`/api/v1/posts/${postId}/comments`).send({ content: "Hi" });

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-archived@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Hi" });

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent postId", async () => {
    const teacher = await registerAndLogin({ email: "cmt-create-nopost@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.post(`/api/v1/posts/${missingId}/comments`).send({ content: "Hi" });

    expect(res.status).toBe(404);
  });

  it("422s when content is missing", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-nocontent@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.post(`/api/v1/posts/${postId}/comments`).send({});

    expect(res.status).toBe(422);
  });

  it("422s when content exceeds the max length", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-toolong@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: "a".repeat(2001) });

    expect(res.status).toBe(422);
  });

  it("trims whitespace from content", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-create-trim@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "  padded  " });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.content).toBe("padded");
  });
});

describe("GET /posts/:postId/comments", () => {
  it("returns an empty list with hasMore false and nextCursor null", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-empty@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data.comments).toEqual([]);
    expect(res.body.meta).toEqual({ hasMore: false, nextCursor: null });
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-unauth@example.com");
    const postId = await createPost(teacher, classId);

    const res = await request(app).get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(401);
  });

  it("403s for a non-member", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-nonmember@example.com");
    const postId = await createPost(teacher, classId);
    const outsider = await registerAndLogin({ email: "cmt-list-outsider@example.com", role: "student" });

    const res = await outsider.get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(403);
  });

  it("orders comments oldest to newest", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-order@example.com");
    const postId = await createPost(teacher, classId);
    const first = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "First" });
    const second = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Second" });

    const res = await teacher.get(`/api/v1/posts/${postId}/comments`);

    expect(res.body.data.comments[0]._id).toBe(first.body.data.comment._id);
    expect(res.body.data.comments[1]._id).toBe(second.body.data.comment._id);
  });

  it("defaults to 10 per page when limit is omitted", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-default-limit@example.com");
    const postId = await createPost(teacher, classId);
    for (let i = 0; i < 12; i++) {
      await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: `Comment ${i}` });
    }

    const res = await teacher.get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data.comments).toHaveLength(10);
    expect(res.body.meta.hasMore).toBe(true);
  });

  it("clamps limit to 50 when a larger value is requested", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-clamp@example.com");
    const postId = await createPost(teacher, classId);
    for (let i = 0; i < 55; i++) {
      await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: `Comment ${i}` });
    }

    const res = await teacher.get(`/api/v1/posts/${postId}/comments?limit=1000`);

    expect(res.status).toBe(200);
    expect(res.body.data.comments).toHaveLength(50);
  });

  it("422s for a malformed cursor token", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-badcursor@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.get(`/api/v1/posts/${postId}/comments?cursor=not-a-valid-cursor`);

    expect(res.status).toBe(422);
  });

  it("pages forward without duplicates or skips", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-paging@example.com");
    const postId = await createPost(teacher, classId);
    const created = [];
    for (let i = 0; i < 5; i++) {
      const res = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: `Comment ${i}` });
      created.push(res.body.data.comment._id);
    }

    const seen = [];
    let cursor;
    let hasMore = true;
    while (hasMore) {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=2` : "?limit=2";
      const res = await teacher.get(`/api/v1/posts/${postId}/comments${qs}`);
      expect(res.status).toBe(200);
      seen.push(...res.body.data.comments.map((c) => c._id));
      hasMore = res.body.meta.hasMore;
      cursor = res.body.meta.nextCursor;
    }

    expect(seen).toEqual(created);
  });

  it("stays readable on an archived class", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-archived@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Before archive" });
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data.comments).toHaveLength(1);
  });

  it("keeps a soft-deleted comment in the list as a tombstone", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-list-tombstone@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Will delete" });
    const commentId = createRes.body.data.comment._id;
    await teacher.delete(`/api/v1/comments/${commentId}`);

    const res = await teacher.get(`/api/v1/posts/${postId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data.comments).toHaveLength(1);
    expect(res.body.data.comments[0].deletedAt).not.toBeNull();
  });
});

describe("PATCH /comments/:commentId", () => {
  it("author can update their own comment", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-patch-author@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;

    const res = await teacher.patch(`/api/v1/comments/${commentId}`).send({ content: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.data.comment.content).toBe("Updated");
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-patch-unauth@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;

    const res = await request(app).patch(`/api/v1/comments/${commentId}`).send({ content: "Updated" });

    expect(res.status).toBe(401);
  });

  it("403s a non-author student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("cmt-patch-nonauthor@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "cmt-patch-nonauthor-2@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await student.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;
    const otherStudent = await joinAndApprove(teacher, classId, joinCode, "cmt-patch-nonauthor-3@example.com");

    const res = await otherStudent.patch(`/api/v1/comments/${commentId}`).send({ content: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("403s the class teacher editing a student's comment (I9 — teacher may delete, never edit)", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("cmt-patch-teacher-i9@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "cmt-patch-teacher-i9-2@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await student.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;

    const res = await teacher.patch(`/api/v1/comments/${commentId}`).send({ content: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-patch-archived@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.patch(`/api/v1/comments/${commentId}`).send({ content: "Updated" });

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent commentId", async () => {
    const teacher = await registerAndLogin({ email: "cmt-patch-nocomment@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.patch(`/api/v1/comments/${missingId}`).send({ content: "Updated" });

    expect(res.status).toBe(404);
  });

  it("422s when content is empty", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-patch-empty@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;

    const res = await teacher.patch(`/api/v1/comments/${commentId}`).send({ content: "" });

    expect(res.status).toBe(422);
  });

  it("409s editing an already-deleted comment", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-patch-deleted@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "Original" });
    const commentId = createRes.body.data.comment._id;
    await teacher.delete(`/api/v1/comments/${commentId}`);

    const res = await teacher.patch(`/api/v1/comments/${commentId}`).send({ content: "Updated" });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /comments/:commentId", () => {
  it("author can soft-delete their own comment (200, deletedAt set)", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("cmt-delete-author@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "cmt-delete-author-2@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await student.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;

    const res = await student.delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.comment.deletedAt).not.toBeNull();

    const dbComment = await Comment.findById(commentId);
    expect(dbComment.deletedAt).not.toBeNull();
  });

  it("class teacher can delete a student's comment (moderation, 200)", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("cmt-delete-moderation@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "cmt-delete-moderation-2@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await student.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;

    const res = await teacher.delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.comment.deletedAt).not.toBeNull();
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-delete-unauth@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;

    const res = await request(app).delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(401);
  });

  it("403s a non-author, non-owner student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("cmt-delete-nonauthor@example.com");
    const author = await joinAndApprove(teacher, classId, joinCode, "cmt-delete-nonauthor-2@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await author.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;
    const otherStudent = await joinAndApprove(teacher, classId, joinCode, "cmt-delete-nonauthor-3@example.com");

    const res = await otherStudent.delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(403);
  });

  it("403s a teacher who does not own the class", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-delete-otherteacher@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;
    const otherTeacher = await registerAndLogin({
      email: "cmt-delete-otherteacher-2@example.com",
      role: "teacher",
    });

    const res = await otherTeacher.delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-delete-archived@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent commentId", async () => {
    const teacher = await registerAndLogin({ email: "cmt-delete-nocomment@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.delete(`/api/v1/comments/${missingId}`);

    expect(res.status).toBe(404);
  });

  it("409s deleting an already-deleted comment", async () => {
    const { teacher, classId } = await createClassAndTeacher("cmt-delete-twice@example.com");
    const postId = await createPost(teacher, classId);
    const createRes = await teacher.post(`/api/v1/posts/${postId}/comments`).send({ content: "To delete" });
    const commentId = createRes.body.data.comment._id;
    await teacher.delete(`/api/v1/comments/${commentId}`);

    const res = await teacher.delete(`/api/v1/comments/${commentId}`);

    expect(res.status).toBe(409);
  });
});
