/**
 * Opaque cursor pagination (ADR-0006, D13). Every paginated resource sorts
 * on the compound key (createdAt, _id); the cursor exposed to clients is an
 * opaque token encoding that position -- clients must never construct or
 * parse it.
 *
 * Deliberately generic: this module has no concept of any specific
 * resource's ordering quirks (e.g. Posts' pinned-first feed). A resource
 * with extra partitioning state layers it on top of encodeCursor/
 * decodeCursor's payload -- see services/post.service.js -- without this
 * file needing to know that resource exists. That's what keeps this one
 * utility reusable, unmodified, by Comments/Materials/Notifications later.
 */

import mongoose from "mongoose";

import { UnprocessableEntityError } from "./error/errors.js";

const MAX_PAGE_SIZE = 50; // D14 hard maximum, resource-agnostic

/**
 * Encodes an arbitrary JSON-serializable payload into an opaque, URL-safe
 * token. No opinion on payload shape beyond "JSON-serializable plain
 * object" -- every resource's cursor is at minimum { createdAt, _id }, but
 * extra fields (e.g. isPinned) pass through untouched.
 */
const encodeCursor = (payload) => {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

/**
 * Decodes a cursor token back into a plain object, validating the two
 * fields every (createdAt, _id)-sorted resource needs. Throws
 * UnprocessableEntityError (422, D13/API Contract §5.3) for anything
 * malformed -- not a 400, and not a silently-empty page.
 *
 * A cursor is a value boundary, not a document reference: decoding never
 * touches the database, so a cursor pointing at a since-deleted or
 * since-edited document isn't "stale" in any way that matters here -- it's
 * still a valid comparison point.
 */
const decodeCursor = (token) => {
  if (typeof token !== "string" || token.length === 0) {
    throw new UnprocessableEntityError("Invalid or malformed cursor");
  }

  let payload;
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    payload = JSON.parse(json);
  } catch {
    throw new UnprocessableEntityError("Invalid or malformed cursor");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new UnprocessableEntityError("Invalid or malformed cursor");
  }

  const createdAt = new Date(payload.createdAt);
  if (
    typeof payload.createdAt !== "string" ||
    Number.isNaN(createdAt.getTime())
  ) {
    throw new UnprocessableEntityError("Invalid or malformed cursor");
  }

  if (
    typeof payload._id !== "string" ||
    !mongoose.Types.ObjectId.isValid(payload._id)
  ) {
    throw new UnprocessableEntityError("Invalid or malformed cursor");
  }

  return { ...payload, createdAt, _id: payload._id };
};

/**
 * Builds the $or comparator for a (createdAt, _id) compound sort in the
 * requested direction. Pure and resource-agnostic -- no knowledge of
 * isPinned or any other partitioning field. Returns {} for a first page
 * (no cursor).
 */
const buildCursorQuery = ({ cursor, direction = "desc" } = {}) => {
  if (!cursor) return {};
  const { createdAt, _id } = cursor;
  const cmp = direction === "asc" ? "$gt" : "$lt";
  return {
    $or: [
      { createdAt: { [cmp]: createdAt } },
      { createdAt, _id: { [cmp]: _id } },
    ],
  };
};

/**
 * Limit clamping (D14): missing/invalid -> default; above the hard max ->
 * clamped, never rejected. Deliberately lenient -- unlike an invalid
 * cursor, a bad limit always has an obviously safe fallback, so there's no
 * 422 path here.
 */
const clampLimit = (rawLimit, { defaultLimit, maxLimit = MAX_PAGE_SIZE }) => {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultLimit;
  return Math.min(Math.floor(parsed), maxLimit);
};

/**
 * Meta builder. Callers encode nextCursor (via encodeCursor, with whatever
 * payload shape their resource needs) before calling this -- it only
 * enforces the nextCursor-is-null-when-hasMore-is-false contract.
 */
const buildPageMeta = ({ hasMore, nextCursor = null }) => {
  return { hasMore: Boolean(hasMore), nextCursor: hasMore ? nextCursor : null };
};

export {
  MAX_PAGE_SIZE,
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
};
