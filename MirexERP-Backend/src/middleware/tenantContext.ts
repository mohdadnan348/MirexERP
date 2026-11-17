
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import { USER_ROLES } from "../config/constants";
import { AppError } from "../utils/AppError";
import School from "../modules/schools/schools.model";

/**
 * Tenant context stored in Express response locals.
 */
export interface TenantContext {
  schoolId: string | null;
  isPlatformLevel: boolean;
}

/**
 * Resolve and attach the current tenant context.
 *
 * School users:
 * - Always use their authenticated schoolId.
 * - Cannot switch schools using request headers.
 *
 * Super Admin:
 * - Can optionally select a school using x-school-id.
 * - Can access platform-level routes without a school context.
 */
export const tenantContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      throw new AppError("Authentication required.", 401);
    }

    const isSuperAdmin = user.role === USER_ROLES.SUPER_ADMIN;

    let schoolId: string | null = null;

    if (isSuperAdmin) {
      const requestedSchoolId = req.get("x-school-id");

      if (requestedSchoolId) {
        if (!mongoose.Types.ObjectId.isValid(requestedSchoolId)) {
          throw new AppError("Invalid school ID.", 400);
        }

        schoolId = requestedSchoolId;
      }
    } else {
      if (!user.schoolId) {
        throw new AppError(
          "Your account is not associated with a school.",
          403
        );
      }

      if (!mongoose.Types.ObjectId.isValid(user.schoolId)) {
        throw new AppError("Invalid school context.", 403);
      }

      schoolId = user.schoolId;
    }

    // Existing school-module controllers consume req.user.schoolId.
    // For Super Admin only, mirror the already validated selected tenant
    // into the request-scoped user context so those controllers operate
    // on the selected school without changing the persisted identity/token.
    if (isSuperAdmin) {
      req.user.schoolId = schoolId;
    }

    const context: TenantContext = {
      schoolId,
      isPlatformLevel: isSuperAdmin && schoolId === null,
    };

    // Enforce the suspended-tenant read-only rule centrally for every module
    // that opts into tenantContext; platform lifecycle routes remain separate.
    const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
    if (schoolId && isWrite) {
      const school = await School.findOne({ _id: schoolId, isDeleted: false }).select("status").lean();
      if (!school) throw new AppError("School tenant was not found or is inactive.", 403);
      if (school.status === "SUSPENDED") {
        throw new AppError("This school is suspended. Tenant data is read-only until reactivated by Super Admin.", 403);
      }
    }

    res.locals.tenant = context;
    res.locals.tenantId = schoolId;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require a school tenant context.
 *
 * Use after tenantContext on routes that must operate
 * inside a specific school.
 */
export const requireTenant = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  const tenant = res.locals.tenant as TenantContext | undefined;

  if (!tenant?.schoolId) {
    next(
      new AppError(
        "A school context is required for this operation.",
        400
      )
    );
    return;
  }

  next();
};

/**
 * Get the current school ID from response locals.
 *
 * Use this helper in controllers and services.
 */
export const getTenantId = (res: Response): string => {
  const tenant = res.locals.tenant as TenantContext | undefined;

  if (!tenant?.schoolId) {
    throw new AppError("School context not found.", 400);
  }

  return tenant.schoolId;
};
