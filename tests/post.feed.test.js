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
    .send({ name: "Feed Class", subject: "Physics" });
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
  const requestId = joinRes.body.data.joinRequest._id;
  await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);
  return student;
}

describe("GET /classes/:classId/posts", () => {
  it("401s when unauthenticated", async () => {
    const { classId } = await createClassAndTeacher("feed-unauth@example.com");

    const res = await request(app).get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(401);
  });

  it("403s for a non-member", async () => {
    const { classId } = await createClassAndTeacher("feed-nonmember@example.com");
    const outsider = await registerAndLogin({ email: "feed-outsider@example.com", role: "student" });

    const res = await outsider.get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({ email: "feed-noclass@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.get(`/api/v1/classes/${missingId}/posts`);

    expect(res.status).toBe(404);
  });

  it("returns an empty feed with hasMore false and nextCursor null", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-empty@example.com");

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toEqual([]);
    expect(res.body.meta).toEqual({ hasMore: false, nextCursor: null });
  });

  it("returns for an active member", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("feed-member@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "feed-member-2@example.com");
    await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: "Post 1", content: "C" });

    const res = await student.get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(1);
  });

  it("populates the post author on every feed row", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-author@example.com");
    await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: "Post 1", content: "C" });

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(1);
    expect(res.body.data.posts[0].authorId).toMatchObject({
      name: "Test User",
      role: "teacher",
    });
    expect(res.body.data.posts[0].authorId._id).toBeDefined();
  });

  it("stays readable on an archived class", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-archived@example.com");
    await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: "Post 1", content: "C" });
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(1);
  });

  it("defaults to 20 per page when limit is omitted", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-default-limit@example.com");
    for (let i = 0; i < 25; i++) {
      await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: `Post ${i}`, content: "C" });
    }

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(20);
    expect(res.body.meta.hasMore).toBe(true);
  });

  it("clamps limit to 50 when a larger value is requested", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-clamp-limit@example.com");
    for (let i = 0; i < 55; i++) {
      await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: `Post ${i}`, content: "C" });
    }

    const res = await teacher.get(`/api/v1/classes/${classId}/posts?limit=1000`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(50);
  });

  it("falls back to the default on a non-numeric limit", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-nonnumeric-limit@example.com");
    for (let i = 0; i < 3; i++) {
      await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: `Post ${i}`, content: "C" });
    }

    const res = await teacher.get(`/api/v1/classes/${classId}/posts?limit=abc`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(3);
  });

  it("422s for a malformed/unparsable cursor token", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-badcursor@example.com");

    const res = await teacher.get(`/api/v1/classes/${classId}/posts?cursor=not-a-valid-cursor`);

    expect(res.status).toBe(422);
  });

  it("422s for a cursor with a tampered/invalid _id", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-tamperedcursor@example.com");
    const badToken = Buffer.from(
      JSON.stringify({ createdAt: new Date().toISOString(), _id: "not-an-object-id", isPinned: false }),
      "utf8",
    ).toString("base64url");

    const res = await teacher.get(`/api/v1/classes/${classId}/posts?cursor=${badToken}`);

    expect(res.status).toBe(422);
  });

  it("orders posts by (createdAt, _id) descending", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-order@example.com");
    const first = await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: "First", content: "C" });
    const second = await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: "Second", content: "C" });

    const res = await teacher.get(`/api/v1/classes/${classId}/posts`);

    expect(res.body.data.posts[0]._id).toBe(second.body.data.post._id);
    expect(res.body.data.posts[1]._id).toBe(first.body.data.post._id);
  });

  it(
    "cursor stability across pages with identical createdAt values",
    async () => {
      const { teacher, classId } = await createClassAndTeacher("feed-samecreatedat@example.com");
      const authorId = (await teacher.get("/api/v1/users/me")).body.data.user._id;
      const sameInstant = new Date("2026-08-17T12:00:00.000Z");

      // Seed directly via the model with an identical, explicitly-set
      // createdAt (real-time execution can't reliably collide within the
      // same millisecond), distinct _ids -- _id is the tiebreaker.
      const seeded = [];
      for (let i = 0; i < 7; i++) {
        const doc = await Post.create({
          title: `Same-instant post ${i}`,
          content: "C",
          classId,
          authorId,
        });
        await Post.updateOne({ _id: doc._id }, { $set: { createdAt: sameInstant } });
        seeded.push(doc._id.toString());
      }

      const seen = [];
      let cursor;
      let hasMore = true;
      while (hasMore) {
        const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=2` : "?limit=2";
        const res = await teacher.get(`/api/v1/classes/${classId}/posts${qs}`);
        expect(res.status).toBe(200);
        seen.push(...res.body.data.posts.map((p) => p._id));
        hasMore = res.body.meta.hasMore;
        cursor = res.body.meta.nextCursor;
      }

      expect(seen).toHaveLength(seeded.length);
      expect(new Set(seen).size).toBe(seeded.length);
      expect(seen.sort()).toEqual(seeded.sort());
    },
  );

  it("no duplicates or skips when a post is inserted between page fetches", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-insertion@example.com");
    const originalIds = [];
    for (let i = 0; i < 3; i++) {
      const res = await teacher.post(`/api/v1/classes/${classId}/posts`).send({
        title: `Original ${i}`,
        content: "C",
      });
      originalIds.push(res.body.data.post._id);
    }

    const page1 = await teacher.get(`/api/v1/classes/${classId}/posts?limit=2`);
    expect(page1.status).toBe(200);
    expect(page1.body.meta.hasMore).toBe(true);

    // Insert a post that sorts newer than everything already paginated.
    const insertedRes = await teacher.post(`/api/v1/classes/${classId}/posts`).send({
      title: "Inserted mid-pagination",
      content: "C",
    });
    const insertedId = insertedRes.body.data.post._id;

    const page2 = await teacher.get(
      `/api/v1/classes/${classId}/posts?cursor=${encodeURIComponent(page1.body.meta.nextCursor)}&limit=2`,
    );
    expect(page2.status).toBe(200);

    const seenIds = [...page1.body.data.posts, ...page2.body.data.posts].map((p) => p._id);
    // The newly inserted post sorts before the cursor boundary -- it must
    // not appear on page 2, and would only surface on a fresh page 1.
    expect(seenIds).not.toContain(insertedId);
    // Every originally-seeded item appears exactly once across both pages.
    for (const id of originalIds) {
      expect(seenIds.filter((x) => x === id)).toHaveLength(1);
    }
  });

  it("sets hasMore false and nextCursor null on the final page", async () => {
    const { teacher, classId } = await createClassAndTeacher("feed-final-page@example.com");
    for (let i = 0; i < 3; i++) {
      await teacher.post(`/api/v1/classes/${classId}/posts`).send({ title: `Post ${i}`, content: "C" });
    }

    const page1 = await teacher.get(`/api/v1/classes/${classId}/posts?limit=2`);
    expect(page1.body.meta.hasMore).toBe(true);

    const page2 = await teacher.get(
      `/api/v1/classes/${classId}/posts?cursor=${encodeURIComponent(page1.body.meta.nextCursor)}&limit=2`,
    );
    expect(page2.body.data.posts).toHaveLength(1);
    expect(page2.body.meta).toEqual({ hasMore: false, nextCursor: null });
  });
});
