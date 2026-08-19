const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Materials never touch real object storage in tests -- every storage
// operation is mocked so the suite needs no MinIO. This mirrors the
// service's own boundary: the service trusts headObject's return value as
// the source of truth for mimeType/size, so tests drive behavior entirely
// through these mocks.
jest.mock("../config/storage.js", () => ({
  presignPut: jest.fn().mockResolvedValue("https://mock-storage.test/presigned-put"),
  presignGet: jest.fn().mockResolvedValue("https://mock-storage.test/presigned-get"),
  headObject: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

const storage = require("../config/storage.js");
const app = require("../server.js");
const Material = require("../models/Material.model.js");

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

beforeEach(() => {
  jest.clearAllMocks();
  storage.presignPut.mockResolvedValue("https://mock-storage.test/presigned-put");
  storage.presignGet.mockResolvedValue("https://mock-storage.test/presigned-get");
  storage.deleteObject.mockResolvedValue(undefined);
  // Default: the object exists as a valid, in-range PDF -- individual
  // tests override with mockResolvedValueOnce/mockResolvedValueOnce(null)
  // for the not-found/oversize/disallowed-type cases.
  storage.headObject.mockResolvedValue({
    ContentType: "application/pdf",
    ContentLength: 1024,
  });
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
    .send({ name: "Materials Class", subject: "Physics" });
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
  expect(joinRes.status).toBe(201);
  const requestId = joinRes.body.data.joinRequest._id;
  const approveRes = await teacher.patch(`/api/v1/classes/requests/${requestId}/approve`);
  expect(approveRes.status).toBe(200);
  return student;
}

async function requestUploadUrl(teacher, classId, overrides = {}) {
  const res = await teacher
    .post(`/api/v1/classes/${classId}/materials/upload-url`)
    .send({ fileName: "notes.pdf", mimeType: "application/pdf", size: 1024, ...overrides });
  return res;
}

async function createMaterial(teacher, classId, overrides = {}) {
  const uploadRes = await requestUploadUrl(teacher, classId);
  expect(uploadRes.status).toBe(200);
  const { storageKey } = uploadRes.body.data;

  const confirmRes = await teacher
    .post(`/api/v1/classes/${classId}/materials`)
    .send({ storageKey, title: "Lecture Notes", fileName: "notes.pdf", ...overrides });
  expect(confirmRes.status).toBe(201);
  return confirmRes.body.data.material;
}

describe("POST /classes/:classId/materials/upload-url", () => {
  it("issues an upload URL for the class owner (200)", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-upload-owner@example.com");

    const res = await requestUploadUrl(teacher, classId);

    expect(res.status).toBe(200);
    expect(res.body.data.uploadUrl).toBe("https://mock-storage.test/presigned-put");
    expect(res.body.data.storageKey).toContain(`classes/${classId}/`);
  });

  it("401s when unauthenticated", async () => {
    const { classId } = await createClassAndTeacher("mat-upload-unauth@example.com");

    const res = await request(app)
      .post(`/api/v1/classes/${classId}/materials/upload-url`)
      .send({ fileName: "notes.pdf", mimeType: "application/pdf", size: 1024 });

    expect(res.status).toBe(401);
  });

  it("403s for a student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("mat-upload-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "mat-upload-student-2@example.com");

    const res = await requestUploadUrl(student, classId);

    expect(res.status).toBe(403);
  });

  it("403s for a teacher who does not own the class", async () => {
    const { classId } = await createClassAndTeacher("mat-upload-otherteacher@example.com");
    const otherTeacher = await registerAndLogin({
      email: "mat-upload-otherteacher-2@example.com",
      role: "teacher",
    });

    const res = await requestUploadUrl(otherTeacher, classId);

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-upload-archived@example.com");
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await requestUploadUrl(teacher, classId);

    expect(res.status).toBe(403);
  });

  it("400s for a disallowed MIME type", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-upload-badtype@example.com");

    const res = await requestUploadUrl(teacher, classId, {
      fileName: "virus.exe",
      mimeType: "application/x-msdownload",
    });

    expect(res.status).toBe(400);
    expect(storage.presignPut).not.toHaveBeenCalled();
  });

  it("400s for a file over the 25MB limit", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-upload-toobig@example.com");

    const res = await requestUploadUrl(teacher, classId, { size: 26 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(storage.presignPut).not.toHaveBeenCalled();
  });

  it("422s when a required field is missing", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-upload-nofield@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/materials/upload-url`)
      .send({ fileName: "notes.pdf" });

    expect(res.status).toBe(422);
  });

  it("404s for a nonexistent classId", async () => {
    const teacher = await registerAndLogin({ email: "mat-upload-noclass@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await requestUploadUrl(teacher, missingId);

    expect(res.status).toBe(404);
  });
});

describe("POST /classes/:classId/materials (confirm)", () => {
  it("creates a material once the object is verified (201)", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-owner@example.com");

    const material = await createMaterial(teacher, classId);

    expect(material.title).toBe("Lecture Notes");
    expect(material.mimeType).toBe("application/pdf");
    expect(material.size).toBe(1024);
    expect(material.uploadedBy).toMatchObject({ name: "Test User", role: "teacher" });
  });

  it("never returns storageKey in the response", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-nokey@example.com");

    const material = await createMaterial(teacher, classId);

    expect(material.storageKey).toBeUndefined();
  });

  it("400s when the object was never actually uploaded", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-notfound@example.com");
    const uploadRes = await requestUploadUrl(teacher, classId);
    storage.headObject.mockResolvedValueOnce(null);

    const res = await teacher
      .post(`/api/v1/classes/${classId}/materials`)
      .send({
        storageKey: uploadRes.body.data.storageKey,
        title: "Lecture Notes",
        fileName: "notes.pdf",
      });

    expect(res.status).toBe(400);
  });

  it("400s when the storage key belongs to a different class", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-wrongclass@example.com");
    const { classId: otherClassId } = await createClassAndTeacher("mat-confirm-wrongclass-2@example.com");

    const res = await teacher
      .post(`/api/v1/classes/${classId}/materials`)
      .send({
        storageKey: `classes/${otherClassId}/forged.pdf`,
        title: "Lecture Notes",
        fileName: "notes.pdf",
      });

    expect(res.status).toBe(400);
  });

  it("400s when the real object's content type is disallowed", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-badtype@example.com");
    const uploadRes = await requestUploadUrl(teacher, classId);
    storage.headObject.mockResolvedValueOnce({
      ContentType: "application/x-msdownload",
      ContentLength: 1024,
    });

    const res = await teacher
      .post(`/api/v1/classes/${classId}/materials`)
      .send({
        storageKey: uploadRes.body.data.storageKey,
        title: "Lecture Notes",
        fileName: "notes.pdf",
      });

    expect(res.status).toBe(400);
  });

  it("400s when the real object exceeds the size limit", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-toobig@example.com");
    const uploadRes = await requestUploadUrl(teacher, classId);
    storage.headObject.mockResolvedValueOnce({
      ContentType: "application/pdf",
      ContentLength: 26 * 1024 * 1024,
    });

    const res = await teacher
      .post(`/api/v1/classes/${classId}/materials`)
      .send({
        storageKey: uploadRes.body.data.storageKey,
        title: "Lecture Notes",
        fileName: "notes.pdf",
      });

    expect(res.status).toBe(400);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-confirm-archived@example.com");
    const uploadRes = await requestUploadUrl(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher
      .post(`/api/v1/classes/${classId}/materials`)
      .send({
        storageKey: uploadRes.body.data.storageKey,
        title: "Lecture Notes",
        fileName: "notes.pdf",
      });

    expect(res.status).toBe(403);
  });
});

describe("GET /classes/:classId/materials", () => {
  it("returns an empty list with hasMore false and nextCursor null", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-list-empty@example.com");

    const res = await teacher.get(`/api/v1/classes/${classId}/materials`);

    expect(res.status).toBe(200);
    expect(res.body.data.materials).toEqual([]);
    expect(res.body.meta).toEqual({ hasMore: false, nextCursor: null });
  });

  it("401s when unauthenticated", async () => {
    const { classId } = await createClassAndTeacher("mat-list-unauth@example.com");

    const res = await request(app).get(`/api/v1/classes/${classId}/materials`);

    expect(res.status).toBe(401);
  });

  it("403s for a non-member", async () => {
    const { classId } = await createClassAndTeacher("mat-list-nonmember@example.com");
    const outsider = await registerAndLogin({ email: "mat-list-outsider@example.com", role: "student" });

    const res = await outsider.get(`/api/v1/classes/${classId}/materials`);

    expect(res.status).toBe(403);
  });

  it("returns for an active member and never leaks storageKey", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("mat-list-member@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "mat-list-member-2@example.com");
    await createMaterial(teacher, classId);

    const res = await student.get(`/api/v1/classes/${classId}/materials`);

    expect(res.status).toBe(200);
    expect(res.body.data.materials).toHaveLength(1);
    expect(res.body.data.materials[0].storageKey).toBeUndefined();
  });

  it("filters by q across title/description/fileName", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-list-search@example.com");
    await createMaterial(teacher, classId, { title: "Midterm Review", fileName: "midterm.pdf" });
    await createMaterial(teacher, classId, { title: "Syllabus", fileName: "syllabus.pdf" });

    const res = await teacher.get(`/api/v1/classes/${classId}/materials?q=midterm`);

    expect(res.status).toBe(200);
    expect(res.body.data.materials).toHaveLength(1);
    expect(res.body.data.materials[0].title).toBe("Midterm Review");
  });

  it("stays readable on an archived class", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-list-archived@example.com");
    await createMaterial(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.get(`/api/v1/classes/${classId}/materials`);

    expect(res.status).toBe(200);
    expect(res.body.data.materials).toHaveLength(1);
  });

  it("defaults to 20 per page and clamps limit to 50", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-list-limits@example.com");
    for (let i = 0; i < 22; i++) {
      await createMaterial(teacher, classId, { title: `Material ${i}` });
    }

    const defaultRes = await teacher.get(`/api/v1/classes/${classId}/materials`);
    expect(defaultRes.body.data.materials).toHaveLength(20);
    expect(defaultRes.body.meta.hasMore).toBe(true);

    const clampedRes = await teacher.get(`/api/v1/classes/${classId}/materials?limit=1000`);
    expect(clampedRes.body.data.materials).toHaveLength(22);
  });
});

describe("GET /materials/:materialId", () => {
  it("returns metadata only, no storageKey", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-get-owner@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await teacher.get(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.material.title).toBe("Lecture Notes");
    expect(res.body.data.material.storageKey).toBeUndefined();
  });

  it("403s for a non-member", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-get-nonmember@example.com");
    const material = await createMaterial(teacher, classId);
    const outsider = await registerAndLogin({ email: "mat-get-outsider@example.com", role: "student" });

    const res = await outsider.get(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent materialId", async () => {
    const teacher = await registerAndLogin({ email: "mat-get-nomaterial@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.get(`/api/v1/materials/${missingId}`);

    expect(res.status).toBe(404);
  });
});

describe("GET /materials/:materialId/download-url", () => {
  it("returns a presigned download URL for a member", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("mat-download-member@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "mat-download-member-2@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await student.get(`/api/v1/materials/${material._id}/download-url`);

    expect(res.status).toBe(200);
    expect(res.body.data.downloadUrl).toBe("https://mock-storage.test/presigned-get");
    expect(res.body.data.fileName).toBe("notes.pdf");
  });

  it("403s for a non-member", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-download-nonmember@example.com");
    const material = await createMaterial(teacher, classId);
    const outsider = await registerAndLogin({ email: "mat-download-outsider@example.com", role: "student" });

    const res = await outsider.get(`/api/v1/materials/${material._id}/download-url`);

    expect(res.status).toBe(403);
  });

  it("stays downloadable on an archived class", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-download-archived@example.com");
    const material = await createMaterial(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.get(`/api/v1/materials/${material._id}/download-url`);

    expect(res.status).toBe(200);
  });
});

describe("PATCH /materials/:materialId", () => {
  it("owner can update title and description", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-patch-owner@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await teacher
      .patch(`/api/v1/materials/${material._id}`)
      .send({ title: "Updated Title", description: "New description" });

    expect(res.status).toBe(200);
    expect(res.body.data.material.title).toBe("Updated Title");
    expect(res.body.data.material.description).toBe("New description");
  });

  it("403s a student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("mat-patch-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "mat-patch-student-2@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await student.patch(`/api/v1/materials/${material._id}`).send({ title: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("403s a teacher who does not own the class", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-patch-otherteacher@example.com");
    const material = await createMaterial(teacher, classId);
    const otherTeacher = await registerAndLogin({
      email: "mat-patch-otherteacher-2@example.com",
      role: "teacher",
    });

    const res = await otherTeacher.patch(`/api/v1/materials/${material._id}`).send({ title: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-patch-archived@example.com");
    const material = await createMaterial(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.patch(`/api/v1/materials/${material._id}`).send({ title: "Updated" });

    expect(res.status).toBe(403);
  });

  it("422s on an empty body", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-patch-empty@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await teacher.patch(`/api/v1/materials/${material._id}`).send({});

    expect(res.status).toBe(422);
  });

  it("404s for a nonexistent materialId", async () => {
    const teacher = await registerAndLogin({ email: "mat-patch-nomaterial@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.patch(`/api/v1/materials/${missingId}`).send({ title: "Updated" });

    expect(res.status).toBe(404);
  });
});

describe("POST /materials/:materialId/replace-url + swap via PATCH", () => {
  it("issues a new key distinct from the original", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-replace-newkey@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await teacher
      .post(`/api/v1/materials/${material._id}/replace-url`)
      .send({ fileName: "v2.pdf", mimeType: "application/pdf", size: 2048 });

    expect(res.status).toBe(200);
    expect(res.body.data.storageKey).toContain(`classes/${classId}/`);
  });

  it("403s a non-owner requesting a replace URL", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("mat-replace-nonowner@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "mat-replace-nonowner-2@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await student
      .post(`/api/v1/materials/${material._id}/replace-url`)
      .send({ fileName: "v2.pdf", mimeType: "application/pdf", size: 2048 });

    expect(res.status).toBe(403);
  });

  it("swaps the object and deletes the old one on confirm via PATCH", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-replace-swap@example.com");
    const material = await createMaterial(teacher, classId);

    const replaceRes = await teacher
      .post(`/api/v1/materials/${material._id}/replace-url`)
      .send({ fileName: "v2.pdf", mimeType: "application/pdf", size: 2048 });
    const newStorageKey = replaceRes.body.data.storageKey;

    storage.headObject.mockResolvedValueOnce({ ContentType: "application/pdf", ContentLength: 2048 });

    const patchRes = await teacher
      .patch(`/api/v1/materials/${material._id}`)
      .send({ storageKey: newStorageKey, fileName: "v2.pdf" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.material.size).toBe(2048);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("400s the swap when the new object was never uploaded", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-replace-notfound@example.com");
    const material = await createMaterial(teacher, classId);

    const replaceRes = await teacher
      .post(`/api/v1/materials/${material._id}/replace-url`)
      .send({ fileName: "v2.pdf", mimeType: "application/pdf", size: 2048 });
    const newStorageKey = replaceRes.body.data.storageKey;

    storage.headObject.mockResolvedValueOnce(null);

    const patchRes = await teacher
      .patch(`/api/v1/materials/${material._id}`)
      .send({ storageKey: newStorageKey, fileName: "v2.pdf" });

    expect(patchRes.status).toBe(400);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});

describe("DELETE /materials/:materialId", () => {
  it("owner can delete (204) and the record is gone", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-delete-owner@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await teacher.delete(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(204);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);

    const dbMaterial = await Material.findById(material._id);
    expect(dbMaterial).toBeNull();
  });

  it("still removes the metadata record when the object delete fails", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-delete-orphan@example.com");
    const material = await createMaterial(teacher, classId);
    storage.deleteObject.mockRejectedValueOnce(new Error("storage unavailable"));

    const res = await teacher.delete(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(204);
    const dbMaterial = await Material.findById(material._id);
    expect(dbMaterial).toBeNull();
  });

  it("403s a student", async () => {
    const { teacher, classId, joinCode } = await createClassAndTeacher("mat-delete-student@example.com");
    const student = await joinAndApprove(teacher, classId, joinCode, "mat-delete-student-2@example.com");
    const material = await createMaterial(teacher, classId);

    const res = await student.delete(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(403);
  });

  it("403s a teacher who does not own the class", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-delete-otherteacher@example.com");
    const material = await createMaterial(teacher, classId);
    const otherTeacher = await registerAndLogin({
      email: "mat-delete-otherteacher-2@example.com",
      role: "teacher",
    });

    const res = await otherTeacher.delete(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(403);
  });

  it("403s when the class is archived", async () => {
    const { teacher, classId } = await createClassAndTeacher("mat-delete-archived@example.com");
    const material = await createMaterial(teacher, classId);
    await teacher.post(`/api/v1/classes/${classId}/archive`);

    const res = await teacher.delete(`/api/v1/materials/${material._id}`);

    expect(res.status).toBe(403);
  });

  it("404s for a nonexistent materialId", async () => {
    const teacher = await registerAndLogin({ email: "mat-delete-nomaterial@example.com", role: "teacher" });
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await teacher.delete(`/api/v1/materials/${missingId}`);

    expect(res.status).toBe(404);
  });
});
