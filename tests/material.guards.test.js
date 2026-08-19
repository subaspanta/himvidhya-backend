const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Material = require("../models/Material.model.js");
const User = require("../models/User.model.js");
const { loadMaterialOrThrow } = require("../services/guards/material.guards.js");
const { NotFoundError } = require("../utils/error/errors.js");

let mongod;
let uploader;

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
  uploader = await User.create({
    name: "Material Uploader",
    email: `uploader-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: "hashedpassword",
    role: "teacher",
  });
});

afterEach(async () => {
  await Promise.all([Material.deleteMany({}), User.deleteMany({})]);
});

async function createMaterial(overrides = {}) {
  return Material.create({
    title: "Guarded Material",
    fileName: "notes.pdf",
    mimeType: "application/pdf",
    size: 1024,
    storageKey: `classes/${new mongoose.Types.ObjectId()}/${new mongoose.Types.ObjectId()}.pdf`,
    classId: new mongoose.Types.ObjectId(),
    uploadedBy: uploader._id,
    ...overrides,
  });
}

describe("loadMaterialOrThrow", () => {
  it("returns the material for an id that resolves", async () => {
    const material = await createMaterial();

    const loaded = await loadMaterialOrThrow(material._id);

    expect(loaded._id.toString()).toBe(material._id.toString());
  });

  it("throws NotFoundError for a nonexistent id", async () => {
    const missingId = new mongoose.Types.ObjectId();

    await expect(loadMaterialOrThrow(missingId)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError (not a cast error) for a malformed id", async () => {
    await expect(loadMaterialOrThrow("not-an-object-id")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("populates the uploader when requested", async () => {
    const material = await createMaterial();

    const loaded = await loadMaterialOrThrow(material._id, {
      populateUploader: true,
    });

    expect(loaded.uploadedBy.name).toBe("Material Uploader");
  });

  it("returns a lean plain object when lean: true", async () => {
    const material = await createMaterial();

    const loaded = await loadMaterialOrThrow(material._id, { lean: true });

    expect(typeof loaded.save).toBe("undefined");
  });
});
