import Shipping from "../models/shipping.models.js";
import ShippingLine from "../models/shippingLines.models.js";

export const getAllShipping = async (req, res) => {
  try {
    const shipping = await Shipping.find().sort({ createdAt: -1 });
    res.json(shipping);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shipping", error: error.message });
  }
};

export const getShippingById = async (req, res) => {
  try {
    const { id } = req.params;
    const shipping = await Shipping.findById(id);
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
    const exists = await Shipping.findOne({ shippingCode: data.shippingCode });
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
    const updated = await Shipping.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Shipping not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update shipping", error: error.message });
  }
};

export const deleteShipping = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Shipping.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Shipping not found" });
    await ShippingLine.deleteMany({ shippingId: id });
    res.json({ message: "Shipping deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete shipping", error: error.message });
  }
};

export const getShippingLines = async (req, res) => {
  try {
    const { id } = req.params;
    const lines = await ShippingLine.find({ shippingId: id }).sort({ createdAt: 1 });
    res.json(lines);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch shipping lines", error: error.message });
  }
};

export const addShippingLine = async (req, res) => {
  try {
    const { id } = req.params;
    const line = new ShippingLine({ ...req.body, shippingId: id });
    await line.save();
    res.status(201).json(line);
  } catch (error) {
    res.status(500).json({ message: "Failed to add shipping line", error: error.message });
  }
};

export const updateShippingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    const updated = await ShippingLine.findByIdAndUpdate(lineId, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Shipping line not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update shipping line", error: error.message });
  }
};

export const deleteShippingLine = async (req, res) => {
  try {
    const { lineId } = req.params;
    const deleted = await ShippingLine.findByIdAndDelete(lineId);
    if (!deleted) return res.status(404).json({ message: "Shipping line not found" });
    res.json({ message: "Shipping line deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete shipping line", error: error.message });
  }
};
