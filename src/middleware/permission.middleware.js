import User from "../models/user.models.js";
import Role from "../models/roles.models.js";

/**
 * Middleware to check if user has permission for a specific module and action
 * Usage: checkPermission("Dashboard", "read")
 * @param {string} module - The module name (e.g., "Dashboard", "Material Research")
 * @param {string|string[]} requiredActions - Single action or array of actions (e.g., "read" or ["read", "write"])
 * @returns {Function} Express middleware function
 */
export const checkPermission = (module, requiredActions) => {
  return async (req, res, next) => {
    try {
      // Ensure userId is set (should be set by verifyToken middleware)
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized - User not authenticated" });
      }

      // Get user with roles populated
      const user = await User.findById(req.userId).populate("roles");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // CRITICAL: Verify user belongs to tenant
      if (!user.company_id) {
        return res.status(403).json({ message: "Invalid tenant context" });
      }

      // If user has no roles, deny access
      if (!user.roles || user.roles.length === 0) {
        return res.status(403).json({
          message: `Access denied. Permission required: ${module} - ${Array.isArray(requiredActions) ? requiredActions.join(", ") : requiredActions}`,
        });
      }

      // Normalize required actions to array
      const actionsArray = Array.isArray(requiredActions) ? requiredActions : [requiredActions];

      // Check each role for the required permission
      let hasPermission = false;
      const roleIds = user.roles.map((role) => (role._id ? role._id : role));

      // Get all active roles with permissions populated, scoped to user's company
      const roles = await Role.find({
        _id: { $in: roleIds },
        company_id: user.company_id, // CRITICAL: Filter by tenant
        isActive: true,
      }).populate("permissions.permissionId");

      // System roles automatically pass permission checks
      const hasSystemRole = roles.some((role) => role.isSystemRole);
      if (hasSystemRole) {
        req.user = user;
        return next();
      }

      // Check if any role has the required permission and actions
      for (const role of roles) {
        for (const rolePermission of role.permissions || []) {
          const permission = rolePermission.permissionId;

          if (permission && permission.module === module) {
            // Check if all required actions are in allowed actions
            const hasAllActions = actionsArray.every((action) =>
              rolePermission.allowedActions.includes(action)
            );

            if (hasAllActions) {
              hasPermission = true;
              break;
            }
          }
        }
        if (hasPermission) break;
      }

      if (!hasPermission) {
        return res.status(403).json({
          message: `Access denied. Permission required: ${module} - ${actionsArray.join(", ")}`,
        });
      }

      // Attach user to request for use in controllers
      req.user = user;
      next();
    } catch (error) {
      console.error("Error in checkPermission middleware:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
};

/**
 * Middleware to check if user has ANY of the specified permissions
 * Usage: checkAnyPermission([["Dashboard", "read"], ["Material Research", "write"]])
 * @param {Array<[string, string|string[]]>} permissionChecks - Array of [module, actions] tuples
 * @returns {Function} Express middleware function
 */
export const checkAnyPermission = (permissionChecks) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized - User not authenticated" });
      }

      const user = await User.findById(req.userId).populate("roles");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // CRITICAL: Verify user belongs to tenant
      if (!user.company_id) {
        return res.status(403).json({ message: "Invalid tenant context" });
      }

      if (!user.roles || user.roles.length === 0) {
        return res.status(403).json({ message: "Access denied. No permissions assigned." });
      }

      const roleIds = user.roles.map((role) => (role._id ? role._id : role));
      const roles = await Role.find({
        _id: { $in: roleIds },
        company_id: user.company_id, // CRITICAL: Filter by tenant
        isActive: true,
      }).populate("permissions.permissionId");

      // System roles automatically pass permission checks
      const hasSystemRole = roles.some((role) => role.isSystemRole);
      if (hasSystemRole) {
        req.user = user;
        return next();
      }

      // Check if user has ANY of the required permissions
      for (const [module, requiredActions] of permissionChecks) {
        const actionsArray = Array.isArray(requiredActions) ? requiredActions : [requiredActions];

        for (const role of roles) {
          for (const rolePermission of role.permissions || []) {
            const permission = rolePermission.permissionId;

            if (permission && permission.module === module) {
              const hasAllActions = actionsArray.every((action) =>
                rolePermission.allowedActions.includes(action)
              );

              if (hasAllActions) {
                req.user = user;
                return next();
              }
            }
          }
        }
      }

      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    } catch (error) {
      console.error("Error in checkAnyPermission middleware:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
};
