import type { Db } from "../db";

// Atomic upsert so two serverless instances share one counter.
export async function consumeSharedRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<{ ok: boolean; remaining: number }> {
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? limit + 1);
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}
