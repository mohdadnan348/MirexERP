/**
 * Atomically consume an active refresh session.
 *
 * MongoDB applies the `revokedAt: null` predicate and update as one document
 * operation. Only the request that matches the still-active session may
 * rotate the token; concurrent replays receive `false`.
 */
export async function consumeRefreshSession(
  collection: {
    updateOne: (
      filter: any,
      update: any
    ) => Promise<{ matchedCount: number }>;
  },
  userId: unknown,
  tokenHash: string,
  now: Date = new Date()
): Promise<boolean> {
  const result = await collection.updateOne(
    { userId, tokenHash, revokedAt: null },
    { $set: { revokedAt: now, updatedAt: now } }
  );

  return result.matchedCount === 1;
}
