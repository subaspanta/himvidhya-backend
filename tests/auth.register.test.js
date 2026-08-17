const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");

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

describe("POST /api/v1/auth/register", () => {
  const basePayload = {
    name: "Test User",
    password: "Passw0rd!",
  };

  it("registers a student and persists the role", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...basePayload, email: "student@example.com", role: "student" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("student");
  });

  it("registers a teacher and persists the role", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...basePayload, email: "teacher@example.com", role: "teacher" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("teacher");
  });

  it("rejects role: admin with a 422 validation error in the standard envelope", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...basePayload, email: "admin@example.com", role: "admin" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.timestamp).toBeDefined();
  });
});

describe("GET /api/v1/auth/me", () => {
  it("includes isActive on the current-user DTO", async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post("/api/v1/auth/register").send({
      name: "Test User",
      password: "Passw0rd!",
      email: "me-isactive@example.com",
      role: "student",
    });
    expect(registerRes.status).toBe(201);

    const res = await agent.get("/api/v1/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
  });
});
