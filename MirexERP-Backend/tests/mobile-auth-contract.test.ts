import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema, logoutSchema } from "../src/modules/auth/auth.validation";

test("mobile login payload matches the strict backend login contract", () => {
  const valid = loginSchema.safeParse({
    body: { email: "parent@school.test", password: "SchoolPassword123!" },
  });
  assert.equal(valid.success, true);
});

test("client-selected role is rejected by the backend login contract", () => {
  const invalid = loginSchema.safeParse({
    body: {
      email: "parent@school.test",
      password: "SchoolPassword123!",
      role: "PARENT",
    },
  });
  assert.equal(invalid.success, false);
});

test("logout requires a refresh token so server-side revocation is explicit", () => {
  assert.equal(logoutSchema.safeParse({ body: {} }).success, false);
  assert.equal(
    logoutSchema.safeParse({ body: { refreshToken: "refresh-token-value" } }).success,
    true,
  );
});
