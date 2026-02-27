import Document from "../models/documents.models.js";
import DocumentVersion from "../models/documentVersions.models.js";
import { verifyStakeholderApprovalToken } from "../utils/stakeholderApprovalToken.js";

/**
 * GET /api/stakeholder-approval/:token
 * Public: validate token and return document/version/stakeholder for the approval page.
 */
export const getByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const payload = verifyStakeholderApprovalToken(token);
    if (!payload) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const version = await DocumentVersion.findById(payload.versionId).lean();
    if (!version) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const stakeholder = (version.stakeholders || []).find(
      (s) => String(s._id) === payload.stakeholderId
    );
    if (!stakeholder) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const document = await Document.findById(version.documentId).lean();
    if (!document) {
      return res.status(404).json({ message: "Document not found." });
    }

    const firstFile = (version.files && version.files[0]) || {
      fileName: version.fileName,
      fileUrl: version.fileUrl,
    };

    res.json({
      stakeholder: {
        id: stakeholder._id,
        name: stakeholder.name,
        email: stakeholder.email,
        role: stakeholder.role,
        status: stakeholder.status || "Pending",
        avatar: stakeholder.avatar || `https://i.pravatar.cc/100?img=1`,
        approvedAt: stakeholder.approvedAt,
        signature: stakeholder.signature,
        rejectedAt: stakeholder.rejectedAt,
        rejectionReason: stakeholder.rejectionReason,
      },
      version: {
        version: version.version,
        date: version.date,
        author: version.author,
        changes: version.changes,
        status: version.status,
      },
      document: {
        documentID: document.documentID,
        name: document.name,
        description: document.description,
        category: document.category,
        fileName: firstFile.fileName,
        fileUrl: firstFile.fileUrl,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load approval request", error: error.message });
  }
};

/**
 * POST /api/stakeholder-approval/:token/approve
 * Public: approve with optional signature (base64 data URL).
 */
export const approve = async (req, res) => {
  try {
    const { token } = req.params;
    const { signature } = req.body || {};

    const payload = verifyStakeholderApprovalToken(token);
    if (!payload) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const version = await DocumentVersion.findById(payload.versionId);
    if (!version) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const stakeholder = version.stakeholders.id(payload.stakeholderId);
    if (!stakeholder) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    if (stakeholder.status === "Approved") {
      return res.status(400).json({ message: "You have already approved this document." });
    }

    stakeholder.status = "Approved";
    if (signature) stakeholder.signature = signature;
    stakeholder.approvedAt = new Date();
    await version.save();

    res.json({ message: "Document approved successfully.", status: "Approved" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to submit approval", error: error.message });
  }
};

/**
 * POST /api/stakeholder-approval/:token/reject
 * Public: reject with reason.
 */
export const reject = async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body || {};

    const payload = verifyStakeholderApprovalToken(token);
    if (!payload) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const version = await DocumentVersion.findById(payload.versionId);
    if (!version) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    const stakeholder = version.stakeholders.id(payload.stakeholderId);
    if (!stakeholder) {
      return res.status(404).json({ message: "This approval link is invalid or has expired." });
    }

    if (stakeholder.status === "Rejected") {
      return res.status(400).json({ message: "You have already rejected this document." });
    }

    stakeholder.status = "Rejected";
    stakeholder.rejectionReason = reason || "";
    stakeholder.rejectedAt = new Date();
    await version.save();

    res.json({ message: "Document rejected.", status: "Rejected" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to submit rejection", error: error.message });
  }
};
