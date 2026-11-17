
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "../config/env";
import { USER_ROLES, TOKEN_TYPES } from "../config/constants";
import { AppError } from "../utils/AppError";
import { asyncMiddleware } from "../utils/asyncHandler";
import UserModel from "../modules/auth/auth.model";
import School from "../modules/schools/schools.model";
import { PlatformRole } from "../modules/platform/platform.model";

// ==========================================
// AUTHENTICATED USER TYPE
// ==========================================

export interface AuthenticatedUser {
  userId: string;
  role: string;
  schoolId: string | null;
}

// ==========================================
// JWT PAYLOAD TYPE
// ==========================================

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
  email?: string;
  schoolId?: string | null;
  tokenType: string;
}

// ==========================================
// VALIDATE JWT PAYLOAD
// ==========================================

const isValidAccessTokenPayload = (
  payload: string | JwtPayload
): payload is AccessTokenPayload => {
  if (typeof payload === "string") {
    return false;
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    return false;
  }

  if (
    typeof payload.role !== "string" ||
    !Object.values(USER_ROLES).includes(
      payload.role as (typeof USER_ROLES)[keyof typeof USER_ROLES]
    )
  ) {
    return false;
  }

  if (payload.tokenType !== TOKEN_TYPES.ACCESS) {
    return false;
  }

  if (
    payload.schoolId !== undefined &&
    payload.schoolId !== null &&
    typeof payload.schoolId !== "string"
  ) {
    return false;
  }

  // Every non-platform user must have a school context.
  if (
    payload.role !== USER_ROLES.SUPER_ADMIN &&
    !payload.schoolId
  ) {
    return false;
  }

  return true;
};

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

export const authenticate = asyncMiddleware(async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    // Check authorization header.
    if (!authorization) {
      throw new AppError(
        "Authentication required. Please provide an access token.",
        401
      );
    }

    // Validate Bearer token format.
    const [scheme, token, ...extraParts] =
      authorization.trim().split(/\s+/);

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !token ||
      extraParts.length > 0
    ) {
      throw new AppError(
        "Invalid authorization header format.",
        401
      );
    }

    // Verify JWT signature and expiration.
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    // Validate token claims.
    if (!isValidAccessTokenPayload(decoded)) {
      throw new AppError(
        "Invalid access token payload.",
        401
      );
    }

    // Resolve the identity from MongoDB on every request. JWT claims are
    // credentials, not the source of truth for current account status,
    // role, tenant association or permissions.
    const user = await UserModel.findOne({
      _id: decoded.sub,
      isDeleted: { $ne: true },
    }).select("name email role schoolId status isActive permissions").lean();

    if (!user || user.status !== "ACTIVE" || user.isActive !== true) {
      throw new AppError("Account is inactive or unavailable.", 401);
    }

    const databaseSchoolId = user.schoolId ? String(user.schoolId) : null;
    const tokenSchoolId = decoded.schoolId ?? null;
    if (user.role !== decoded.role || databaseSchoolId !== tokenSchoolId) {
      throw new AppError("Account security details changed. Please sign in again.", 401);
    }

    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      if (!databaseSchoolId) {
        throw new AppError("Your account is not associated with a school.", 403);
      }
      const school = await School.findOne({
        _id: databaseSchoolId,
        isDeleted: false,
      }).select("status").lean();
      if (!school || school.status !== "ACTIVE") {
        throw new AppError("This school is not active. Contact the platform administrator.", 403);
      }
    }

    // Resolve school-role permissions from trusted database configuration.
    // User-level permissions are retained as explicit grants; frontend
    // supplied permissions are never read.
    let rolePermissions: string[] = [];
    let rolePermissionsConfigured = false;
    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      const role = await PlatformRole.findOne({
        code: user.role,
        scope: "SCHOOL",
        isActive: true,
      }).select("permissions").lean();
      rolePermissionsConfigured = Boolean(role);
      rolePermissions = Array.isArray(role?.permissions) ? role.permissions : [];
    }
    const directPermissions = Array.isArray(user.permissions) ? user.permissions : [];

    req.user = {
      id: String(user._id),
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: databaseSchoolId,
      permissions: [...new Set([...rolePermissions, ...directPermissions])],
      permissionsConfigured: rolePermissionsConfigured,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      next(
        new AppError(
          "Access token has expired. Please login again.",
          401
        )
      );
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(
        new AppError(
          "Invalid access token.",
          401
        )
      );
      return;
    }

    next(error);
  }
});

// ==========================================
// OPTIONAL AUTHENTICATION
// ==========================================

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authorization = req.headers.authorization;

  // Continue without authentication if token is absent.
  if (!authorization) {
    next();
    return;
  }

  // If token is provided, it must be valid.
  authenticate(req, _res, next);
};