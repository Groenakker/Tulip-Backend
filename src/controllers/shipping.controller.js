import Shipping from "../models/shipping.models.js";
import ShippingLine from "../models/shippingLines.models.js";


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
    const data = req.body;
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

    const updateData = { ...req.body };

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