import Receiving from "../models/receivings.models.js";
import ReceivingLine from "../models/receivingLines.models.js";

export const getAllReceivings = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const receivings = await Receiving.find({ company_id: companyId }).sort({ createdAt: -1 });
    res.json(receivings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch receivings", error: error.message });
  }
};

export const getReceivingById = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const receiving = await Receiving.findOne({ _id: id, company_id: companyId });
    if (!receiving) return res.status(404).json({ message: "Receiving not found" });
    res.json(receiving);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch receiving", error: error.message });
  }
};

export const createReceiving = async (req, res) => {

  try {
    const data = req.body;
    if (!data.receivingCode) {
      const seq = Math.floor(Date.now() / 1000).toString().slice(-6);
      data.receivingCode = `GRK-RCV-${seq}`;
    }

    // Use company_id from authenticated user if not provided in body
    const receivingCompanyId = data.company_id || (req.user && req.user.company_id);
    data.company_id = receivingCompanyId;

    const exists = await Receiving.findOne({
      receivingCode: data.receivingCode,
      company_id: receivingCompanyId
    });
    if (exists) return res.status(400).json({ message: "receivingCode already exists" });

    const receiving = new Receiving(data);
    await receiving.save();
    res.status(201).json(receiving);
  } catch (error) {
    res.status(500).json({ message: "Failed to create receiving", error: error.message });
  }
};

export const updateReceiving = async (req, res) => {
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

    const updated = await Receiving.findOneAndUpdate({ _id: id, company_id: companyId }, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Receiving not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update receiving", error: error.message });
  }
};

export const deleteReceiving = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deleted = await Receiving.findOneAndDelete({ _id: id, company_id: companyId });
    if (!deleted) return res.status(404).json({ message: "Receiving not found" });
    await ReceivingLine.deleteMany({ receivingId: id, company_id: companyId });
    res.json({ message: "Receiving deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete receiving", error: error.message });
  }
};

export const getReceivingLines = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const lines = await ReceivingLine.find({ receivingId: id, company_id: companyId }).sort({ createdAt: 1 });
    res.json(lines);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch receiving lines", error: error.message });
  }
};

export const addReceivingLine = async (req, res) => {
  try {
    const { id } = req.params;

    // Get company_id from parent receiving or authenticated user
    const receiving = await Receiving.findById(id);
    const lineCompanyId = req.body.company_id || (receiving && receiving.company_id) || (req.user && req.user.company_id);

    const line = new ReceivingLine({
      ...req.body,
      receivingId: id,
      company_id: lineCompanyId
    });
    await line.save();
    res.status(201).json(line);
  } catch (error) {
    res.status(500).json({ message: "Failed to add receiving line", error: error.message });
  }
};

export const updateReceivingLine = async (req, res) => {
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

    const updated = await ReceivingLine.findOneAndUpdate({ _id: lineId, company_id: companyId }, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Receiving line not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update receiving line", error: error.message });
  }
};

export const deleteReceivingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deleted = await ReceivingLine.findOneAndDelete({ _id: lineId, company_id: companyId });
    if (!deleted) return res.status(404).json({ message: "Receiving line not found" });
    res.json({ message: "Receiving line deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete receiving line", error: error.message });
  }
};


