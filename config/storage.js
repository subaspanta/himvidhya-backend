import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REQUIRED_ENV_VARS = [
  "S3_ENDPOINT",
  "S3_PUBLIC_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "S3_REGION",
];

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_URL_EXPIRY_SECONDS = 5 * 60;

function assertStorageEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Object storage is not configured: missing ${missing.join(", ")}`,
    );
  }
}

let internalClient;
let publicClient;

function buildClient(endpoint) {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION,
    forcePathStyle: true, // required for MinIO-style path addressing
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

function getInternalClient() {
  assertStorageEnv();
  if (!internalClient) {
    internalClient = buildClient(process.env.S3_ENDPOINT);
  }
  return internalClient;
}

function getPublicClient() {
  assertStorageEnv();
  if (!publicClient) {
    publicClient = buildClient(process.env.S3_PUBLIC_ENDPOINT);
  }
  return publicClient;
}

function getBucket() {
  assertStorageEnv();
  return process.env.S3_BUCKET;
}

const presignPut = async (
  key,
  { contentType, expiresIn = UPLOAD_URL_EXPIRY_SECONDS } = {},
) => {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getPublicClient(), command, { expiresIn });
};

const presignGet = async (
  key,
  { expiresIn = DOWNLOAD_URL_EXPIRY_SECONDS } = {},
) => {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(getPublicClient(), command, { expiresIn });
};

const headObject = async (key) => {
  try {
    return await getInternalClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    );
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
};

const deleteObject = async (key) => {
  await getInternalClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
};

export { presignPut, presignGet, headObject, deleteObject, assertStorageEnv };
