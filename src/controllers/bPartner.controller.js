import Bpartner from "../models/bPartners.models.js";
import Project from "../models/projects.models.js";
import Shipping from "../models/shipping.models.js";
import Sample from "../models/samples.models.js";
import Testcode from "../models/testCodes.models.js";
import Contact from "../models/contacts.models.js";
import { createBulkDelete } from "../lib/bulkDelete.js";
import { uploadFileToSupabase, deleteFileFromSupabase } from "../lib/supabase.js";
import scanDocument from "../lib/documentScanner.js";

// Add a contact directly to the embedded contacts array for a business partner
export const addPartnerContact = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, jobTitle } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Contact name is required" });
  }

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const updatedPartner = await Bpartner.findOneAndUpdate(
      { _id: id, company_id: companyId },
      { $push: { contacts: { name, email, phone, jobTitle } } },
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // return the newly added contact (last element after push)
    const newContact = updatedPartner.contacts[updatedPartner.contacts.length - 1];
    res.status(201).json({ message: "Contact added", contact: newContact });
  } catch (error) {
    res.status(500).json({ message: "Failed to add contact", error: error.message });
  }
};

// Update an existing contact embedded on a business partner. Only the
// fields supplied on req.body are touched; everything else is preserved.
export const updatePartnerContact = async (req, res) => {
  const { id, contactId } = req.params;
  const { name, email, phone, jobTitle } = req.body;

  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    const contact = partner.contacts.id(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found for this partner" });
    }

    if (name !== undefined) contact.name = name;
    if (email !== undefined) contact.email = email;
    if (phone !== undefined) contact.phone = phone;
    if (jobTitle !== undefined) contact.jobTitle = jobTitle;

    await partner.save();

    res.json({ message: "Contact updated", contact });
  } catch (error) {
    res.status(500).json({ message: "Failed to update contact", error: error.message });
  }
};

// Remove a contact from the embedded contacts array
export const deletePartnerContact = async (req, res) => {
  const { id, contactId } = req.params;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    const contact = partner.contacts.id(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found for this partner" });
    }

    contact.deleteOne();
    await partner.save();

    res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete contact", error: error.message });
  }
};

// Add a test code to a business partner's testCodes array
export const addPartnerTestCode = async (req, res) => {
  const { id } = req.params;
  const { testCodeId } = req.body;

  if (!testCodeId) {
    return res.status(400).json({ message: "Test code ID is required" });
  }

  try {
    // Verify that the test code exists
    const testCode = await Testcode.findById(testCodeId);
    if (!testCode) {
      return res.status(404).json({ message: "Test code not found" });
    }

    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Check if partner exists
    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if test code is already in the array (convert to string for comparison)
    const testCodeExists = partner.testCodes.some(
      (tc) => tc.toString() === testCodeId
    );

    if (testCodeExists) {
      return res.status(400).json({ message: "Test code already added to this partner" });
    }

    // Add the test code
    partner.testCodes.push(testCodeId);
    await partner.save();

    // Populate the test code to return full details
    await partner.populate("testCodes");
    const addedTestCode = partner.testCodes[partner.testCodes.length - 1];

    res.status(201).json({ message: "Test code added successfully", testCode: addedTestCode });
  } catch (error) {
    res.status(500).json({ message: "Failed to add test code", error: error.message });
  }
};

// Remove a test code from a business partner's testCodes array
export const removePartnerTestCode = async (req, res) => {
  const { id, testCodeId } = req.params;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if test code exists in the array (convert to string for comparison)
    const testCodeExists = partner.testCodes.some(
      (tc) => tc.toString() === testCodeId
    );

    if (!testCodeExists) {
      return res.status(404).json({ message: "Test code not found for this partner" });
    }

    // Remove the test code using pull method
    partner.testCodes.pull(testCodeId);
    await partner.save();

    res.json({ message: "Test code removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove test code", error: error.message });
  }
};

export const getAllPartners = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const partners = await Bpartner.find({ company_id: companyId }).populate("testCodes");

    if (!partners) {
      return res.status(404).json({ message: "No partners found" });

    }
    res.json(partners);

  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch partners", error: error.message });
  }
};

export const getPartnerById = async (req, res) => {
  const { id } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId }).populate("testCodes");

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json(partner);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch partner", error: error.message });
  }
}

