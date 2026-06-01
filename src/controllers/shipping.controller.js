import Shipping from "../models/shipping.models.js";
import ShippingLine from "../models/shippingLines.models.js";
import Sample from "../models/samples.models.js";
import Bpartner from "../models/bPartners.models.js";
import Project from "../models/projects.models.js";
import { createBulkDelete } from "../lib/bulkDelete.js";
import { buildShippingValueMap, fillDocument } from "../lib/documentFiller.js";

// Mongoose ObjectId fields can't be cast from "" — they need to be
// either a valid id or undefined. The frontend sometimes sends "" for
// optional reference fields (e.g. projectID before the user picks a
// project), which would otherwise fail validation with
// "Cast to ObjectId failed for value '' at path '<field>'". Walk the
// payload before save/update and drop empty-string values for every
// optional reference, so the document is treated as "not set" instead.
const OPTIONAL_OBJECT_ID_FIELDS = [
  "projectID",
  "bPartnerID",
  "contactID",
  "createdBy",
  "updatedBy",
];
const sanitizeShippingPayload = (data) => {
  if (!data || typeof data !== "object") return data;
  for (const field of OPTIONAL_OBJECT_ID_FIELDS) {
    if (data[field] === "" || data[field] === null) {
      delete data[field];
    }
  }
  if (data.shipFrom && typeof data.shipFrom === "object") {
    if (data.shipFrom.addressId === "" || data.shipFrom.addressId === null) {
      delete data.shipFrom.addressId;
    }
  }
  return data;
};

// Bulk delete shipping records (POST /api/shipping/bulk-delete).
// Also cleans up child shipping lines for each deleted shipment so the
// database doesn't end up with orphaned line items.
export const bulkDeleteShipping = createBulkDelete(Shipping, {
  entityName: "shipment",
  afterDelete: async (deletedIds, { companyId }) => {
    await ShippingLine.deleteMany({
      shippingId: { $in: deletedIds },
      ...(companyId ? { company_id: companyId } : {}),
    });
  },
});


export const getAllShipping = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const shipping = await Shipping.find({ company_id: companyId }).sort({ createdAt: -1 });
    res.json(shipping);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shipping", error: error.message });
  }
};

export const getShippingById = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const shipping = await Shipping.findOne({ _id: id, company_id: companyId });
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });
    res.json(shipping);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shipping", error: error.message });
  }
};

export const createShipping = async (req, res) => {
  try {
    const data = sanitizeShippingPayload(req.body);
    if (!data.shippingCode) {
      const seq = Math.floor(Date.now() / 1000).toString().slice(-6);
      data.shippingCode = `GRK-SHP-${seq}`;
    }

    // Use company_id from authenticated user if not provided in body
    const shippingCompanyId = data.company_id || (req.user && req.user.company_id);
    data.company_id = shippingCompanyId;

    const exists = await Shipping.findOne({
      shippingCode: data.shippingCode,
      company_id: shippingCompanyId
    });
    if (exists) return res.status(400).json({ message: "shippingCode already exists" });

    const shipping = new Shipping(data);
    await shipping.save();
    res.status(201).json(shipping);
  } catch (error) {
    res.status(500).json({ message: "Failed to create shipping", error: error.message });
  }
};

export const updateShipping = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const updateData = sanitizeShippingPayload({ ...req.body });

    // Add company_id if provided in body
    if (updateData.company_id !== undefined) {
      // Keep the provided company_id
    }

    const updated = await Shipping.findOneAndUpdate({ _id: id, company_id: companyId }, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Shipping not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update shipping", error: error.message });
  }
};

export const deleteShipping = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deleted = await Shipping.findOneAndDelete({ _id: id, company_id: companyId });
    if (!deleted) return res.status(404).json({ message: "Shipping not found" });
    await ShippingLine.deleteMany({ shippingId: id, company_id: companyId });
    res.json({ message: "Shipping deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete shipping", error: error.message });
  }
};

export const getShippingLines = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const lines = await ShippingLine.find({ shippingId: id, company_id: companyId }).sort({ createdAt: 1 });
    res.json(lines);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shipping lines", error: error.message });
  }
};

export const addShippingLine = async (req, res) => {
  try {
    const { id } = req.params;

    // Get company_id from parent shipping or authenticated user
    const shipping = await Shipping.findById(id);
    const lineCompanyId = req.body.company_id || (shipping && shipping.company_id) || (req.user && req.user.company_id);

    const line = new ShippingLine({
      ...req.body,
      shippingId: id,
      company_id: lineCompanyId
    });
    await line.save();
    res.status(201).json(line);
  } catch (error) {
    res.status(500).json({ message: "Failed to add shipping line", error: error.message });
  }
};

