import User from "../models/user.models.js";
import Role from "../models/roles.models.js";

/**
 * Middleware to check if user has one or more of the specified roles
 * Usage: checkRole("admin") or checkRole(["admin", "manager"])
 * @param {string|string[]} requiredRoles - Single role name or array of role names
 * @returns {Function} Express middleware function
 */
export const checkRole = (requiredRoles) => {
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

      // If user has no roles, deny access
      if (!user.roles || user.roles.length === 0) {
        const rolesStr = Array.isArray(requiredRoles) ? requiredRoles.join(", ") : requiredRoles;
        return res.status(403).json({
          message: `Access denied. Required role(s): ${rolesStr}`,
        });
      }

      // Normalize required roles to array
      const rolesArray = Array.isArray(requiredRoles)
        ? requiredRoles.map((r) => r.toLowerCase().trim())
        : [requiredRoles.toLowerCase().trim()];

      // Get all active roles for the user, scoped to user's company
      const roleIds = user.roles.map((role) => (role._id ? role._id : role));
      const roles = await Role.find({
        _id: { $in: roleIds },
        company_id: user.company_id, // CRITICAL: Filter by tenant
        isActive: true,
      });

      // Check if user has any of the required roles
      const userRoleNames = roles.map((role) => role.name.toLowerCase().trim());
      const hasRequiredRole = rolesArray.some((requiredRole) =>
        userRoleNames.includes(requiredRole)
      );

      if (!hasRequiredRole) {
        const rolesStr = rolesArray.join(", ");
        return res.status(403).json({
          message: `Access denied. Required role(s): ${rolesStr}`,
        });
      }

      // Attach user to request for use in controllers
      req.user = user;
      next();
    } catch (error) {
      console.error("Error in checkRole middleware:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
};

/**
 * Middleware to check if user has ALL of the specified roles
 * Usage: checkAllRoles(["admin", "manager"])
 * @param {string[]} requiredRoles - Array of role names (all must be present)
 * @returns {Function} Express middleware function
 */
export const checkAllRoles = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "Unauthorized - User not authenticated" });
      }

      const user = await User.findById(req.userId).populate("roles");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.roles || user.roles.length === 0) {
        return res.status(403).json({
          message: `Access denied. Required roles: ${requiredRoles.join(", ")}`,
        });
      }

      const rolesArray = Array.isArray(requiredRoles)
        ? requiredRoles.map((r) => r.toLowerCase().trim())
        : [requiredRoles.toLowerCase().trim()];

      const roleIds = user.roles.map((role) => (role._id ? role._id : role));
      const roles = await Role.find({
        _id: { $in: roleIds },
        company_id: user.company_id, // CRITICAL: Filter by tenant
        isActive: true,
      });

      const userRoleNames = roles.map((role) => role.name.toLowerCase().trim());

      // Check if user has ALL required roles
      const hasAllRoles = rolesArray.every((requiredRole) =>
        userRoleNames.includes(requiredRole)
      );

      if (!hasAllRoles) {
        const missingRoles = rolesArray.filter(
          (requiredRole) => !userRoleNames.includes(requiredRole)
        );
        return res.status(403).json({
          message: `Access denied. Missing required role(s): ${missingRoles.join(", ")}`,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error in checkAllRoles middleware:", error);
      return res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
};