export const createPartner = async (req, res) => {
  const { partnerNumber, email, phone, category, name, status, address1, address2, city, state, zip, country, image, company_id } = req.body;

  try {
    // Convert empty email string to undefined for sparse index compatibility
    const normalizedEmail = email && email.trim() !== "" ? email.trim() : undefined;

    const newPartner = new Bpartner({
      partnerNumber,
      name,
      status,
      address1,
      address2,
      city,
      state,
      zip,
      country,
      email: normalizedEmail,
      phone,
      category,
      image,
      company_id
    });

    await newPartner.save();
    res.status(201).json(newPartner);
  } catch (error) {
    res.status(500).json({ message: "Failed to create partner", error: error.message });
  }
}

export const updatePartner = async (req, res) => {
  const { id } = req.params;
  const { name, status, address1, address2, city, state, zip, country, image, email, phone, category, partnerNumber, company_id } = req.body;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Convert empty email string to undefined for sparse index compatibility
    const normalizedEmail = email && email.trim() !== "" ? email.trim() : undefined;

    const updateData = { name, status, address1, address2, city, state, zip, country, image, email: normalizedEmail, phone, category, partnerNumber };
    if (company_id !== undefined) {
      updateData.company_id = company_id;
    }

    const updatedPartner = await Bpartner.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json(updatedPartner);
  } catch (error) {
    res.status(500).json({ message: "Failed to update partner", error: error.message });
  }
}

export const deletePartner = async (req, res) => {
  const { id } = req.params;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deletedPartner = await Bpartner.findOneAndDelete({ _id: id, company_id: companyId });

    if (!deletedPartner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.json({ message: "Partner deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete partner", error: error.message });
  }
}

// Bulk-delete business partners. Body: { ids: [...] }. Same per-tenant
// scoping and permission requirements as the single-record delete above.
// Implementation is the shared factory so all entities behave identically.
export const bulkDeletePartners = createBulkDelete(Bpartner, {
  entityName: "business partner",
});

