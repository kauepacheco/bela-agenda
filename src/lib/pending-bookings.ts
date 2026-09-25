import type { Prisma } from "@prisma/client";

export const PENDING_HOURS = 24;
export function pendingExpiry(startsAt: Date, now = new Date()) {
  return new Date(Math.min(startsAt.getTime(), now.getTime() + PENDING_HOURS * 3600_000));
}

export function liveBookingWhere(now = new Date()): Prisma.AppointmentWhereInput {
  return { status: { notIn: ["CANCELLED", "NO_SHOW"] }, OR: [
    { status: { not: "PENDING" } },
    { pendingExpiresAt: null },
    { pendingExpiresAt: { gt: now } },
  ] };
}

// Caller must hold the business lock; status and audit event commit together.
export async function expirePendingBookings(tx: Prisma.TransactionClient, businessId: string, now = new Date()) {
  const expired = await tx.appointment.findMany({ where: { businessId, status: "PENDING", pendingExpiresAt: { lte: now } }, select: { id: true, pendingExpiresAt: true } });
  if (!expired.length) return 0;
  await tx.appointment.updateMany({ where: { id: { in: expired.map((item) => item.id) } }, data: { status: "CANCELLED" } });
  await tx.appointmentEvent.createMany({ data: expired.map((item) => ({ appointmentId: item.id, action: "EXPIRED", details: { previousStatus: "PENDING", status: "CANCELLED", expiresAt: item.pendingExpiresAt!.toISOString() } })) });
  return expired.length;
}
