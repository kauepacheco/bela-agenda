import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "./prisma";

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
  }
}

// PostgreSQL is the shared authority: no per-process counters or check-then-write race.
export async function consumeRateLimit(scope: string, identity: string, limit: number, seconds: number) {
  const key = createHash("sha256").update(JSON.stringify([scope, identity])).digest("hex");
  const rows = await prisma.$queryRaw<{ count: number; retryAfter: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
    VALUES (${key}, 1, clock_timestamp() + make_interval(secs => ${seconds}::int))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= clock_timestamp() THEN 1 ELSE LEAST("RateLimitBucket"."count" + 1, ${limit + 1}::int) END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + make_interval(secs => ${seconds}::int) ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - clock_timestamp()))))::int AS "retryAfter"
  `;
  if (rows[0].count > limit) throw new RateLimitError(rows[0].retryAfter);
}

export function networkIdentity(headers: Pick<Headers, "get">) {
  // Only configure a header that the ingress overwrites and cannot be bypassed.
  // Do not automatically trust arbitrary X-Forwarded-For from the internet.
  const trusted = process.env.TRUSTED_CLIENT_IP_HEADER;
  const value = trusted ? headers.get(trusted)?.trim() : null;
  if (!value || !isIP(value)) return "shared-ingress";
  // Group IPv6 by /64 so rotating interface identifiers cannot bypass the quota.
  if (isIP(value) === 6) {
    const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
    const [left, right] = normalized.split("::");
    const a = left ? left.split(":") : [];
    const b = right ? right.split(":") : [];
    const words = right !== undefined ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
    return words.slice(0, 4).map((word) => word.padStart(4, "0")).join(":");
  }
  return value;
}

export async function limitNetwork(scope: string, headers: Pick<Headers, "get">, limit: number, seconds: number) {
  await consumeRateLimit(`${scope}:network`, networkIdentity(headers), limit, seconds);
}
