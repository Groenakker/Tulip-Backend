import InstanceMovement from "../models/instanceMovements.models.js";

export const getAllInstanceMovements = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const movements = await InstanceMovement.find({ company_id: companyId })
      .populate("instanceId", "instanceCode sampleCode lotNo status")
      .populate("warehouseId", "warehouseID address")
      .populate("receivingId", "receivingCode")
      .populate("shippingId", "shippingCode")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ movementDate: -1, createdAt: -1 });

    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch instance movements", error: error.message });
  }
};

export const getInstanceMovementById = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const movement = await InstanceMovement.findOne({ _id: id, company_id: companyId })
      .populate("instanceId", "instanceCode sampleCode lotNo status")
      .populate("warehouseId", "warehouseID address")
      .populate("receivingId", "receivingCode")
      .populate("shippingId", "shippingCode")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!movement) return res.status(404).json({ message: "Instance movement not found" });
    res.json(movement);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch instance movement", error: error.message });
  }
};

export const createInstanceMovement = async (req, res) => {
  try {
    const data = req.body;

    // Use company_id from authenticated user if not provided in body
    const movementCompanyId = data.company_id || (req.user && req.user.company_id);
    if (!movementCompanyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }
    data.company_id = movementCompanyId;

    // Set createdBy from authenticated user if not provided
    if (!data.createdBy && req.user && req.user._id) {
      data.createdBy = req.user._id;
    }

    const movement = new InstanceMovement(data);
    await movement.save();

    // Populate the saved movement before returning
    await movement.populate([
      { path: "instanceId", select: "instanceCode sampleCode lotNo status" },
      { path: "warehouseId", select: "warehouseID address" },
      { path: "receivingId", select: "receivingCode" },
      { path: "shippingId", select: "shippingCode" },
      { path: "createdBy", select: "name email" },
      { path: "updatedBy", select: "name email" }
    ]);

    res.status(201).json(movement);
  } catch (error) {
    res.status(500).json({ message: "Failed to create instance movement", error: error.message });
  }
};

export const updateInstanceMovement = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const updateData = { ...req.body };

    // Set updatedBy from authenticated user if not provided
    if (!updateData.updatedBy && req.user && req.user._id) {
      updateData.updatedBy = req.user._id;
    }

    // Add company_id if provided in body
    if (updateData.company_id !== undefined) {
      // Keep the provided company_id
    }

    const updated = await InstanceMovement.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
      { new: true }
    )
      .populate("instanceId", "instanceCode sampleCode lotNo status")
      .populate("warehouseId", "warehouseID address")
      .populate("receivingId", "receivingCode")
      .populate("shippingId", "shippingCode")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!updated) return res.status(404).json({ message: "Instance movement not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update instance movement", error: error.message });
  }
};

export const deleteInstanceMovement = async (req, res) => {
  try {
    const { id } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deleted = await InstanceMovement.findOneAndDelete({ _id: id, company_id: companyId });
    if (!deleted) return res.status(404).json({ message: "Instance movement not found" });
    res.json({ message: "Instance movement deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete instance movement", error: error.message });
  }
};

export const getInstanceMovementsByInstance = async (req, res) => {
  try {
    const { instanceId } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const movements = await InstanceMovement.find({ instanceId, company_id: companyId })
      .populate("instanceId", "instanceCode sampleCode lotNo status")
      .populate("warehouseId", "warehouseID address")
      .populate("receivingId", "receivingCode")
      .populate("shippingId", "shippingCode")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ movementDate: -1, createdAt: -1 });

    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch instance movements by instance", error: error.message });
  }
};

export const getInstanceMovementsByType = async (req, res) => {
  try {
    const { movementType } = req.params;
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Validate movementType
    const validTypes = ["Received", "In Warehouse", "Shipped"];
    if (!validTypes.includes(movementType)) {
      return res.status(400).json({ message: "Invalid movement type" });
    }

    const movements = await InstanceMovement.find({ movementType, company_id: companyId })
      .populate("instanceId", "instanceCode sampleCode lotNo status")
      .populate("warehouseId", "warehouseID address")
      .populate("receivingId", "receivingCode")
      .populate("shippingId", "shippingCode")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ movementDate: -1, createdAt: -1 });

    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch instance movements by type", error: error.message });
  }
};
