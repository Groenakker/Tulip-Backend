import Permission from "../models/permissions.models.js";

const ensureDefaultPermissions = async () => {
  const modules = Permission.schema.path("module")?.enumValues || [];
  if (!modules.length) {
    return;
  }

  const existingPermissions = await Permission.find({
    module: { $in: modules },
  })
    .select("module")
    .lean();

  const existingModules = new Set(existingPermissions.map((perm) => perm.module));
  const permissionsToCreate = modules
    .filter((module) => !existingModules.has(module))
    .map((module) => ({
      module,
      availableActions: ["read", "write", "update", "delete"],
      description: `Default permissions for ${module}`,
      isActive: true,
    }));

  if (permissionsToCreate.length) {
    await Permission.insertMany(permissionsToCreate, { ordered: false });
  }
};

export const getAllPermissions = async (req, res) => {
  try {
    await ensureDefaultPermissions();

    const { isActive } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const permissions = await Permission.find(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ module: 1 });

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch permissions", error: error.message });
  }
};

export const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    res.json(permission);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch permission", error: error.message });
  }
};

export const createPermission = async (req, res) => {
  try {
    const { module, availableActions, description, isActive } = req.body;

    if (!module) {
      return res.status(400).json({ message: "Module is required" });
    }

    if (!availableActions || !Array.isArray(availableActions) || availableActions.length === 0) {
      return res.status(400).json({ message: "Available actions array is required and cannot be empty" });
    }

    // Check if permission with same module already exists
    const existingPermission = await Permission.findOne({ module });
    if (existingPermission) {
      return res.status(400).json({ message: "Permission with this module already exists" });
    }

    const permission = new Permission({
      module,
      availableActions,
      description,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.userId,
    });

    await permission.save();
    
    const populated = await Permission.findById(permission._id)
      .populate("createdBy", "name email");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to create permission", error: error.message });
  }
};

export const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { availableActions, description, isActive } = req.body;

    const updateData = {};
    if (availableActions !== undefined) {
      if (!Array.isArray(availableActions) || availableActions.length === 0) {
        return res.status(400).json({ message: "Available actions must be a non-empty array" });
      }
      updateData.availableActions = availableActions;
    }
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedBy = req.userId;

    const permission = await Permission.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    res.json(permission);
  } catch (error) {
    res.status(500).json({ message: "Failed to update permission", error: error.message });
  }
};

export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    // Check if permission is being used by any roles
    const Role = (await import("../models/roles.models.js")).default;
    const rolesUsingPermission = await Role.find({
      "permissions.permissionId": id,
    });

    if (rolesUsingPermission.length > 0) {
      return res.status(400).json({
        message: "Cannot delete permission. It is being used by one or more roles.",
        rolesCount: rolesUsingPermission.length,
      });
    }

    await Permission.findByIdAndDelete(id);
    res.json({ message: "Permission deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete permission", error: error.message });
  }
};

