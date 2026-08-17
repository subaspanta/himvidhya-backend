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
    .send({ name: "Pin Class", subject: "Physics" });
  expect(createRes.status).toBe(201);
  return {
    teacher,
    classId: createRes.body.data.class._id,
    joinCode: createRes.body.data.class.joinCode,
  };
}

async function joinAndApprove(teacher, classId, joinCode, studentEmail) {
  const student = await registerAndLogin({ email: studentEmail, role: "student" });
  const joinRes = await student.post("/api/v1/classes/join").send({ code: joinCode });
  const requestId = joinRes.body.data.joinRequest._id;
  await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);
  return student;
}

async function createPost(teacher, classId, title = "Post") {
  const res = await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title, content: "C" });
  return res.body.data.post._id;
}

describe("POST /posts/:postId/pin", () => {
  it("owner can pin", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-owner@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(200);
    expect(res.body.data.post.isPinned).toBe(true);
  });

  it("401s when unauthenticated", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-unauth@example.com");
    const postId = await createPost(teacher, classId);

    const res = await request(app).post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(401);
  });

  it("403s a non-owner teacher", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-nonowner@example.com");
    const postId = await createPost(teacher, classId);
    const otherTeacher = await registerAndLogin({ email: "pin-nonowner-2@example.com", role: "teacher" });

    const res = await otherTeacher.post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(403);
  });

  it("403s a student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("pin-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "pin-student-2@example.com");
    const postId = await createPost(teacher, classId);

    const res = await student.post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-archived@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent postId", async () => {
    const teacher = await registerAndLogin({ email: "pin-nopost@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.post(`/api/v1/posts/${missingId}/pin`);

    expect(res.status).toBe(404);
  });

  it("409s when already pinned", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-already@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/posts/${postId}/pin`);

    const res = await teacher.post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(409);
  });

  it("409s when the class already has 3 pinned posts", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-limit@example.com");
    const postIds = [];
    for (let i = 0; i < 4; i++) {
      postIds.push(await createPost(teacher, classId, `Post ${i}`));
    }

    for (let i = 0; i < 3; i++) {
      const res = await teacher.post(`/api/v1/posts/${postIds[i]}/pin`);
      expect(res.status).toBe(200);
    }

    const fourthRes = await teacher.post(`/api/v1/posts/${postIds[3]}/pin`);
    expect(fourthRes.status).toBe(409);

    const pinnedCount = await Post.countDocuments({ classId, isPinned: true });
    expect(pinnedCount).toBe(3);
  });

  it("409s pinning an already-deleted post", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-deleted@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.delete(`/api/v1/posts/${postId}`);

    const res = await teacher.post(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(409);
  });
});

describe("DELETE /posts/:postId/pin", () => {
  it("owner can unpin", async () => {
    const { teacher, classId } = await createClassAndTeacher("unpin-owner@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/posts/${postId}/pin`);

    const res = await teacher.delete(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(200);
    expect(res.body.data.post.isPinned).toBe(false);
  });

  it("409s when not currently pinned", async () => {
    const { teacher, classId } = await createClassAndTeacher("unpin-notpinned@example.com");
    const postId = await createPost(teacher, classId);

    const res = await teacher.delete(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(409);
  });

  it("403s a non-owner", async () => {
    const { teacher, classId } = await createClassAndTeacher("unpin-nonowner@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/posts/${postId}/pin`);
    const otherTeacher = await registerAndLogin({ email: "unpin-nonowner-2@example.com", role: "teacher" });

    const res = await otherTeacher.delete(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("unpin-archived@example.com");
    const postId = await createPost(teacher, classId);
    await teacher.post(`/api/v1/posts/${postId}/pin`);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.delete(`/api/v1/posts/${postId}/pin`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent postId", async () => {
    const teacher = await registerAndLogin({ email: "unpin-nopost@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.delete(`/api/v1/posts/${missingId}/pin`);

    expect(res.status).toBe(404);
  });
});

describe("Feed ordering with pinned posts", () => {
  it("pinned posts surface before unpinned regardless of createdAt", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-order@example.com");
    const authorId = (await teacher.get("/api/v1/users/me")).body.data.user._id;

    // Seed the pinned post with an OLDER createdAt than the unpinned one.
    const older = new Date("2020-01-01T00:00:00.000Z");
    const newer = new Date("2026-08-17T00:00:00.000Z");
    const pinnedDoc = await Post.create({
      title: "Old but pinned",
      content: "C",
      classId,
      authorId,
      isPinned: true,
    });
    await Post.updateOne({ _id: pinnedDoc._id }, { $set: { createdAt: older } });
    const unpinnedDoc = await Post.create({
      title: "New and unpinned",
      content: "C",
      classId,
      authorId,
    });
    await Post.updateOne({ _id: unpinnedDoc._id }, { $set: { createdAt: newer } });

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.body.data.posts[0]._id).toBe(pinnedDoc._id.toString());
    expect(res.body.data.posts[1]._id).toBe(unpinnedDoc._id.toString());
  });

  it("within the pinned bucket, ordering is still (createdAt, _id) descending", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-order-internal@example.com");
    const authorId = (await teacher.get("/api/v1/users/me")).body.data.user._id;

    const earlier = await Post.create({
      title: "Pinned earlier",
      content: "C",
      classId,
      authorId,
      isPinned: true,
    });
    await Post.updateOne(
      { _id: earlier._id },
      { $set: { createdAt: new Date("2026-01-01T00:00:00.000Z") } },
    );
    const later = await Post.create({
      title: "Pinned later",
      content: "C",
      classId,
      authorId,
      isPinned: true,
    });
    await Post.updateOne(
      { _id: later._id },
      { $set: { createdAt: new Date("2026-02-01T00:00:00.000Z") } },
    );

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.body.data.posts[0]._id).toBe(later._id.toString());
    expect(res.body.data.posts[1]._id).toBe(earlier._id.toString());
  });

  it("pinned-boundary resumption: 3 pinned + 5 unpinned, limit=2, no dupes/gaps across all pages", async () => {
    const { teacher, classId } = await createClassAndTeacher("pin-boundary@example.com");
    const authorId = (await teacher.get("/api/v1/users/me")).body.data.user._id;

    const base = new Date("2026-08-17T00:00:00.000Z");
    const pinnedIds = [];
    for (let i = 0; i < 3; i++) {
      const doc = await Post.create({
        title: `Pinned ${i}`,
        content: "C",
        classId,
        authorId,
        isPinned: true,
      });
      await Post.updateOne(
        { _id: doc._id },
        { $set: { createdAt: new Date(base.getTime() + i * 1000) } },
      );
      pinnedIds.push(doc._id.toString());
    }
    const unpinnedIds = [];
    for (let i = 0; i < 5; i++) {
      const doc = await Post.create({
        title: `Unpinned ${i}`,
        content: "C",
        classId,
        authorId,
      });
      await Post.updateOne(
        { _id: doc._id },
        { $set: { createdAt: new Date(base.getTime() + (i + 10) * 1000) } },
      );
      unpinnedIds.push(doc._id.toString());
    }

    const seen = [];
    let cursor;
    let hasMore = true;
    let pages = 0;
    while (hasMore) {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=2` : "?limit=2";
      const res = await teacher.get(`/api/v1/classes/${classId}/posts${qs}`);
      expect(res.status).toBe(200);
      seen.push(...res.body.data.posts.map((p) => p._id));
      hasMore = res.body.meta.hasMore;
      cursor = res.body.meta.nextCursor;
      pages += 1;
      expect(pages).toBeLessThan(10); // guard against an infinite loop on a bug
    }

    const allIds = [...pinnedIds, ...unpinnedIds];
    expect(seen).toHaveLength(allIds.length);
    expect(new Set(seen).size).toBe(allIds.length);
    expect(seen.sort()).toEqual(allIds.sort());

    // All pinned ids must appear strictly before any unpinned id in the
    // combined page order (pinned always fully precedes unpinned).
    const lastPinnedIndex = Math.max(...pinnedIds.map((id) => seen.indexOf(id)));
    const firstUnpinnedIndex = Math.min(...unpinnedIds.map((id) => seen.indexOf(id)));
    expect(lastPinnedIndex).toBeLessThan(firstUnpinnedIndex);
  });

  it("unpinning moves a post out of the pinned bucket on the next feed fetch", async () => {
    const { teacher, classId } = await createClassAndTeacher("unpin-feed@example.com");
    const postId = await createPost(teacher, classId, "Toggle me");
    await teacher.post(`/api/v1/posts/${postId}/pin`);

    let res = await teacher.get(`/api/v1/classes/${classId}/posts`);
    expect(res.body.data.posts[0].isPinned).toBe(true);

    await teacher.delete(`/api/v1/posts/${postId}/pin`);

    res = await teacher.get(`/api/v1/classes/${classId}/posts`);
    expect(res.body.data.posts[0].isPinned).toBe(false);
  });
});
