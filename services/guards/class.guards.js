/**
 * Shared class authorization guards.
 *
 * Implementation.md Phase 1 items 6–9 / C10: authorization decisions that
 * every class-scoped feature needs — membership, ownership, writability —
 * live here once. No route, controller or service re-derives them inline.
 *
 * Scope is deliberately narrow: these four functions decide "is this caller
 * allowed to touch this class at all". Business-specific conflict checks
 * (duplicate join request, already-resolved request, owner-as-member) are
 * invariant enforcement for one feature, not reusable authorization, and
 * stay in the service that owns the rule — see joinClassService and
 * approveJoinRequestService/rejectJoinRequestService in class.service.js.
 *
 * assertClassWritable is a plain status check with no knowledge of
 * exemptions. Two writes remain permitted on an archived class:
 * join-request rejection, and archive/restore themselves (Phase 1 item 11,
 * not yet built). Both are exempt because their callers never invoke this
 * guard — not because the guard special-cases them. Keeping the exemption
 * list out of the guard is what stops it accreting special cases as later
 * phases add endpoints.
 *
 * Signature deviation from Implementation.md:295-296 — deliberate, not
 * spec drift. The doc specifies id-in signatures, e.g.
 * assertActiveMember(classId, userId). Every current caller already holds
 * a loaded class document, and one (getClassByIdService) holds it with
 * owner populated. Taking an id here would force a redundant fetch on
 * every guarded request and would silently discard that population.
 * assertClassOwner/assertActiveMember/assertClassWritable take the loaded
 * classDoc instead; loadClassOrThrow is exported separately for callers
 * (e.g. a future PATCH /classes/:classId) that hold only an id.
 */

import mongoose from "mongoose";

import Class from "../../models/Class.model.js";
import ClassMember from "../../models/ClassMember.model.js";
import { ForbiddenError, NotFoundError } from "../../utils/error/errors.js";

// classDoc.owner is a raw ObjectId on most reads and a populated User
// subdocument on getClassByIdService. Normalize once here so a caller that
// forgets to populate can't silently compare the wrong shape and fail the
// ownership check open or closed.
//
// Exported (not just used internally) because two business-specific
// conflict checks in class.service.js — the join-conflict isOwner check in
// joinClassService and the C2 owner-as-member regression guard in
// approveJoinRequestService — compare classDoc.owner against a raw id too.
// Those checks aren't authorization (see the module header) so they stay
// inline, but they face the exact same shape-ambiguity risk this function
// exists to close, so they reuse it rather than repeating a second,
// unguarded .toString() comparison.
function ownerIdOf(classDoc) {
  const owner = classDoc.owner;
  const id = owner && owner._id ? owner._id : owner;
  return id ? id.toString() : null;
}

/**
 * Loads a class by id, or throws NotFoundError — the only source of a 404
 * in the authorization ladder (D12: 404 is reserved for ids that resolve to
 * no document). A malformed id is treated the same as a missing one rather
 * than surfacing a Mongoose CastError.
 */
const loadClassOrThrow = async (classId, { populateOwner = false } = {}) => {
  if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
    throw new NotFoundError("Class not found");
  }

  const query = Class.findById(classId);

  if (populateOwner) {
    query.populate("owner", "name email avatar role");
  }

  const classDoc = await query;

  if (!classDoc) {
    throw new NotFoundError("Class not found");
  }

  return classDoc;
};

/**
 * Throws ForbiddenError unless userId is the class owner.
 */
const assertClassOwner = (classDoc, userId, { message } = {}) => {
  if (ownerIdOf(classDoc) !== userId.toString()) {
    throw new ForbiddenError(
      message || "Only the class teacher can perform this action",
    );
  }
};

/**
 * Throws ForbiddenError unless userId is the class owner or holds an
 * active ClassMember row. The owner is authorized with zero ClassMember
 * documents in existence (C2) — ownership is read from Class.owner, never
 * from membership. left/removed rows do not authorize (I8: the row
 * survives leave/remove, the access does not).
 *
 * Returns { isOwner, membership } so callers that already need the
 * distinction (e.g. building a roster) don't re-derive it.
 */
const assertActiveMember = async (classDoc, userId, { message } = {}) => {
  const isOwner = ownerIdOf(classDoc) === userId.toString();

  if (isOwner) {
    return { isOwner: true, membership: null };
  }

  const membership = await ClassMember.findOne({
    classId: classDoc._id,
    userId,
    status: "active",
  });

  if (!membership) {
    throw new ForbiddenError(message || "You are not a member of this class");
  }

  return { isOwner: false, membership };
};

/**
 * Throws ForbiddenError if the class is archived. C5/C6/I6: archived
 * classes stay readable; this guard only blocks writes, and only the
 * writes whose callers invoke it — see the module header for the two
 * documented exemptions.
 */
const assertClassWritable = (classDoc, { message } = {}) => {
  if (classDoc.status === "archived") {
    throw new ForbiddenError(message || "This class has been archived");
  }
};

export {
  loadClassOrThrow,
  assertClassOwner,
  assertActiveMember,
  assertClassWritable,
  ownerIdOf,
};
