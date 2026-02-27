import Document from "../models/documents.models.js";
import DocumentVersion from "../models/documentVersions.models.js";
import DocumentReview from "../models/documentReviews.models.js";
import User from "../models/user.models.js";
import { uploadFileToSupabase } from "../lib/supabase.js";
import { sendDocumentStakeholderEmail } from "../utils/mailer.js";
import { createStakeholderApprovalToken } from "../utils/stakeholderApprovalToken.js";

const DOCUMENT_ID_PREFIX = "DOC";
const DOCUMENT_ID_YEAR_LEN = 4;
const DOCUMENT_ID_SEQ_LEN = 3;

async function generateDocumentID(companyId) {
  const year = new Date().getFullYear().toString();
  const pattern = new RegExp(`^${DOCUMENT_ID_PREFIX}-${year}-(\\d+)$`);
  const last = await Document.find({
    company_id: companyId,
    documentID: pattern,
  })
    .sort({ documentID: -1 })
    .limit(1)
    .select("documentID")
    .lean();

  let seq = 1;
  if (last.length > 0 && last[0].documentID) {
    const match = last[0].documentID.match(pattern);
    if (match) seq = parseInt(match[1], 10) + 1;
  }
  const seqStr = seq.toString().padStart(DOCUMENT_ID_SEQ_LEN, "0");
  return `${DOCUMENT_ID_PREFIX}-${year}-${seqStr}`;
}

export const getAllDocuments = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const documents = await Document.find({ company_id: companyId }).sort({
      createdAt: -1,
    });

    const list = documents.map((doc) => ({
      _id: doc._id,
      documentID: doc.documentID,
      title: doc.name,
      name: doc.name,
      category: doc.category,
      status: doc.status,
      version: doc.currentVersion,
      currentVersion: doc.currentVersion,
    }));

    res.json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch documents", error: error.message });
  }
};

export const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const include = (req.query.include || "").toLowerCase();
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId })
      .populate("createdBy", "name");
    if (!document)
      return res.status(404).json({ message: "Document not found" });

    const result = document.toObject();
    // Expose owner as creator's name (no owner field in schema)
    result.owner = result.createdBy?.name ?? "";

    if (include.includes("versions")) {
      const versions = await DocumentVersion.find({
        documentId: id,
        company_id: companyId,
      })
        .sort({ createdAt: -1 })
        .lean();
      result.versions = versions.map((v) => ({
        id: v._id,
        version: v.version,
        date: v.date,
        author: v.author,
        changes: v.changes,
        status: v.status,
        fileName: v.fileName,
        fileUrl: v.fileUrl,
        files: v.files || [],
        stakeholders: v.stakeholders || [],
      }));
    }

    if (include.includes("reviews")) {
      const reviews = await DocumentReview.find({
        documentId: id,
        company_id: companyId,
      })
        .sort({ createdAt: -1 })
        .lean();
      result.reviews = reviews.map((r) => ({
        id: r._id,
        reviewer: r.reviewer,
        date: r.date,
        comment: r.comment,
        status: r.status,
      }));
    }

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch document", error: error.message });
  }
};

