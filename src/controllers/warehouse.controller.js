import Warehouse from "../models/warehouses.models.js";

export const getAllWarehouses = async (req, res) => {
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const warehouses = await Warehouse.find({ company_id: companyId }).sort({ createdAt: -1 });

    if (!warehouses || warehouses.length === 0) {
      return res.status(404).json({ message: "No warehouses found" });
    }

    res.json(warehouses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch warehouses", error: error.message });
  }
};

export const getWarehouseById = async (req, res) => {
  const { id } = req.params;
  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const warehouse = await Warehouse.findOne({ _id: id, company_id: companyId });

    if (!warehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }

    res.json(warehouse);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch warehouse", error: error.message });
  }
};

export const createWarehouse = async (req, res) => {
  const { warehouseID, address, storage, space, company_id } = req.body;

  try {
    // Use company_id from authenticated user if not provided in body
    const warehouseCompanyId = company_id || (req.user && req.user.company_id);

    // Check if warehouseID already exists (scoped to company)
    const existingWarehouse = await Warehouse.findOne({
      warehouseID,
      company_id: warehouseCompanyId
    });
    if (existingWarehouse) {
      return res.status(400).json({ message: "Warehouse ID already exists" });
    }

    const newWarehouse = new Warehouse({
      warehouseID,
      address,
      storage,
      space: space || "Empty",
      company_id: warehouseCompanyId
    });

    await newWarehouse.save();
    res.status(201).json(newWarehouse);
  } catch (error) {
    res.status(500).json({ message: "Failed to create warehouse", error: error.message });
  }
};

export const updateWarehouse = async (req, res) => {
  const { id } = req.params;
  const { warehouseID, address, storage, space, company_id } = req.body;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    // Get current warehouse to check company_id for uniqueness check
    const currentWarehouse = await Warehouse.findOne({ _id: id, company_id: companyId });
    if (!currentWarehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }

    // If warehouseID is being updated, check if it already exists (scoped to company)
    if (warehouseID) {
      const warehouseCompanyId = company_id || currentWarehouse.company_id || (req.user && req.user.company_id);
      const existingWarehouse = await Warehouse.findOne({
        warehouseID,
        _id: { $ne: id }, // Exclude current warehouse
        company_id: warehouseCompanyId
      });
      if (existingWarehouse) {
        return res.status(400).json({ message: "Warehouse ID already exists" });
      }
    }

    const updateData = {
      warehouseID,
      address,
      storage,
      space,
    };

    // Add company_id if provided
    if (company_id !== undefined) {
      updateData.company_id = company_id;
    }

    const updatedWarehouse = await Warehouse.findOneAndUpdate(
      { _id: id, company_id: companyId },
      updateData,
      { new: true }
    );

    if (!updatedWarehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }

    res.json(updatedWarehouse);
  } catch (error) {
    res.status(500).json({ message: "Failed to update warehouse", error: error.message });
  }
};

export const deleteWarehouse = async (req, res) => {
  const { id } = req.params;

  try {
    // Filter by user's company_id for tenant isolation
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const deletedWarehouse = await Warehouse.findOneAndDelete({ _id: id, company_id: companyId });

    if (!deletedWarehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }

    res.json({ message: "Warehouse deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete warehouse", error: error.message });
  }
};

