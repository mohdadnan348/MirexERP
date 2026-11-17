import test from "node:test";
import assert from "node:assert/strict";
import { consumeRefreshSession } from "../src/modules/auth/refresh-session";

test("refresh session can be consumed only once", async () => {
  let revokedAt: Date | null = null;
  const collection = {
    async updateOne(filter: Record<string, unknown>, update: Record<string, any>) {
      if (filter.revokedAt !== null || revokedAt !== null) return { matchedCount: 0 };
      revokedAt = update.$set.revokedAt;
      return { matchedCount: 1 };
    },
  };

  const results = await Promise.all([
    consumeRefreshSession(collection, "user-1", "hashed-token", new Date("2026-11-14T10:00:00.000Z")),
    consumeRefreshSession(collection, "user-1", "hashed-token", new Date("2026-11-14T10:00:01.000Z")),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter((value) => !value).length, 1);
  assert.ok(revokedAt instanceof Date);
});

test("refresh session consumption requires an active-session match", async () => {
  const collection = { async updateOne() { return { matchedCount: 0 }; } };
  assert.equal(await consumeRefreshSession(collection, "user-1", "unknown-token"), false);
});
