import Warehouse from "../models/warehouses.models.js";

export const getAllWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });
    
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
    const warehouse = await Warehouse.findById(id);
    
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
  const { warehouseID, address, storage, space } = req.body;
  
  try {
    // Check if warehouseID already exists
    const existingWarehouse = await Warehouse.findOne({ warehouseID });
    if (existingWarehouse) {
      return res.status(400).json({ message: "Warehouse ID already exists" });
    }

    const newWarehouse = new Warehouse({
      warehouseID,
      address,
      storage,
      space: space || "Empty",
    });
    
    await newWarehouse.save();
    res.status(201).json(newWarehouse);
  } catch (error) {
    res.status(500).json({ message: "Failed to create warehouse", error: error.message });
  }
};

export const updateWarehouse = async (req, res) => {
  const { id } = req.params;
  const { warehouseID, address, storage, space } = req.body;

  try {
    // If warehouseID is being updated, check if it already exists
    if (warehouseID) {
      const existingWarehouse = await Warehouse.findOne({ 
        warehouseID,
        _id: { $ne: id } // Exclude current warehouse
      });
      if (existingWarehouse) {
        return res.status(400).json({ message: "Warehouse ID already exists" });
      }
    }

    const updatedWarehouse = await Warehouse.findByIdAndUpdate(
      id,
      {
        warehouseID,
        address,
        storage,
        space,
      },
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
    const deletedWarehouse = await Warehouse.findByIdAndDelete(id);

    if (!deletedWarehouse) {
      return res.status(404).json({ message: "Warehouse not found" });
    }

    res.json({ message: "Warehouse deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete warehouse", error: error.message });
  }
};