export const getRelatedDataForPartner = async (req, res) => {
  const { id } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // First, get the business partner to get their partnerNumber
    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) {
      return res.status(404).json({ message: "Business partner not found" });
    }

    // Fetch all related data using both bPartnerID and bPartnerCode, filtered by company_id
    const [projects, shipments, samples, testCodes, contacts] = await Promise.all([
      // Projects related to this business partner
      Project.find({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),

      // Shipments related to this business partner
      Shipping.find({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),

      // Samples related to this business partner
      Sample.find({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),

      // Test codes (these might not be directly related, but we can include them)
      // If you have a specific relationship for test codes, update this query
      Testcode.find({}),

      // Contacts related to this business partner
      Contact.find({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      })
    ]);

    // Get projects for shipments to provide more context
    const projectIds = shipments.map(shipment => shipment.projectID);
    const relatedProjects = await Project.find({
      company_id: companyId,
      $or: [
        { _id: { $in: projectIds } },
        { projectID: { $in: projectIds } }
      ]
    });

    // Extract unique contact IDs from projects, shipments, and samples
    const contactIds = new Set();
    [...projects, ...shipments, ...samples].forEach(item => {
      if (item.contactID) {
        contactIds.add(item.contactID);
      }
    });

    res.json({
      businessPartner: {
        id: partner._id,
        name: partner.name,
        partnerNumber: partner.partnerNumber,
        category: partner.category,
        status: partner.status,
        email: partner.email,
        phone: partner.phone,
        address: {
          address1: partner.address1,
          address2: partner.address2,
          city: partner.city,
          state: partner.state,
          zip: partner.zip,
          country: partner.country
        }
      },
      projects: {
        count: projects.length,
        data: projects
      },
      shipments: {
        count: shipments.length,
        data: shipments,
        relatedProjects: relatedProjects
      },
      samples: {
        count: samples.length,
        data: samples
      },
      testCodes: {
        count: testCodes.length,
        data: testCodes
      },
      contacts: {
        count: contacts.length,
        data: contacts,
        legacyContactIds: Array.from(contactIds),
        note: contacts.length > 0 ? "Full contact details available" : "No dedicated contacts found. Legacy contact IDs from related records available."
      },
      summary: {
        totalProjects: projects.length,
        totalShipments: shipments.length,
        totalSamples: samples.length,
        totalTestCodes: testCodes.length,
        totalContacts: contacts.length
      }
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch related data", error: error.message });
  }
};

// ============================================================
// Business Partner sample documents
// ------------------------------------------------------------
// These endpoints back the "Sample Documents" tab on the BP
// detail page. Each doc is stored in Supabase under
// `bp-sample-docs/{companyId}/{bpId}/...` and is automatically
// scanned for labelled fields via documentScanner.
//
// Exactly one document per BP is flagged `isCurrent` at a time.
// The Sample Submission UI only pulls candidate custom fields
// from that current document, and the Shipping Log "Print BP
// Documents" surfaces just that file. Older uploads stay in the
// array as version history.
// ============================================================

const sniffMimeForExtension = (filename = "") => {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
};

// Mark exactly one sample document as current. All other docs
// on the partner get their isCurrent flag cleared. Used both
// internally (on upload / delete) and from the explicit
// "set current" endpoint.
const markDocumentCurrent = (partner, docId) => {
  const targetId = docId ? String(docId) : null;
  partner.sampleDocuments.forEach((d) => {
    d.isCurrent = targetId ? String(d._id) === targetId : false;
  });
};

// POST /api/bpartners/:id/documents - single-file multipart.
// Field name on the form: `file`. Optional body fields:
// `category`, `description`. Response contains the new doc
// (including detectedFields). The newly uploaded document is
// automatically promoted to the current working version,
// superseding the previous one.
export const uploadPartnerDocument = async (req, res) => {
  const { id } = req.params;
  const { category, description } = req.body || {};

  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No file uploaded. Send the file in the 'file' field." });
    }

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    // Resolve a usable mime type. multer / browser sometimes
    // hand us octet-stream for .docx and .xlsx.
    const filename = req.file.originalname || "document";
    const mimeType = req.file.mimetype && req.file.mimetype !== "application/octet-stream"
      ? req.file.mimetype
      : sniffMimeForExtension(filename);

    // Upload to Supabase (bucket: user_media, folder isolates by tenant + BP).
    const folder = `bp-sample-docs/${companyId}/${id}`;
    const { url, path } = await uploadFileToSupabase(req.file.buffer, filename, "user_media", folder, mimeType);

    // Scan synchronously: we want detectedFields back in the
    // response. Failures don't break the upload (scanDocument
    // catches internally and returns whatever it could parse).
    const scanResult = await scanDocument({ buffer: req.file.buffer, filename, mimeType });

    const docRecord = {
      filename,
      url,
      path,
      mimeType,
      size: req.file.size,
      category: category || "Test Request Form",
      description: description || "",
      uploadedAt: new Date(),
      uploadedBy: req.user?._id,
      // Newly uploaded doc becomes the current working version;
      // we clear the flag on all siblings below.
      isCurrent: true,
      extractedText: scanResult.extractedText,
      scannedAt: new Date(),
      detectedFields: scanResult.detectedFields,
    };

    // Clear isCurrent on every existing doc, then push the new one.
    partner.sampleDocuments.forEach((d) => { d.isCurrent = false; });
    partner.sampleDocuments.push(docRecord);
    await partner.save();

    const saved = partner.sampleDocuments[partner.sampleDocuments.length - 1];

    res.status(201).json({
      message: "Document uploaded",
      document: saved,
      extractionError: scanResult.extractionError,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to upload document", error: error.message });
  }
};

// GET /api/bpartners/:id/documents - list (without extractedText
// payload, which can be large). Use the single-doc endpoint when
// the UI needs the full text.
export const listPartnerDocuments = async (req, res) => {
  const { id } = req.params;

  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const partner = await Bpartner.findOne(
      { _id: id, company_id: companyId },
      { sampleDocuments: 1 }
    );
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const docs = (partner.sampleDocuments || []).map((d) => {
      const obj = d.toObject ? d.toObject() : d;
      // Strip extractedText from the list payload; clients can
      // pull it with GET .../documents/:docId if they need it.
      delete obj.extractedText;
      return obj;
    });

    // Backfill safety net for partners whose docs predate the
    // isCurrent flag: pick the most recently uploaded one as
    // current in the response (DB stays untouched until the user
    // explicitly sets or re-uploads).
    if (docs.length > 0 && !docs.some((d) => d.isCurrent)) {
      const newestIdx = docs
        .map((d, i) => ({ i, t: d.uploadedAt ? new Date(d.uploadedAt).getTime() : 0 }))
        .sort((a, b) => b.t - a.t)[0].i;
      docs[newestIdx] = { ...docs[newestIdx], isCurrent: true };
    }

    res.json({ documents: docs });
  } catch (error) {
    res.status(500).json({ message: "Failed to list documents", error: error.message });
  }
};

// GET /api/bpartners/:id/documents/:docId - full doc record
// including extractedText (used by the Sample Submission
// "suggested fields" panel and the scan-result preview).
export const getPartnerDocument = async (req, res) => {
  const { id, docId } = req.params;

  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const doc = partner.sampleDocuments.id(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    res.json({ document: doc });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch document", error: error.message });
  }
};

// PUT /api/bpartners/:id/documents/:docId/current - promote the
// given document to the current working version. All other docs
// on the partner get their isCurrent flag cleared in the same
// save so the invariant "exactly one current per BP" is
// preserved atomically.
export const setCurrentPartnerDocument = async (req, res) => {
  const { id, docId } = req.params;

  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const doc = partner.sampleDocuments.id(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    markDocumentCurrent(partner, docId);
    await partner.save();

    res.json({ message: "Current document updated", documentId: docId });
  } catch (error) {
    res.status(500).json({ message: "Failed to update current document", error: error.message });
  }
};

// DELETE /api/bpartners/:id/documents/:docId - removes from BP
// and best-effort deletes the Supabase object. If the deleted
// doc was the current one, the next most recently uploaded
// remaining doc is promoted so the BP always has a current
// version when at least one doc exists.
export const deletePartnerDocument = async (req, res) => {
  const { id, docId } = req.params;

  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const doc = partner.sampleDocuments.id(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const wasCurrent = !!doc.isCurrent;
    const storagePath = doc.path;
    doc.deleteOne();

    // Promote a successor when we just removed the current one.
    if (wasCurrent && partner.sampleDocuments.length > 0) {
      const successor = [...partner.sampleDocuments].sort((a, b) => {
        const at = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const bt = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return bt - at;
      })[0];
      if (successor) markDocumentCurrent(partner, successor._id);
    }

    await partner.save();

    if (storagePath) {
      // Fire-and-forget: we don't want a Supabase outage to
      // leave dangling DB rows the user can't delete.
      deleteFileFromSupabase(storagePath, "user_media").catch(() => {});
    }

    res.json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete document", error: error.message });
  }
};

// POST /api/bpartners/:id/documents/:docId/rescan - re-runs the
// scanner against the already-uploaded Supabase file. Used when
// the SAMPLE_FIELD_ALIASES dictionary is extended and we want
// previously-uploaded docs reclassified without re-uploading.
export const rescanPartnerDocument = async (req, res) => {
  const { id, docId } = req.params;

  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const doc = partner.sampleDocuments.id(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Fetch the file back from Supabase, then run the scanner.
    let buffer;
    try {
      const resp = await fetch(doc.url);
      if (!resp.ok) throw new Error(`Storage HTTP ${resp.status}`);
      buffer = Buffer.from(await resp.arrayBuffer());
    } catch (e) {
      return res.status(502).json({ message: "Failed to fetch file from storage", error: e.message });
    }

    const scanResult = await scanDocument({ buffer, filename: doc.filename, mimeType: doc.mimeType });

    doc.extractedText = scanResult.extractedText;
    doc.detectedFields = scanResult.detectedFields;
    doc.scannedAt = new Date();

    await partner.save();

    res.json({
      message: "Document rescanned",
      document: doc,
      extractionError: scanResult.extractionError,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to rescan document", error: error.message });
  }
};

// New endpoint for getting just summary data
export const getPartnerSummary = async (req, res) => {
  const { id } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const partner = await Bpartner.findOne({ _id: id, company_id: companyId });
    if (!partner) {
      return res.status(404).json({ message: "Business partner not found" });
    }

    // Get counts only for better performance, filtered by company_id
    const [projectCount, shipmentCount, sampleCount] = await Promise.all([
      Project.countDocuments({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),
      Shipping.countDocuments({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      }),
      Sample.countDocuments({
        company_id: companyId,
        $or: [
          { bPartnerID: id },
          { bPartnerCode: partner.partnerNumber }
        ]
      })
    ]);

    res.json({
      businessPartner: {
        id: partner._id,
        name: partner.name,
        partnerNumber: partner.partnerNumber,
        category: partner.category,
        status: partner.status
      },
      summary: {
        totalProjects: projectCount,
        totalShipments: shipmentCount,
        totalSamples: sampleCount
      }
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch partner summary", error: error.message });
  }
};
