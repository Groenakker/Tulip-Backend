import Receiving from "../models/receivings.models.js";
import ReceivingLine from "../models/receivingLines.models.js";

export const getAllReceivings = async (req, res) => {
  try {
    const receivings = await Receiving.find().sort({ createdAt: -1 });
    res.json(receivings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch receivings", error: error.message });
  }
};

export const getReceivingById = async (req, res) => {
  try {
    const { id } = req.params;
    const receiving = await Receiving.findById(id);
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
    const exists = await Receiving.findOne({ receivingCode: data.receivingCode });
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
    const updated = await Receiving.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Receiving not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update receiving", error: error.message });
  }
};

export const deleteReceiving = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Receiving.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Receiving not found" });
    await ReceivingLine.deleteMany({ receivingId: id });
    res.json({ message: "Receiving deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete receiving", error: error.message });
  }
};

export const getReceivingLines = async (req, res) => {
  try {
    const { id } = req.params;
    const lines = await ReceivingLine.find({ receivingId: id }).sort({ createdAt: 1 });
    res.json(lines);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch receiving lines", error: error.message });
  }
};

export const addReceivingLine = async (req, res) => {
  try {
    const { id } = req.params;
    const line = new ReceivingLine({ ...req.body, receivingId: id });
    await line.save();
    res.status(201).json(line);
  } catch (error) {
    res.status(500).json({ message: "Failed to add receiving line", error: error.message });
  }
};

export const updateReceivingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    const updated = await ReceivingLine.findByIdAndUpdate(lineId, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Receiving line not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update receiving line", error: error.message });
  }
};

export const deleteReceivingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    const deleted = await ReceivingLine.findByIdAndDelete(lineId);
    if (!deleted) return res.status(404).json({ message: "Receiving line not found" });
    res.json({ message: "Receiving line deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete receiving line", error: error.message });
  }
};


