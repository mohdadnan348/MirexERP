import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { tenantContext, requireTenant } from "../src/middleware/tenantContext";
import { authorize } from "../src/middleware/authorize";
import { AppError } from "../src/utils/AppError";

const SCHOOL_A = new mongoose.Types.ObjectId().toString();
const SCHOOL_B = new mongoose.Types.ObjectId().toString();

function createContext(role: string, schoolId: string | null, requestedSchoolId?: string) {
  const req: any = {
    user: { userId: "user-1", role, schoolId },
    get: (header: string) => header.toLowerCase() === "x-school-id" ? requestedSchoolId : undefined,
  };
  const res: any = { locals: {} };
  let error: unknown;
  let nextCalls = 0;
  const next = (value?: unknown) => { error = value; nextCalls += 1; };
  return { req, res, next, get error() { return error; }, get nextCalls() { return nextCalls; } };
}

test("school users are always scoped to their token school, ignoring X-School-Id", () => {
  const ctx = createContext("SCHOOL_ADMIN", SCHOOL_A, SCHOOL_B);
  tenantContext(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.error, undefined);
  assert.equal(ctx.res.locals.tenant.schoolId, SCHOOL_A);
  assert.equal(ctx.res.locals.tenant.isPlatformLevel, false);
  assert.equal(ctx.req.user.schoolId, SCHOOL_A);
});

test("Super Admin can select a valid school context", () => {
  const ctx = createContext("SUPER_ADMIN", null, SCHOOL_B);
  tenantContext(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.error, undefined);
  assert.equal(ctx.res.locals.tenant.schoolId, SCHOOL_B);
  assert.equal(ctx.res.locals.tenant.isPlatformLevel, false);
  assert.equal(ctx.req.user.schoolId, SCHOOL_B);
});

test("Super Admin without a selected school receives platform context", () => {
  const ctx = createContext("SUPER_ADMIN", null);
  tenantContext(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.error, undefined);
  assert.equal(ctx.res.locals.tenant.schoolId, null);
  assert.equal(ctx.res.locals.tenant.isPlatformLevel, true);
});

test("invalid Super Admin school selector is rejected", () => {
  const ctx = createContext("SUPER_ADMIN", null, "not-an-object-id");
  tenantContext(ctx.req, ctx.res, ctx.next);
  assert.ok(ctx.error instanceof AppError);
  assert.equal((ctx.error as AppError).statusCode, 400);
});

test("requireTenant rejects platform context for school-only endpoints", () => {
  const ctx = createContext("SUPER_ADMIN", null);
  tenantContext(ctx.req, ctx.res, ctx.next);
  let error: unknown;
  requireTenant(ctx.req, ctx.res, (value?: unknown) => { error = value; });
  assert.ok(error instanceof AppError);
  assert.equal((error as AppError).statusCode, 400);
});

test("requireTenant accepts a resolved school context", () => {
  const ctx = createContext("SCHOOL_ADMIN", SCHOOL_A);
  tenantContext(ctx.req, ctx.res, ctx.next);
  let nextCalled = false;
  requireTenant(ctx.req, ctx.res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("authorize permits only explicitly configured roles", () => {
  let nextCalled = false;
  let error: unknown;
  const middleware = authorize("ACCOUNTANT", "SCHOOL_ADMIN");
  middleware(
    { user: { role: "ACCOUNTANT", userId: "user-1", schoolId: SCHOOL_A } } as any,
    {} as any,
    (value?: unknown) => { error = value; nextCalled = !value; },
  );
  assert.equal(error, undefined);
  assert.equal(nextCalled, true);
});

test("authorize blocks roles not configured for the route", () => {
  let error: unknown;
  const middleware = authorize("ACCOUNTANT");
  middleware(
    { user: { role: "TEACHER", userId: "user-2", schoolId: SCHOOL_A } } as any,
    {} as any,
    (value?: unknown) => { error = value; },
  );
  assert.ok(error instanceof AppError);
  assert.equal((error as AppError).statusCode, 403);
});

test("Super Admin has full route-level role access", () => {
  let nextCalled = false;
  let error: unknown;
  const middleware = authorize("ACCOUNTANT");
  middleware(
    { user: { role: "SUPER_ADMIN", userId: "platform-admin", schoolId: null } } as any,
    {} as any,
    (value?: unknown) => { error = value; nextCalled = !value; },
  );
  assert.equal(error, undefined);
  assert.equal(nextCalled, true);
});

test("configured school-role permissions are enforced for the requested API action", () => {
  let nextCalled = false;
  let error: unknown;
  const middleware = authorize("TEACHER");
  middleware({
    user: { role: "TEACHER", userId: "teacher-1", schoolId: SCHOOL_A, permissions: ["attendance.mark"], permissionsConfigured: true },
    baseUrl: "/api/v1/attendance",
    originalUrl: "/api/v1/attendance/bulk",
    method: "POST",
  } as any, {} as any, (value?: unknown) => { error = value; nextCalled = !value; });
  assert.equal(error, undefined);
  assert.equal(nextCalled, true);
});

test("configured school-role permissions deny actions not granted in the role matrix", () => {
  let error: unknown;
  const middleware = authorize("TEACHER");
  middleware({
    user: { role: "TEACHER", userId: "teacher-1", schoolId: SCHOOL_A, permissions: ["attendance.read"], permissionsConfigured: true },
    baseUrl: "/api/v1/attendance",
    originalUrl: "/api/v1/attendance/bulk",
    method: "POST",
  } as any, {} as any, (value?: unknown) => { error = value; });
  assert.ok(error instanceof AppError);
  assert.equal((error as AppError).statusCode, 403);
});
