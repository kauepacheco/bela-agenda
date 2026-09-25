import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, networkIdentity } from "@/lib/rate-limit";

beforeEach(async () => { await prisma.rateLimitBucket.deleteMany(); });
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("limites compartilhados de abuso", () => {
  it("permite exatamente a cota sob concorrência", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => consumeRateLimit("login", "test@example.com", 5, 60)));
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(5);
    const rejected = results.filter((item) => item.status === "rejected");
    expect(rejected).toHaveLength(7);
    expect((rejected[0] as PromiseRejectedResult).reason.retryAfter).toBeGreaterThan(0);
    const bucket = await prisma.rateLimitBucket.findFirstOrThrow();
    expect(bucket.count).toBe(6);
    expect(bucket.key).not.toContain("test@example.com");
  });
  it("reinicia a cota expirada e isola identidade e operação", async () => {
    await consumeRateLimit("login", "one", 1, 60);
    await expect(consumeRateLimit("login", "one", 1, 60)).rejects.toMatchObject({ retryAfter: expect.any(Number) });
    await consumeRateLimit("login", "two", 1, 60);
    await consumeRateLimit("signup", "one", 1, 60);
    await prisma.rateLimitBucket.updateMany({ data: { expiresAt: new Date(0) } });
    await expect(consumeRateLimit("login", "one", 1, 60)).resolves.toBeUndefined();
  });
  it("ignora IP forjado sem proxy confiável e agrupa IPv6 por /64", () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "");
    expect(networkIdentity(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("shared-ingress");
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "x-real-ip");
    expect(networkIdentity(new Headers({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(networkIdentity(new Headers({ "x-real-ip": "1.2.3.4, 2.3.4.5" }))).toBe("shared-ingress");
    expect(networkIdentity(new Headers({ "x-real-ip": "2001:db8:abcd:12::1" }))).toBe(networkIdentity(new Headers({ "x-real-ip": "2001:db8:abcd:12::dead" })));
  });
});
