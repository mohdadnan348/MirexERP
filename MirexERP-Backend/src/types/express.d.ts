
import type { Types } from "mongoose";

export interface AuthenticatedUser {
  id: string;
  userId: string;
  _id?: string | Types.ObjectId;
  name?: string;
  email: string;
  role: string;
  schoolId: string | null;
  permissions?: string[];
  permissionsConfigured?: boolean;
  sessionId?: string | null;
  employeeId?: string | null;
}

export interface TenantContext {
  schoolId: string;
  sessionId?: string | null;
  employeeId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenant?: TenantContext;
      schoolId?: string | null;
    }
  }
}

export {};
