
import { Request, Response, NextFunction } from "express";

import { USER_ROLES, UserRole } from "../config/constants";
import { AuthenticatedUser } from "./authenticate";
import { AppError } from "../utils/AppError";

/**
 * Check whether a value is a valid application role.
 */
const isValidRole = (role: string): role is UserRole => {
  return Object.values(USER_ROLES).includes(role as UserRole);
};


/** Resolve the granular permission key for the current API operation. */
const inferRequestPermission = (req: Request): string | null => {
  const segments = req.baseUrl.split("/").filter(Boolean);
  const module = segments[segments.length - 1]?.toLowerCase();
  if (!module) return null;
  // School profile/branch/document configuration is governed by the
  // existing Settings permission family rather than inventing a new
  // permission namespace that existing role grants cannot recognize.
  if (module === "school-management") {
    return req.method === "GET" ? "settings.read" : "settings.update";
  }
  const originalPath = req.originalUrl.split("?")[0];
  const routePath = typeof req.route?.path === "string"
    ? req.route.path.toLowerCase()
    : (originalPath.slice(req.baseUrl.length) || "/").toLowerCase();
  const operation = `${req.method} ${routePath}`;
  if (module === "admissions") {
    if (/register/.test(routePath)) return "admissions.register";
    if (/approve/.test(routePath)) return "admissions.approve";
    if (/reject/.test(routePath)) return "admissions.reject";
    if (/verify|review/.test(routePath)) return "admissions.verify";
  }
  if (module === "reports") {
    const reportKey = routePath.split("/").filter(Boolean)[0] || "dashboard";
    const reportMap: Record<string, string> = { "analytics-dashboard": "dashboard", catalog: "dashboard", financial: "expenses", exams: "examination" };
    const reportModule = reportMap[reportKey] || reportKey;
    if (/export/.test(routePath)) return /download/.test(routePath) ? "reports.export.download" : "reports.export";
    return `reports.${reportModule}.read`;
  }
  if (module === "settings") {
    if (/security-policy/.test(routePath)) return req.method === "GET" ? "settings.security.read" : "settings.security.update";
    if (/sessions/.test(routePath)) return req.method === "GET" ? "settings.sessions.read" : "settings.sessions.revoke";
    if (/audit-logs/.test(routePath)) return "settings.audit.read";
    if (/users/.test(routePath)) return req.method === "GET" ? "settings.users.read" : "settings.users.update";
  }
  if (/approve|publish|activate/.test(operation)) return `${module}.${operation.includes("activate") ? "activate" : "approve"}`;
  if (module === "attendance" && req.method === "POST") return "attendance.mark";
  if (module === "fees" && /refund/.test(routePath)) return "fees.refund";
  if (module === "fees" && /payment/.test(routePath) && req.method === "POST") return "fees.collect";
  if (module === "fees" && /discount/.test(routePath) && /approve|reject/.test(routePath)) return "fees.approve";
  if (module === "exams" && /marks/.test(routePath) && req.method !== "GET") return "exams.marks.enter";
  if (module === "attendance" && req.method === "PATCH") return "attendance.correct";
  if (module === "reports" && /export/.test(routePath)) return "reports.export";
  if (module === "settings" && req.method !== "GET") return "settings.update";
  const action = req.method === "GET" ? "read" : req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
  return `${module}.${action}`;
};

const hasConfiguredPermission = (req: Request, permissions: string[]): boolean => {
  const required = inferRequestPermission(req);
  if (!required) return false;
  const [module] = required.split(".");
  return permissions.includes("*") || permissions.includes(required) || permissions.includes(`${module}.*`);
};

/**
 * Role-based authorization middleware.
 *
 * Example:
 * router.get(
 *   "/schools",
 *   authenticate,
 *   authorize(USER_ROLES.SUPER_ADMIN),
 *   controller
 * );
 */
export const authorize = (...roleArguments: Array<string | string[]>) => {
  const allowedRoles = roleArguments.flat();
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError("Authentication required.", 401);
      }

      if (!isValidRole(user.role)) {
        throw new AppError("Invalid user role.", 403);
      }

      // Super Admin is the platform owner and may operate every module.
      // School-scoped routes still require tenantContext + requireTenant,
      // so full role access never bypasses school data scoping.
      if (user.role === USER_ROLES.SUPER_ADMIN) {
        next();
        return;
      }

      if (allowedRoles.length === 0) {
        throw new AppError(
          "No authorized roles configured for this route.",
          403
        );
      }

      const permissionUser = user as AuthenticatedUser & { permissions?: string[]; permissionsConfigured?: boolean };
      const userPermissions = permissionUser.permissions ?? [];
      const permissionArguments = allowedRoles.filter((item) => item.includes(".") || item === "*");
      const hasRole = allowedRoles.includes(user.role);
      const hasPermission = permissionArguments.length > 0
        ? permissionArguments.some((permission) => userPermissions.includes(permission))
        : userPermissions.some((permission) => allowedRoles.includes(permission));
      if (hasRole && permissionUser.permissionsConfigured && !hasConfiguredPermission(req, userPermissions)) {
        throw new AppError("Your role does not have permission to perform this action.", 403);
      }
      if (!hasRole && !hasPermission) {
        throw new AppError(
          "You do not have permission to access this resource.",
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission-based authorization middleware.
 *
 * Permissions must be loaded and attached by trusted backend
 * authentication logic. Never accept permissions directly
 * from frontend request data.
 *
 * Example:
 * authorizePermissions("students:create")
 */
export const authorizePermissions = (
  ...requiredPermissions: string[]
) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    try {
      const user = req.user as
        | (AuthenticatedUser & { permissions?: string[] })
        | undefined;

      if (!user) {
        throw new AppError("Authentication required.", 401);
      }

      if (user.role === USER_ROLES.SUPER_ADMIN) {
        next();
        return;
      }

      if (
        !Array.isArray(user.permissions) ||
        requiredPermissions.length === 0
      ) {
        throw new AppError(
          "Required permissions are not configured.",
          403
        );
      }

      const hasAllPermissions = requiredPermissions.every(
        (permission) => user.permissions?.includes(permission)
      );

      if (!hasAllPermissions) {
        throw new AppError(
          "You do not have the required permissions.",
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Allow access if the user has at least one required permission.
 */
export const authorizeAnyPermission = (
  ...requiredPermissions: string[]
) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    try {
      const user = req.user as
        | (AuthenticatedUser & { permissions?: string[] })
        | undefined;

      if (!user) {
        throw new AppError("Authentication required.", 401);
      }

      if (user.role === USER_ROLES.SUPER_ADMIN) {
        next();
        return;
      }

      if (
        !Array.isArray(user.permissions) ||
        requiredPermissions.length === 0
      ) {
        throw new AppError(
          "Required permissions are not configured.",
          403
        );
      }

      const hasAnyPermission = requiredPermissions.some(
        (permission) => user.permissions?.includes(permission)
      );

      if (!hasAnyPermission) {
        throw new AppError(
          "You do not have the required permissions.",
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};