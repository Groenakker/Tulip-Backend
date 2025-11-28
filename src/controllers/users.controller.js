import User from "../models/user.models.js";
import Role from "../models/roles.models.js";

export const getAllUsers = async (req, res) => {
  try {
    const { status, roleId } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (roleId) {
      query.roles = roleId;
    }

    const users = await User.find(query)
      .select("-password")
      .populate("roles", "name description isActive")
      .populate("company_id", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("-password")
      .populate("roles", "name description permissions isActive")
      .populate("roles.permissions.permissionId", "module availableActions description")
      .populate("company_id", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
};

export const updateUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!roleIds || !Array.isArray(roleIds)) {
      return res.status(400).json({ message: "roleIds must be an array" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate that all role IDs exist and are active
    if (roleIds.length > 0) {
      const roles = await Role.find({
        _id: { $in: roleIds },
        isActive: true,
      });

      if (roles.length !== roleIds.length) {
        return res.status(400).json({
          message: "One or more role IDs are invalid or inactive",
        });
      }
    }

    // Update user roles
    user.roles = roleIds;
    user.updatedBy = req.userId;
    await user.save();

    // Return updated user with populated roles
    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("roles", "name description permissions isActive")
      .populate("roles.permissions.permissionId", "module availableActions description")
      .populate("company_id", "name")
      .populate("updatedBy", "name email");

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Failed to update user roles", error: error.message });
  }
};

export const addRoleToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      return res.status(400).json({ message: "roleId is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role exists and is active
    const role = await Role.findOne({
      _id: roleId,
      isActive: true,
    });

    if (!role) {
      return res.status(400).json({ message: "Role not found or inactive" });
    }

    // Check if user already has this role
    if (user.roles.includes(roleId)) {
      return res.status(400).json({ message: "User already has this role" });
    }

    // Add role to user
    user.roles.push(roleId);
    user.updatedBy = req.userId;
    await user.save();

    // Return updated user with populated roles
    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("roles", "name description permissions isActive")
      .populate("roles.permissions.permissionId", "module availableActions description")
      .populate("company_id", "name")
      .populate("updatedBy", "name email");

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Failed to add role to user", error: error.message });
  }
};

export const removeRoleFromUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      return res.status(400).json({ message: "roleId is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has this role
    if (!user.roles.includes(roleId)) {
      return res.status(400).json({ message: "User does not have this role" });
    }

    // Remove role from user
    user.roles = user.roles.filter((rId) => rId.toString() !== roleId.toString());
    user.updatedBy = req.userId;
    await user.save();

    // Return updated user with populated roles
    const updatedUser = await User.findById(id)
      .select("-password")
      .populate("roles", "name description permissions isActive")
      .populate("roles.permissions.permissionId", "module availableActions description")
      .populate("company_id", "name")
      .populate("updatedBy", "name email");

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Failed to remove role from user", error: error.message });
  }
};

// Get user permissions (aggregated from all roles)
export const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).populate("roles");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.roles || user.roles.length === 0) {
      return res.json({
        userId: user._id,
        userName: user.name,
        permissions: [],
      });
    }

    const roleIds = user.roles.map((role) => (role._id ? role._id : role));
    const roles = await Role.find({
      _id: { $in: roleIds },
      isActive: true,
    }).populate("permissions.permissionId");

    // Aggregate permissions from all roles
    const permissionsMap = new Map();

    for (const role of roles) {
      for (const rolePermission of role.permissions || []) {
        const permission = rolePermission.permissionId;
        if (!permission) continue;

        const module = permission.module;
        const allowedActions = rolePermission.allowedActions || [];

        if (!permissionsMap.has(module)) {
          permissionsMap.set(module, {
            module,
            availableActions: permission.availableActions,
            allowedActions: new Set(),
          });
        }

        const modulePerms = permissionsMap.get(module);
        allowedActions.forEach((action) => modulePerms.allowedActions.add(action));
      }
    }

    // Convert Set to Array
    const permissions = Array.from(permissionsMap.values()).map((perm) => ({
      module: perm.module,
      availableActions: perm.availableActions,
      allowedActions: Array.from(perm.allowedActions),
    }));

    res.json({
      userId: user._id,
      userName: user.name,
      roles: roles.map((r) => ({ _id: r._id, name: r.name })),
      permissions,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user permissions", error: error.message });
  }
};