export const updateShippingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const updateData = { ...req.body };

    // Add company_id if provided in body
    if (updateData.company_id !== undefined) {
      // Keep the provided company_id
    }

    // If instances are being updated, we need to save to trigger pre-save hook for quantity update
    if (updateData.instances !== undefined) {
      const line = await ShippingLine.findOne({ _id: lineId, company_id: companyId });
      if (!line) return res.status(404).json({ message: "Shipping line not found" });
      
      // Update all fields
      Object.assign(line, updateData);
      
      // Save to trigger pre-save hook which updates quantity
      await line.save();
      res.json(line);
    } else {
      // For non-instance updates, use findOneAndUpdate
      const updated = await ShippingLine.findOneAndUpdate({ _id: lineId, company_id: companyId }, updateData, { new: true });
      if (!updated) return res.status(404).json({ message: "Shipping line not found" });
      res.json(updated);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update shipping line", error: error.message });
  }
};

export const deleteShippingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deleted = await ShippingLine.findOneAndDelete({ _id: lineId, company_id: companyId });
    if (!deleted) return res.status(404).json({ message: "Shipping line not found" });
    res.json({ message: "Shipping line deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete shipping line", error: error.message });
  }
};

export const addShippingLineInstance = async (req, res) => {
  try {
    const { lineId } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Fetch the document, modify it, and save to trigger pre-save hook
    const line = await ShippingLine.findOne({ _id: lineId, company_id: companyId });
    if (!line) return res.status(404).json({ message: "Shipping line not found" });

    // Push the new instance to the array
    line.instances.push(req.body);
    
    // Save the document - this will trigger the pre-save hook to update quantity
    await line.save();
    
    res.json(line);
  } catch (error) {
    res.status(500).json({ message: "Failed to add shipping line instance", error: error.message });
  }
};

export const getShippingLineById = async (req, res) => {
  try {
    const { lineId } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }
    console.log(lineId, companyId);
    const line = await ShippingLine.findOne({ _id: lineId, company_id: companyId });
    if (!line) return res.status(404).json({ message: "Shipping line not found" });
    res.json(line);

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shipping line", error: error.message });
  }
};

// ============================================================
// GET /api/shipping/:id/bp-doc-filled
// ------------------------------------------------------------
// Print-time helper for the Shipping Log "Print BP Documents"
// modal. Always streams back a brand-new PDF that contains:
//   1. A header with the partner name, original template
//      filename, generated date, and shipping code.
//   2. A Shipment Information section (origin, destination,
//      dates, parcel, ship-from / ship-to, contact) and an
//      Items Shipped table.
//   3. The original template's text body (cached at upload
//      time on `sampleDocument.extractedText`) with every
//      detected label substituted with the shipping log's
//      value via documentFiller's renderer.
//
// Output is always `application/pdf` regardless of whether the
// partner's current document was a PDF, DOCX, or XLSX upload.
// We don't try to mutate the original file in place anymore —
// extractedText is a reliable, format-agnostic source of truth.
// ============================================================
export const getShippingFilledBpDoc = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const shipping = await Shipping.findOne({ _id: id, company_id: companyId });
    if (!shipping) return res.status(404).json({ message: "Shipping not found" });

    if (!shipping.bPartnerID) {
      return res.status(400).json({
        message: "This shipping record has no Business Partner attached.",
      });
    }

    const partner = await Bpartner.findOne({ _id: shipping.bPartnerID, company_id: companyId });
    if (!partner) return res.status(404).json({ message: "Business Partner not found" });

    const docs = Array.isArray(partner.sampleDocuments) ? partner.sampleDocuments : [];
    let currentDoc = docs.find((d) => d.isCurrent) || null;
    if (!currentDoc && docs.length > 0) {
      const sorted = [...docs].sort((a, b) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
      );
      currentDoc = sorted[0];
    }
    if (!currentDoc) {
      return res.status(404).json({
        message: "No current sample document set for this Business Partner.",
      });
    }

    const [project, lines] = await Promise.all([
      shipping.projectID
        ? Project.findOne({ _id: shipping.projectID, company_id: companyId }).lean()
        : Promise.resolve(null),
      ShippingLine.find({ shippingId: id, company_id: companyId }).lean(),
    ]);
    const sampleIds = (lines || []).map((l) => l.sampleId).filter(Boolean);
    const samples = sampleIds.length
      ? await Sample.find({ _id: { $in: sampleIds }, company_id: companyId }).lean()
      : [];

    const valueMap = buildShippingValueMap({
      shipping: shipping.toObject(),
      lines: lines || [],
      samples,
      project,
      partner: partner.toObject(),
    });

    // Hand pdf-lib everything it needs to lay out the printable
    // copy. Note we pass the full currentDoc (subdoc) so the
    // renderer can mine its cached extractedText — no extra
    // network call to Supabase to re-download the original.
    const filled = await fillDocument({
      shipping: shipping.toObject(),
      partner: partner.toObject(),
      currentDoc: currentDoc.toObject ? currentDoc.toObject() : currentDoc,
      valueMap,
      lines: lines || [],
      samples,
    });

    res.setHeader("Content-Type", filled.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filled.filename.replace(/"/g, "")}"`
    );
    res.setHeader("X-Filled-Filename", filled.filename);
    res.send(filled.buffer);
  } catch (error) {
    console.error("getShippingFilledBpDoc error:", error);
    res.status(500).json({ message: "Failed to fill BP document", error: error.message });
  }
};