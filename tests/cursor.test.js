import {
  encodeCursor,
  decodeCursor,
  buildCursorQuery,
  clampLimit,
  buildPageMeta,
  MAX_PAGE_SIZE,
} from "../utils/cursor.js";

import {UnprocessableEntityError} from "../utils/error/errors.js";
import mongoose from "mongoose";

describe("cursor utility", () => {
  describe("encodeCursor / decodeCursor", () => {
    it("round-trips a { createdAt, _id } payload", () => {
      const id = new mongoose.Types.ObjectId().toString();
      const createdAt = new Date("2026-08-17T10:00:00.000Z").toISOString();
      const token = encodeCursor({ createdAt, _id: id });
      const decoded = decodeCursor(token);

      expect(decoded._id).toBe(id);
      expect(decoded.createdAt).toBeInstanceOf(Date);
      expect(decoded.createdAt.toISOString()).toBe(createdAt);
    });

    it("round-trips extra fields beyond createdAt/_id untouched", () => {
      const id = new mongoose.Types.ObjectId().toString();
      const createdAt = new Date().toISOString();
      const token = encodeCursor({ createdAt, _id: id, isPinned: true });
      const decoded = decodeCursor(token);

      expect(decoded.isPinned).toBe(true);
    });

    it("produces a URL-safe opaque token", () => {
      const token = encodeCursor({
        createdAt: new Date().toISOString(),
        _id: new mongoose.Types.ObjectId().toString(),
      });

      expect(token).not.toMatch(/[{}"+/=]/);
    });

    it.each([undefined, null, 123, {}, []])(
      "throws UnprocessableEntityError for non-string token: %p",
      (bad) => {
        expect(() => decodeCursor(bad)).toThrow(UnprocessableEntityError);
      },
    );

    it("throws UnprocessableEntityError for an empty string token", () => {
      expect(() => decodeCursor("")).toThrow(UnprocessableEntityError);
    });

    it("throws UnprocessableEntityError for a non-base64url-decodable string", () => {
      expect(() => decodeCursor("not!!valid!!base64url")).toThrow(
        UnprocessableEntityError,
      );
    });

    it("throws UnprocessableEntityError when the decoded payload isn't JSON", () => {
      const token = Buffer.from("not json", "utf8").toString("base64url");
      expect(() => decodeCursor(token)).toThrow(UnprocessableEntityError);
    });

    it.each([
      Buffer.from(JSON.stringify([1, 2, 3]), "utf8").toString("base64url"),
      Buffer.from(JSON.stringify("a string"), "utf8").toString("base64url"),
      Buffer.from(JSON.stringify(null), "utf8").toString("base64url"),
    ])(
      "throws UnprocessableEntityError when decoded JSON isn't a plain object: %p",
      (token) => {
        expect(() => decodeCursor(token)).toThrow(UnprocessableEntityError);
      },
    );

    it("throws UnprocessableEntityError when createdAt is missing", () => {
      const token = encodeCursor({
        _id: new mongoose.Types.ObjectId().toString(),
      });
      expect(() => decodeCursor(token)).toThrow(UnprocessableEntityError);
    });

    it("throws UnprocessableEntityError when createdAt is unparsable", () => {
      const token = encodeCursor({
        createdAt: "not-a-date",
        _id: new mongoose.Types.ObjectId().toString(),
      });
      expect(() => decodeCursor(token)).toThrow(UnprocessableEntityError);
    });

    it("throws UnprocessableEntityError when _id is missing", () => {
      const token = encodeCursor({ createdAt: new Date().toISOString() });
      expect(() => decodeCursor(token)).toThrow(UnprocessableEntityError);
    });

    it("throws UnprocessableEntityError when _id is not a valid ObjectId string", () => {
      const token = encodeCursor({
        createdAt: new Date().toISOString(),
        _id: "not-an-object-id",
      });
      expect(() => decodeCursor(token)).toThrow(UnprocessableEntityError);
    });
  });

  describe("buildCursorQuery", () => {
    it("returns {} when no cursor is given (first page)", () => {
      expect(buildCursorQuery({})).toEqual({});
      expect(buildCursorQuery({ cursor: null })).toEqual({});
    });

    it("builds the exact descending $or comparator shape", () => {
      const createdAt = new Date("2026-08-17T10:00:00.000Z");
      const _id = "64f0000000000000000000aa";
      const query = buildCursorQuery({
        cursor: { createdAt, _id },
        direction: "desc",
      });

      expect(query).toEqual({
        $or: [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: _id } },
        ],
      });
    });

    it("builds the exact ascending $or comparator shape", () => {
      const createdAt = new Date("2026-08-17T10:00:00.000Z");
      const _id = "64f0000000000000000000aa";
      const query = buildCursorQuery({
        cursor: { createdAt, _id },
        direction: "asc",
      });

      expect(query).toEqual({
        $or: [
          { createdAt: { $gt: createdAt } },
          { createdAt, _id: { $gt: _id } },
        ],
      });
    });

    it("defaults to descending when direction is omitted", () => {
      const createdAt = new Date();
      const _id = "64f0000000000000000000aa";
      const query = buildCursorQuery({ cursor: { createdAt, _id } });

      expect(query.$or[0]).toEqual({ createdAt: { $lt: createdAt } });
    });
  });

  describe("clampLimit", () => {
    const opts = { defaultLimit: 20 };

    it.each([undefined, null, "", "abc"])(
      "returns the resource default for missing/non-numeric limit: %p",
      (bad) => {
        expect(clampLimit(bad, opts)).toBe(20);
      },
    );

    it.each([0, -1, -100])(
      "returns the resource default for zero/negative limit: %p",
      (bad) => {
        expect(clampLimit(bad, opts)).toBe(20);
      },
    );

    it("returns the parsed value when within range", () => {
      expect(clampLimit(10, opts)).toBe(10);
      expect(clampLimit("15", opts)).toBe(15);
    });

    it("floors a fractional limit", () => {
      expect(clampLimit(10.9, opts)).toBe(10);
    });

    it("clamps to the hard maximum when limit exceeds it, never rejects", () => {
      expect(clampLimit(500, opts)).toBe(MAX_PAGE_SIZE);
      expect(clampLimit(51, opts)).toBe(50);
    });

    it("clamps to a custom maxLimit when given, even below MAX_PAGE_SIZE", () => {
      expect(clampLimit(30, { defaultLimit: 10, maxLimit: 20 })).toBe(20);
    });
  });

  describe("buildPageMeta", () => {
    it("forces nextCursor to null whenever hasMore is false", () => {
      const meta = buildPageMeta({ hasMore: false, nextCursor: "some-token" });
      expect(meta).toEqual({ hasMore: false, nextCursor: null });
    });

    it("returns the given nextCursor when hasMore is true", () => {
      const meta = buildPageMeta({ hasMore: true, nextCursor: "some-token" });
      expect(meta).toEqual({ hasMore: true, nextCursor: "some-token" });
    });

    it("coerces hasMore to a strict boolean", () => {
      expect(buildPageMeta({ hasMore: 1, nextCursor: null }).hasMore).toBe(
        true,
      );
      expect(buildPageMeta({ hasMore: 0, nextCursor: null }).hasMore).toBe(
        false,
      );
    });
  });
});