export const createDocument = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Normalize: multer.array('file') sets req.files (array)
    const uploadedFiles = Array.isArray(req.files) && req.files.length > 0
      ? req.files.filter((f) => f && f.buffer)
      : [];
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ message: "At least one document file is required" });
    }

    const body = req.body || {};
    const name = body.name && body.name.trim();
    const category = body.category && body.category.trim();
    if (!name) {
      return res.status(400).json({ message: "Document name is required" });
    }
    if (!category) {
      return res.status(400).json({ message: "Document category is required" });
    }

    let documentID = body.documentID && body.documentID.trim();
    if (!documentID) {
      documentID = await generateDocumentID(companyId);
    } else {
      const exists = await Document.findOne({
        company_id: companyId,
        documentID,
      });
      if (exists) {
        return res
          .status(400)
          .json({ message: "documentID already exists for this tenant" });
      }
    }

    const description = body.description && body.description.trim()
      ? body.description.trim()
      : undefined;
    let stakeholders = [];
    if (body.stakeholders) {
      try {
        const parsed = typeof body.stakeholders === "string"
          ? JSON.parse(body.stakeholders)
          : body.stakeholders;
        stakeholders = Array.isArray(parsed) ? parsed : [];
      } catch {
        stakeholders = [];
      }
    }

    // Upload all files and build files array
    const files = [];
    for (const file of uploadedFiles) {
      const fileName = file.originalname || `document-${documentID}-${files.length}`;
      let fileUrl = null;
      try {
        const uploadResult = await uploadFileToSupabase(
          file.buffer,
          fileName,
          "user_media",
          `documents/${companyId}`,
          file.mimetype
        );
        fileUrl = uploadResult.url;
      } catch (uploadError) {
        return res.status(500).json({
          message: "Failed to upload document file",
          error: uploadError.message,
        });
      }
      files.push({ fileName, fileUrl });
    }

    const firstFile = files[0];
    // If stakeholders are added at creation, document is sent for approval → Review; otherwise Creation
    const initialStatus = stakeholders.length > 0 ? "Review" : "Creation";
    const doc = new Document({
      documentID,
      name,
      category,
      description,
      status: initialStatus,
      currentVersion: "v1.0",
      fileName: firstFile.fileName,
      fileUrl: firstFile.fileUrl,
      files,
      company_id: companyId,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });
    await doc.save();

    const version = new DocumentVersion({
      documentId: doc._id,
      company_id: companyId,
      version: "v1.0",
      date: new Date(),
      author: req.user?.name,
      authorId: req.user?._id,
      status: "Creation",
      fileName: firstFile.fileName,
      fileUrl: firstFile.fileUrl,
      files,
      stakeholders: stakeholders.map((s) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        status: s.status || "Pending",
        avatar: s.avatar,
      })),
    });
    await version.save();

    // Notify stakeholders with email (fire-and-forget; don't block response)
    const addedByName = req.user?.name || req.user?.email;
    const frontendBaseUrl = (process.env.FRONTEND_URL || process.env.CLIENT_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
    for (const s of version.stakeholders || []) {
      const email = (s.email || "").trim().toLowerCase();
      if (!email) continue;

      const isTeamMember = await User.findOne({
        email,
        company_id: companyId,
      })
        .select("_id")
        .lean();

      if (isTeamMember) {
        // Team member: link to document in app (they log in and open the document)
        const documentLink = `${frontendBaseUrl}/DocumentManagement/DocumentDetails/${doc._id}`;
        sendDocumentStakeholderEmail({
          to: s.email?.trim() || email,
          documentName: name,
          documentID,
          role: s.role || "Stakeholder",
          addedByName,
          documentLink,
        }).catch((err) => {
          console.error(`[documents] Failed to send team member email to ${email}:`, err.message);
        });
      } else {
        // External stakeholder: token-based approval link (no login required)
        const token = createStakeholderApprovalToken(version._id, s._id);
        const approvalLink = `${frontendBaseUrl}/approval/${token}`;
        sendDocumentStakeholderEmail({
          to: s.email?.trim() || email,
          documentName: name,
          documentID,
          role: s.role || "Stakeholder",
          addedByName,
          approvalLink,
        }).catch((err) => {
          console.error(`[documents] Failed to send stakeholder email to ${email}:`, err.message);
        });
      }
    }

    return res.status(201).json(doc);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create document", error: error.message });
  }
};

export const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });
    if (document.status === "Published" || document.status === "Archived") {
      return res.status(400).json({
        message: "Cannot update a published or archived document",
      });
    }

    const updateData = { ...req.body };
    if (req.body.company_id !== undefined) {
      updateData.company_id = req.body.company_id;
    }
    updateData.updatedBy = req.user?._id;

    const updated = await Document.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: "Document not found" });
    res.json(updated);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update document", error: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });
    if (document.status === "Published" || document.status === "Archived") {
      return res.status(400).json({
        message: "Cannot delete a published or archived document",
      });
    }

    const deleted = await Document.findOneAndDelete({
      _id: id,
      company_id: companyId,
    });
    if (!deleted)
      return res.status(404).json({ message: "Document not found" });

    await DocumentVersion.deleteMany({ documentId: id, company_id: companyId });
    await DocumentReview.deleteMany({ documentId: id, company_id: companyId });

    res.json({ message: "Document deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete document", error: error.message });
  }
};

// ----- Versions (nested under document) -----

export const getDocumentVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });

    const versions = await DocumentVersion.find({
      documentId: id,
      company_id: companyId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const list = versions.map((v) => ({
      id: v._id,
      version: v.version,
      date: v.date,
      author: v.author,
      changes: v.changes,
      status: v.status,
      fileName: v.fileName,
      stakeholders: v.stakeholders || [],
    }));

    res.json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch versions", error: error.message });
  }
};

