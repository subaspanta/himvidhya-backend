const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Post = require("../models/Post.model.js");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Post.init();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Post.deleteMany({});
});

const baseFields = () => ({
  title: "Welcome to the class",
  content: "Please read the syllabus before our first session.",
  classId: new mongoose.Types.ObjectId(),
  authorId: new mongoose.Types.ObjectId(),
});

describe("Post model", () => {
  it("requires title", async () => {
    const doc = new Post({ ...baseFields(), title: undefined });
    await expect(doc.validate()).rejects.toThrow();
  });

  it("requires content", async () => {
    const doc = new Post({ ...baseFields(), content: undefined });
    await expect(doc.validate()).rejects.toThrow();
  });

  it("requires classId", async () => {
    const doc = new Post({ ...baseFields(), classId: undefined });
    await expect(doc.validate()).rejects.toThrow();
  });

  it("requires authorId", async () => {
    const doc = new Post({ ...baseFields(), authorId: undefined });
    await expect(doc.validate()).rejects.toThrow();
  });

  it("defaults isPinned to false", async () => {
    const doc = await Post.create(baseFields());
    expect(doc.isPinned).toBe(false);
  });

  it("defaults deletedAt to null", async () => {
    const doc = await Post.create(baseFields());
    expect(doc.deletedAt).toBeNull();
  });

  it("rejects a title longer than 200 characters", async () => {
    const doc = new Post({ ...baseFields(), title: "a".repeat(201) });
    await expect(doc.validate()).rejects.toThrow();
  });

  it("rejects content longer than 10000 characters", async () => {
    const doc = new Post({ ...baseFields(), content: "a".repeat(10001) });
    await expect(doc.validate()).rejects.toThrow();
  });

  it("defaults attachments to an empty array (D4 superseded)", async () => {
    const doc = await Post.create(baseFields());
    expect(doc.attachments).toEqual([]);
  });

  it("accepts file, link, and youtube attachments", async () => {
    const doc = await Post.create({
      ...baseFields(),
      attachments: [
        { type: "file", fileName: "notes.pdf", mimeType: "application/pdf", size: 100, storageKey: "classes/x/posts/y.pdf" },
        { type: "link", url: "https://example.com" },
        { type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
      ],
    });
    expect(doc.attachments).toHaveLength(3);
    expect(doc.attachments.map((a) => a.type)).toEqual(["file", "link", "youtube"]);
  });

  it("has the (classId, isPinned, createdAt, _id) compound index", async () => {
    const indexes = await Post.collection.indexes();
    const match = indexes.find(
      (idx) =>
        idx.key.classId === 1 &&
        idx.key.isPinned === 1 &&
        idx.key.createdAt === -1 &&
        idx.key._id === -1,
    );
    expect(match).toBeDefined();
  });
});
