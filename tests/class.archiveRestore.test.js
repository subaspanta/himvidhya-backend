import request from "supertest";
import mongoose from "mongoose";
import {MongoMemoryServer} from "mongodb-memory-server";
import app from "../server.js";
import Class from "../models/Class.model.js";

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

describe("POST /api/v1/classes/:classId/archive", () => {
  it("returns 403 for a non-owner teacher", async () => {
    const owner = await registerAndLogin({
      email: "archive2-owner-1@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "archive2-other-1@example.com",
      role: "teacher",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "History", subject: "History" });
    const classId = createRes.body.data.class.id;

    const res = await otherTeacher.post(`/api/v1/classes/${classId}/archive`);
    expect(res.status).toBe(403);
  });

  it("archives an active class for its owner", async () => {
    const teacher = await registerAndLogin({
      email: "archive2-owner-2@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Geography", subject: "Geography" });
    const classId = createRes.body.data.class.id;

    const res = await teacher.post(`/api/v1/classes/${classId}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.data.class.status).toBe("archived");

    const persisted = await Class.findById(classId).lean();
    expect(persisted.status).toBe("archived");
  });

  it("returns 409 when archiving an already-archived class", async () => {
    const teacher = await registerAndLogin({
      email: "archive2-owner-3@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Art", subject: "Art" });
    const classId = createRes.body.data.class.id;

    const firstRes = await teacher.post(`/api/v1/classes/${classId}/archive`);
    expect(firstRes.status).toBe(200);

    const secondRes = await teacher.post(
      `/api/v1/classes/${classId}/archive`,
    );
    expect(secondRes.status).toBe(409);
  });

  it("returns 404 for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({
      email: "archive2-owner-4@example.com",
      role: "teacher",
    });

    const res = await teacher.post(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/archive`,
    );
    expect(res.status).toBe(404);
  });

  it("keeps an archived class readable for the owner (C5 regression)", async () => {
    const teacher = await registerAndLogin({
      email: "archive2-owner-5@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Music", subject: "Music" });
    const classId = createRes.body.data.class.id;

    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const readRes = await teacher.get(`/api/v1/classes/${classId}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.class.status).toBe("archived");
  });
});

describe("POST /api/v1/classes/:classId/restore", () => {
  it("returns 403 for a non-owner teacher", async () => {
    const owner = await registerAndLogin({
      email: "restore-owner-1@example.com",
      role: "teacher",
    });
    const otherTeacher = await registerAndLogin({
      email: "restore-other-1@example.com",
      role: "teacher",
    });

    const createRes = await owner
      .post("/api/v1/classes")
      .send({ name: "Economics", subject: "Economics" });
    const classId = createRes.body.data.class.id;
    await owner.post(`/api/v1/classes/${classId}/archive`);

    const res = await otherTeacher.post(`/api/v1/classes/${classId}/restore`);
    expect(res.status).toBe(403);
  });

  it("restores an archived class for its owner", async () => {
    const teacher = await registerAndLogin({
      email: "restore-owner-2@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Statistics", subject: "Math" });
    const classId = createRes.body.data.class.id;
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.post(`/api/v1/classes/${classId}/restore`);
    expect(res.status).toBe(200);
    expect(res.body.data.class.status).toBe("active");

    const persisted = await Class.findById(classId).lean();
    expect(persisted.status).toBe("active");
  });

  it("returns 409 when restoring an already-active class", async () => {
    const teacher = await registerAndLogin({
      email: "restore-owner-3@example.com",
      role: "teacher",
    });

    const createRes = await teacher
      .post("/api/v1/classes")
      .send({ name: "Philosophy", subject: "Philosophy" });
    const classId = createRes.body.data.class.id;

    const res = await teacher.post(`/api/v1/classes/${classId}/restore`);
    expect(res.status).toBe(409);
  });

  it("returns 404 for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({
      email: "restore-owner-4@example.com",
      role: "teacher",
    });

    const res = await teacher.post(
      `/api/v1/classes/${new mongoose.Types.ObjectId()}/restore`,
    );
    expect(res.status).toBe(404);
  });
});
