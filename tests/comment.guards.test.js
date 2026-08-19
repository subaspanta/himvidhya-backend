const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Comment = require("../models/Comment.model.js");
const User = require("../models/User.model.js");
const {
  loadCommentOrThrow,
  assertCommentAuthor,
} = require("../services/guards/comment.guards.js");
const { ForbiddenError, NotFoundError } = require("../utils/error/errors.js");

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
    name: "Comment Author",
    email: `author-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "student",
  });

  otherUser = await User.create({
    name: "Someone Else",
    email: `other-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "student",
  });
});

afterEach(async () => {
  await Promise.all([Comment.deleteMany({}), User.deleteMany({})]);
});

async function createComment(overrides = {}) {
  return Comment.create({
    postId: new mongoose.Types.ObjectId(),
    authorId: author._id,
    content: "Content for guard tests",
    ...overrides,
  });
}

describe("loadCommentOrThrow", () => {
  it("returns the comment for an id that resolves", async () => {
    const comment = await createComment();

    const loaded = await loadCommentOrThrow(comment._id);

    expect(loaded._id.toString()).toBe(comment._id.toString());
  });

  it("throws NotFoundError for a nonexistent id", async () => {
    const missingId = new mongoose.Types.ObjectId();

    await expect(loadCommentOrThrow(missingId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws NotFoundError (not a cast error) for a malformed id", async () => {
    await expect(loadCommentOrThrow("not-an-object-id")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("populates the author when requested", async () => {
    const comment = await createComment();

    const loaded = await loadCommentOrThrow(comment._id, {
      populateAuthor: true,
    });

    expect(loaded.authorId.name).toBe("Comment Author");
  });

  it("returns a lean plain object when lean: true", async () => {
    const comment = await createComment();

    const loaded = await loadCommentOrThrow(comment._id, { lean: true });

    expect(typeof loaded.save).toBe("undefined");
  });
});

describe("assertCommentAuthor", () => {
  it("accepts the author when authorId is a raw ObjectId", async () => {
    const comment = await createComment();

    expect(() => assertCommentAuthor(comment, author._id)).not.toThrow();
  });

  it("accepts the author when authorId is a populated User subdocument", async () => {
    const comment = await createComment();
    const populated = await Comment.findById(comment._id).populate(
      "authorId",
    );

    expect(() =>
      assertCommentAuthor(populated, author._id),
    ).not.toThrow();
  });

  it("rejects a non-author with a raw ObjectId", async () => {
    const comment = await createComment();

    expect(() => assertCommentAuthor(comment, otherUser._id)).toThrow(
      ForbiddenError,
    );
  });

  it("rejects a non-author with a populated author", async () => {
    const comment = await createComment();
    const populated = await Comment.findById(comment._id).populate(
      "authorId",
    );

    expect(() =>
      assertCommentAuthor(populated, otherUser._id),
    ).toThrow(ForbiddenError);
  });

  it("compares identically on a lean comment document", async () => {
    const comment = await createComment();
    const lean = await Comment.findById(comment._id).lean();

    expect(() => assertCommentAuthor(lean, author._id)).not.toThrow();
    expect(() => assertCommentAuthor(lean, otherUser._id)).toThrow(
      ForbiddenError,
    );
  });

  it("uses a caller-supplied message when given", async () => {
    const comment = await createComment();

    expect(() =>
      assertCommentAuthor(comment, otherUser._id, {
        message: "Custom message",
      }),
    ).toThrow("Custom message");
  });
});
