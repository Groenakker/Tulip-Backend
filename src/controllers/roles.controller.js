import Role from "../models/roles.models.js";
import Permission from "../models/permissions.models.js";
import User from "../models/user.models.js";

export const getAllRoles = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const roles = await Role.find(query)
      .populate("permissions.permissionId", "module availableActions description")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ name: 1 });

    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch roles", error: error.message });
  }
};

export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id)
      .populate("permissions.permissionId", "module availableActions description")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(role);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch role", error: error.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, description, permissions, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    // Check if role with same name already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({ message: "Role with this name already exists" });
    }

    // Validate permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (!perm.permissionId) {
          return res.status(400).json({ message: "Each permission must have a permissionId" });
        }

        // Check if permission exists
        const permission = await Permission.findById(perm.permissionId);
        if (!permission) {
          return res.status(400).json({ message: `Permission with ID ${perm.permissionId} not found` });
        }

        // Validate allowed actions
        if (!perm.allowedActions || !Array.isArray(perm.allowedActions) || perm.allowedActions.length === 0) {
          return res.status(400).json({ message: "Each permission must have at least one allowed action" });
        }

        // Check if allowed actions are subset of permission's available actions
        const invalidActions = perm.allowedActions.filter(
          (action) => !permission.availableActions.includes(action)
        );
        if (invalidActions.length > 0) {
          return res.status(400).json({
            message: `Invalid actions for permission ${permission.module}: ${invalidActions.join(", ")}`,
          });
        }
      }
    }

    const role = new Role({
      name,
      description,
      permissions: permissions || [],
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.userId,
    });

    await role.save();
    
    const populated = await Role.findById(role._id)
      .populate("permissions.permissionId", "module availableActions description")
      .populate("createdBy", "name email");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to create role", error: error.message });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, isActive } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent updating system roles
    if (role.isSystemRole) {
      if (name && name !== role.name) {
        return res.status(400).json({ message: "Cannot change name of system role" });
      }
      if (isActive === false) {
        return res.status(400).json({ message: "Cannot deactivate system role" });
      }
    }

    // Check if new name conflicts with existing role
    if (name && name !== role.name) {
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        return res.status(400).json({ message: "Role with this name already exists" });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedBy = req.userId;

    // Validate permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "Permissions must be an array" });
      }

      for (const perm of permissions) {
        if (!perm.permissionId) {
          return res.status(400).json({ message: "Each permission must have a permissionId" });
        }

        const permission = await Permission.findById(perm.permissionId);
        if (!permission) {
          return res.status(400).json({ message: `Permission with ID ${perm.permissionId} not found` });
        }

        if (!perm.allowedActions || !Array.isArray(perm.allowedActions) || perm.allowedActions.length === 0) {
          return res.status(400).json({ message: "Each permission must have at least one allowed action" });
        }

        const invalidActions = perm.allowedActions.filter(
          (action) => !permission.availableActions.includes(action)
        );
        if (invalidActions.length > 0) {
          return res.status(400).json({
            message: `Invalid actions for permission ${permission.module}: ${invalidActions.join(", ")}`,
          });
        }
      }

      updateData.permissions = permissions;
    }

    const updatedRole = await Role.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate("permissions.permissionId", "module availableActions description")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    res.json(updatedRole);
  } catch (error) {
    res.status(500).json({ message: "Failed to update role", error: error.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return res.status(400).json({ message: "Cannot delete system role" });
    }

    // Check if role is assigned to any users
    const usersWithRole = await User.find({ roles: id });
    if (usersWithRole.length > 0) {
      return res.status(400).json({
        message: "Cannot delete role. It is assigned to one or more users.",
        usersCount: usersWithRole.length,
      });
    }

    await Role.findByIdAndDelete(id);
    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete role", error: error.message });
  }
};

// Get users with a specific role
export const getRoleUsers = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const users = await User.find({ roles: id })
      .select("-password")
      .populate("company_id", "name")
      .sort({ name: 1 });

    res.json({
      role: {
        _id: role._id,
        name: role.name,
      },
      users,
      count: users.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch role users", error: error.message });
  }
};

