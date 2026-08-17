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

describe("GET /api/v1/classes", () => {
  it("includes the populated owner on each class card", async () => {
    const agent = request.agent(app);

    const registerRes = await agent.post("/api/v1/auth/register").send({
      name: "Teacher One",
      email: "teacher-owner@example.com",
      password: "Passw0rd!",
      role: "teacher",
    });
    expect(registerRes.status).toBe(201);

    const createRes = await agent
      .post("/api/v1/classes")
      .send({ name: "Algebra I", subject: "Math" });
    expect(createRes.status).toBe(201);

    const listRes = await agent.get("/api/v1/classes");
    expect(listRes.status).toBe(200);

    const [classCard] = listRes.body.data.classes;
    expect(classCard.owner).toMatchObject({
      name: "Teacher One",
      email: "teacher-owner@example.com",
      role: "teacher",
    });
    expect(classCard.owner._id).toBeDefined();
  });

  // The edit form (client Phase 3, item 10) prefills from this list
  // response. Without description/college/semester in the projection, a
  // prefill-then-save round trip would silently wipe those fields on
  // every class whose card the teacher never explicitly re-entered them
  // into.
  it("includes description, college and semester on each class card", async () => {
    const agent = request.agent(app);

    const registerRes = await agent.post("/api/v1/auth/register").send({
      name: "Teacher Two",
      email: "teacher-owner-2@example.com",
      password: "Passw0rd!",
      role: "teacher",
    });
    expect(registerRes.status).toBe(201);

    const createRes = await agent.post("/api/v1/classes").send({
      name: "Calculus II",
      subject: "Math",
    });
    expect(createRes.status).toBe(201);
    const classId = createRes.body.data.class.id;

    await agent.patch(`/api/v1/classes/${classId}`).send({
      description: "Integration and series",
      college: "MIT",
      semester: "Spring 2027",
    });

    const listRes = await agent.get("/api/v1/classes");
    expect(listRes.status).toBe(200);

    const classCard = listRes.body.data.classes.find(
      (c) => c.id === classId,
    );
    expect(classCard.description).toBe("Integration and series");
    expect(classCard.college).toBe("MIT");
    expect(classCard.semester).toBe("Spring 2027");
  });

  // Regression guard for the bug this DTO unification fixes: every
  // class-mutation endpoint used to return the raw Mongoose document
  // (unpopulated owner, no code/studentCount/lastActivity/status), which
  // fails the client's ClassDtoSchema. A mutation response must now carry
  // the exact same card shape as a GET /classes list row.
  it("returns the same card shape from a mutation response as from the list", async () => {
    const agent = request.agent(app);

    const registerRes = await agent.post("/api/v1/auth/register").send({
      name: "Teacher Three",
      email: "teacher-owner-3@example.com",
      password: "Passw0rd!",
      role: "teacher",
    });
    expect(registerRes.status).toBe(201);

    const createRes = await agent
      .post("/api/v1/classes")
      .send({ name: "Geometry", subject: "Math" });
    expect(createRes.status).toBe(201);

    const mutationCard = createRes.body.data.class;

    expect(mutationCard).toMatchObject({
      name: "Geometry",
      subject: "Math",
      studentCount: 0,
      status: "active",
    });
    expect(mutationCard.id).toBeDefined();
    expect(mutationCard.code).toBeDefined();
    expect(mutationCard.createdAt).toBeDefined();
    expect(mutationCard.owner).toMatchObject({
      name: "Teacher Three",
      email: "teacher-owner-3@example.com",
      role: "teacher",
    });
    expect(mutationCard.owner._id).toBeDefined();
    expect(mutationCard._id).toBeUndefined();
    expect(mutationCard.joinCode).toBeUndefined();

    const listRes = await agent.get("/api/v1/classes");
    expect(listRes.status).toBe(200);
    const listCard = listRes.body.data.classes.find(
      (c) => c.id === mutationCard.id,
    );

    expect(Object.keys(listCard).sort()).toEqual(
      Object.keys(mutationCard).sort(),
    );
    expect(listCard).toMatchObject({
      id: mutationCard.id,
      name: mutationCard.name,
      code: mutationCard.code,
      status: mutationCard.status,
    });
  });
});