export const addDocumentVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });
    if (document.status === "Published" || document.status === "Archived") {
      return res.status(400).json({
        message: "Cannot add versions to a published or archived document",
      });
    }

    const body = req.body || {};
    const versionNum =
      body.version ||
      `v${(await DocumentVersion.countDocuments({ documentId: id, company_id: companyId })) + 1}.0`;

    let fileName = body.fileName;
    let fileUrl = body.fileUrl;
    const files = [];

    if (req.file && req.file.buffer) {
      try {
        const uploadResult = await uploadFileToSupabase(
          req.file.buffer,
          req.file.originalname || `version-${versionNum}`,
          "user_media",
          `documents/${companyId}`,
          req.file.mimetype
        );
        fileUrl = uploadResult.url;
        fileName = req.file.originalname || fileName;
        files.push({ fileName, fileUrl });
      } catch (uploadError) {
        return res.status(500).json({
          message: "Failed to upload version file",
          error: uploadError.message,
        });
      }
    }

    let stakeholders = [];
    if (body.stakeholders != null) {
      try {
        const parsed = typeof body.stakeholders === "string"
          ? JSON.parse(body.stakeholders)
          : body.stakeholders;
        stakeholders = Array.isArray(parsed) ? parsed : [];
      } catch {
        stakeholders = [];
      }
    }

    const version = new DocumentVersion({
      documentId: id,
      company_id: companyId,
      version: versionNum,
      date: body.date ? new Date(body.date) : new Date(),
      author: body.author || req.user?.name,
      authorId: req.user?._id,
      changes: body.changes,
      status: body.status || "Creation",
      fileName: fileName || body.fileName,
      fileUrl: fileUrl || body.fileUrl,
      files: files.length ? files : [],
      stakeholders: stakeholders.map((s) => ({
        name: s.name,
        email: s.email,
        role: s.role,
        status: s.status || "Pending",
        avatar: s.avatar,
      })),
    });
    await version.save();

    // Notify stakeholders with email (same as create document: team → document link, external → approval token)
    const addedByName = req.user?.name || req.user?.email;
    const frontendBaseUrl = (process.env.FRONTEND_URL || process.env.CLIENT_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
    for (const s of version.stakeholders || []) {
      const email = (s.email || "").trim().toLowerCase();
      if (!email) continue;

      const isTeamMember = await User.findOne({
        email,
        company_id: companyId,
      })
        .select("_id")
        .lean();

      if (isTeamMember) {
        const documentLink = `${frontendBaseUrl}/DocumentManagement/DocumentDetails/${id}`;
        sendDocumentStakeholderEmail({
          to: s.email?.trim() || email,
          documentName: document.name,
          documentID: document.documentID,
          role: s.role || "Stakeholder",
          addedByName,
          documentLink,
        }).catch((err) => {
          console.error(`[documents] Failed to send team member email (version) to ${email}:`, err.message);
        });
      } else {
        const token = createStakeholderApprovalToken(version._id, s._id);
        const approvalLink = `${frontendBaseUrl}/approval/${token}`;
        sendDocumentStakeholderEmail({
          to: s.email?.trim() || email,
          documentName: document.name,
          documentID: document.documentID,
          role: s.role || "Stakeholder",
          addedByName,
          approvalLink,
        }).catch((err) => {
          console.error(`[documents] Failed to send stakeholder email (version) to ${email}:`, err.message);
        });
      }
    }

    const result = version.toObject();
    res.status(201).json({
      id: result._id,
      version: result.version,
      date: result.date,
      author: result.author,
      changes: result.changes,
      status: result.status,
      fileName: result.fileName,
      fileUrl: result.fileUrl,
      files: result.files || [],
      stakeholders: result.stakeholders || [],
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add version", error: error.message });
  }
};

export const updateDocumentVersion = async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });
    if (document.status === "Published" || document.status === "Archived") {
      return res.status(400).json({
        message: "Cannot update versions of a published or archived document",
      });
    }

    const updateData = { ...req.body };
    const updated = await DocumentVersion.findOneAndUpdate(
      { _id: versionId, documentId: id, company_id: companyId },
      updateData,
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: "Version not found" });

    const result = updated.toObject();
    res.json({
      id: result._id,
      version: result.version,
      date: result.date,
      author: result.author,
      changes: result.changes,
      status: result.status,
      fileName: result.fileName,
      stakeholders: result.stakeholders || [],
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update version", error: error.message });
  }
};

export const deleteDocumentVersion = async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });
    if (document.status === "Published" || document.status === "Archived") {
      return res.status(400).json({
        message: "Cannot delete versions of a published or archived document",
      });
    }

    const version = await DocumentVersion.findOne({
      _id: versionId,
      documentId: id,
      company_id: companyId,
    });
    if (!version)
      return res.status(404).json({ message: "Version not found" });

    const hasApproved = (version.stakeholders || []).some(
      (s) => (s.status || "").toLowerCase() === "approved"
    );
    if (hasApproved) {
      return res.status(400).json({
        message: "Cannot delete version with approved stakeholders",
      });
    }

    await DocumentVersion.findByIdAndDelete(versionId);
    res.json({ message: "Version deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete version", error: error.message });
  }
};

// ----- Reviews (nested under document) -----

export const getDocumentReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });

    const reviews = await DocumentReview.find({
      documentId: id,
      company_id: companyId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const list = reviews.map((r) => ({
      id: r._id,
      reviewer: r.reviewer,
      date: r.date,
      comment: r.comment,
      status: r.status,
    }));

    res.json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch reviews", error: error.message });
  }
};

export const addDocumentReview = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const document = await Document.findOne({ _id: id, company_id: companyId });
    if (!document)
      return res.status(404).json({ message: "Document not found" });

    const body = req.body || {};
    const review = new DocumentReview({
      documentId: id,
      company_id: companyId,
      reviewer: body.reviewer || req.user?.name,
      reviewerId: req.user?._id,
      date: body.date ? new Date(body.date) : new Date(),
      comment: body.comment,
      status: body.status || "Pending",
    });
    await review.save();

    const result = review.toObject();
    res.status(201).json({
      id: result._id,
      reviewer: result.reviewer,
      date: result.date,
      comment: result.comment,
      status: result.status,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add review", error: error.message });
  }
};
