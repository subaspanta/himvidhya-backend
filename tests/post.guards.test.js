import mongoose from "mongoose";
import {MongoMemoryServer} from "mongodb-memory-server";
import Post from "../models/Post.model.js";
import User from "../models/User.model.js";
import {loadPostOrThrow, assertPostAuthor} from "../services/guards/post.guards.js";
import {ForbiddenError, NotFoundError} from "../utils/error/errors.js";

let mongod;
let author;
let otherUser;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  author = await User.create({
    name: "Post Author",
    email: `author-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "teacher",
  });

  otherUser = await User.create({
    name: "Someone Else",
    email: `other-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "teacher",
  });
});

afterEach(async () => {
  await Promise.all([Post.deleteMany({}), User.deleteMany({})]);
});

async function createPost(overrides = {}) {
  return Post.create({
    title: "Guarded Post",
    content: "Content for guard tests",
    classId: new mongoose.Types.ObjectId(),
    authorId: author._id,
    ...overrides,
  });
}

describe("loadPostOrThrow", () => {
  it("returns the post for an id that resolves", async () => {
    const post = await createPost();

    const loaded = await loadPostOrThrow(post._id);

    expect(loaded._id.toString()).toBe(post._id.toString());
  });

  it("throws NotFoundError for a nonexistent id", async () => {
    const missingId = new mongoose.Types.ObjectId();

    await expect(loadPostOrThrow(missingId)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError (not a cast error) for a malformed id", async () => {
    await expect(loadPostOrThrow("not-an-object-id")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("populates the author when requested", async () => {
    const post = await createPost();

    const loaded = await loadPostOrThrow(post._id, { populateAuthor: true });

    expect(loaded.authorId.name).toBe("Post Author");
  });

  it("returns a lean plain object when lean: true", async () => {
    const post = await createPost();

    const loaded = await loadPostOrThrow(post._id, { lean: true });

    expect(typeof loaded.save).toBe("undefined");
  });
});

describe("assertPostAuthor", () => {
  it("accepts the author when authorId is a raw ObjectId", async () => {
    const post = await createPost();

    expect(() => assertPostAuthor(post, author._id)).not.toThrow();
  });

  it("accepts the author when authorId is a populated User subdocument", async () => {
    const post = await createPost();
    const populated = await Post.findById(post._id).populate("authorId");

    expect(() => assertPostAuthor(populated, author._id)).not.toThrow();
  });

  it("rejects a non-author with a raw ObjectId", async () => {
    const post = await createPost();

    expect(() => assertPostAuthor(post, otherUser._id)).toThrow(
      ForbiddenError,
    );
  });

  it("rejects a non-author with a populated author", async () => {
    const post = await createPost();
    const populated = await Post.findById(post._id).populate("authorId");

    expect(() => assertPostAuthor(populated, otherUser._id)).toThrow(
      ForbiddenError,
    );
  });

  it("compares identically on a lean post document", async () => {
    const post = await createPost();
    const lean = await Post.findById(post._id).lean();

    expect(() => assertPostAuthor(lean, author._id)).not.toThrow();
    expect(() => assertPostAuthor(lean, otherUser._id)).toThrow(
      ForbiddenError,
    );
  });

  it("uses a caller-supplied message when given", async () => {
    const post = await createPost();

    expect(() =>
      assertPostAuthor(post, otherUser._id, { message: "Custom message" }),
    ).toThrow("Custom message");
  });
});
