import request from "supertest";
import mongoose from "mongoose";
import {MongoMemoryServer} from "mongodb-memory-server";
import app from "../server.js";

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

// authLimiter caps /auth/register at 50 requests per 15-minute window per
// IP, with no prior test bypass. The full suite (this file included) runs
// in one Jest process via --runInBand, so the limiter's per-process counter
// is shared across every test file. 60 registrations here proves the
// NODE_ENV=test skip actually disables the limiter rather than merely
// raising the ceiling.
describe("authLimiter — disabled in test environment", () => {
  it("allows more than 50 registrations without a 429", async () => {
    for (let i = 0; i < 60; i++) {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Rate Limit Probe",
          email: `rate-limit-probe-${i}@example.com`,
          password: "Passw0rd!",
          role: "student",
        });
      expect(res.status).toBe(201);
    }
  });
});
