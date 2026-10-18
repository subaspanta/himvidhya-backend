import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/storage.js", () => ({
  presignPut: jest
    .fn()
    .mockResolvedValue("https://mock-storage.test/presigned-put"),
  presignGet: jest
    .fn()
    .mockResolvedValue("https://mock-storage.test/presigned-get"),
  headObject: jest.fn().mockResolvedValue({
    ContentType: "application/pdf",
    ContentLength: 1024,
  }),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

const storage = await import("../config/storage.js");
const { default: app } = await import("../server.js");
const { default: Post } = await import("../models/Post.model.js");

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
  storage.presignPut.mockResolvedValue(
    "https://mock-storage.test/presigned-put",
  );
  storage.presignGet.mockResolvedValue(
    "https://mock-storage.test/presigned-get",
  );
  storage.headObject.mockResolvedValue({
    ContentType: "application/pdf",
    ContentLength: 1024,
  });
  storage.deleteObject.mockResolvedValue(undefined);
});

async function registerAndLogin(email, role) {
  const agent = request.agent(app);
  const response = await agent.post("/api/v1/auth/register").send({
    name: "Attachment Tester",
    email,
    role,
    password: "Passw0rd!",
  });
  expect(response.status).toBe(201);
  return agent;
}

async function createClass(email) {
  const teacher = await registerAndLogin(email, "teacher");
  const response = await teacher.post("/api/v1/classes").send({
    name: "Attachment Class",
    subject: "Media",
  });
  expect(response.status).toBe(201);
  return {
    teacher,
    classId: response.body.data.class.id,
    joinCode: response.body.data.class.code,
  };
}

async function joinClass(teacher, classId, joinCode, email) {
  const student = await registerAndLogin(email, "student");
  const joinResponse = await student
    .post("/api/v1/classes/join")
    .send({ code: joinCode });
  const requestId = joinResponse.body.data.joinRequest._id;
  const approval = await teacher.patch(
    `/api/v1/classes/requests/${requestId}/approve`,
  );
  expect(approval.status).toBe(200);
  return student;
}

async function requestUpload(teacher, classId) {
  return teacher
    .post(`/api/v1/classes/${classId}/posts/attachment-upload-url`)
    .send({
      fileName: "lesson.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
}

async function createPostWithFile(teacher, classId) {
  const upload = await requestUpload(teacher, classId);
  expect(upload.status).toBe(200);
  const response = await teacher
    .post(`/api/v1/classes/${classId}/posts`)
    .send({
      title: "Resources",
      content: "Use these resources for the lesson.",
      attachments: [
        {
          type: "file",
          fileName: "lesson.pdf",
          storageKey: upload.body.data.storageKey,
        },
      ],
    });
  expect(response.status).toBe(201);
  return response.body.data.post;
}

describe("post attachment lifecycle", () => {
  it("issues a presigned upload URL only to the class owner", async () => {
    const { teacher, classId, joinCode } = await createClass(
      "attachment-upload-owner@example.com",
    );
    const student = await joinClass(
      teacher,
      classId,
      joinCode,
      "attachment-upload-student@example.com",
    );

    const ownerResponse = await requestUpload(teacher, classId);
    const studentResponse = await requestUpload(student, classId);

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.data.uploadUrl).toBe(
      "https://mock-storage.test/presigned-put",
    );
    expect(ownerResponse.body.data.storageKey).toContain(
      `classes/${classId}/`,
    );
    expect(studentResponse.status).toBe(403);
  });

  it("creates file, link, and YouTube attachments without leaking storage keys", async () => {
    const { teacher, classId } = await createClass(
      "attachment-create@example.com",
    );
    const upload = await requestUpload(teacher, classId);

    const response = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({
        title: "Mixed resources",
        content: "A file and two useful links.",
        attachments: [
          {
            type: "file",
            fileName: "lesson.pdf",
            storageKey: upload.body.data.storageKey,
          },
          { type: "link", url: "https://example.com/reference" },
          {
            type: "youtube",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.post.attachments).toHaveLength(3);
    expect(response.body.data.post.attachments[0]).toMatchObject({
      type: "file",
      fileName: "lesson.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
    expect(response.body.data.post.attachments[0].storageKey).toBeUndefined();
    expect(response.body.data.post.attachments[2].thumbnailUrl).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );

    const stored = await Post.findById(response.body.data.post._id).select(
      "+attachments.storageKey",
    );
    expect(stored.attachments[0].storageKey).toBe(
      upload.body.data.storageKey,
    );
  });

  it("rejects non-HTTP links at validation", async () => {
    const { teacher, classId } = await createClass(
      "attachment-protocol@example.com",
    );

    const response = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({
        title: "Unsafe link",
        content: "This must not be accepted.",
        attachments: [{ type: "link", url: "ftp://example.com/file.pdf" }],
      });

    expect(response.status).toBe(422);
  });

  it("rejects a lookalike YouTube URL", async () => {
    const { teacher, classId } = await createClass(
      "attachment-youtube-lookalike@example.com",
    );

    const response = await teacher
      .post(`/api/v1/classes/${classId}/posts`)
      .send({
        title: "Unsafe video",
        content: "This must not be accepted.",
        attachments: [
          {
            type: "youtube",
            url: "https://example.com/youtube.com/watch?v=dQw4w9WgXcQ",
          },
        ],
      });

    expect(response.status).toBe(400);
  });

  it("lets an active member obtain a fresh download URL", async () => {
    const { teacher, classId, joinCode } = await createClass(
      "attachment-download-owner@example.com",
    );
    const student = await joinClass(
      teacher,
      classId,
      joinCode,
      "attachment-download-student@example.com",
    );
    const post = await createPostWithFile(teacher, classId);

    const response = await student.get(
      `/api/v1/posts/${post._id}/attachments/${post.attachments[0]._id}/download-url`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      downloadUrl: "https://mock-storage.test/presigned-get",
      fileName: "lesson.pdf",
    });
  });

  it("prevents a non-member from downloading an attachment", async () => {
    const { teacher, classId } = await createClass(
      "attachment-private-owner@example.com",
    );
    const outsider = await registerAndLogin(
      "attachment-private-outsider@example.com",
      "student",
    );
    const post = await createPostWithFile(teacher, classId);

    const response = await outsider.get(
      `/api/v1/posts/${post._id}/attachments/${post.attachments[0]._id}/download-url`,
    );

    expect(response.status).toBe(403);
    expect(storage.presignGet).not.toHaveBeenCalled();
  });

  it("stops serving an attachment after its post is deleted", async () => {
    const { teacher, classId } = await createClass(
      "attachment-deleted@example.com",
    );
    const post = await createPostWithFile(teacher, classId);
    await teacher.delete(`/api/v1/posts/${post._id}`);

    const response = await teacher.get(
      `/api/v1/posts/${post._id}/attachments/${post.attachments[0]._id}/download-url`,
    );

    expect(response.status).toBe(400);
    expect(storage.presignGet).not.toHaveBeenCalled();
  });
});
