import { prisma } from "../src/lib/prisma";
import { refreshPendingBookings } from "../src/lib/booking-service";

async function main() {
  const now = new Date();
  const businesses = await prisma.appointment.findMany({ where: { status: "PENDING", pendingExpiresAt: { lte: now } }, distinct: ["businessId"], select: { businessId: true } });
  let expiredBookings = 0;
  for (const { businessId } of businesses) expiredBookings += await refreshPendingBookings(businessId);
  const [buckets, sessions, tokens] = await Promise.all([
    prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } }),
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } }),
  ]);
  console.log(JSON.stringify({ event: "maintenance_completed", expiredBookings, expiredRateLimitBuckets: buckets.count, expiredSessions: sessions.count, expiredResetTokens: tokens.count }));
}
main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: "maintenance_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
