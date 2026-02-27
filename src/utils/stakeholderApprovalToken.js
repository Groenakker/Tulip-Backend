import jwt from "jsonwebtoken";

const APPROVAL_TOKEN_EXPIRY = "30d";

/**
 * Create a signed JWT for stakeholder approval link.
 * Only the backend should generate these; the frontend only passes the token in the URL.
 * @param {string} versionId - DocumentVersion._id
 * @param {string} stakeholderId - version.stakeholders[]._id (subdocument _id)
 * @returns {string} JWT token
 */
export function createStakeholderApprovalToken(versionId, stakeholderId) {
  return jwt.sign(
    {
      versionId: String(versionId),
      stakeholderId: String(stakeholderId),
      purpose: "stakeholder_approval",
    },
    process.env.JWT_SECRET,
    { expiresIn: APPROVAL_TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode a stakeholder approval token.
 * @param {string} token - JWT from URL
 * @returns {{ versionId: string, stakeholderId: string } | null}
 */
export function verifyStakeholderApprovalToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "stakeholder_approval" || !decoded.versionId || !decoded.stakeholderId) {
      return null;
    }
    return {
      versionId: decoded.versionId,
      stakeholderId: decoded.stakeholderId,
    };
  } catch {
    return null;
  }
}
