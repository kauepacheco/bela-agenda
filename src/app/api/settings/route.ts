import { expirePendingBookings } from "@/lib/pending-bookings";
import { getCurrentContext } from "@/lib/auth";
import { bookingSettingsSchema, phoneSchema, workingWindowError } from "@/lib/booking-policy";
import { BookingError, lockBusiness } from "@/lib/booking-service";
import { professionalWindowError } from "@/lib/professional-policy";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(request: Request) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (context.role !== "OWNER") return NextResponse.json({ error: "Somente proprietários podem alterar as configurações." }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema, address: z.string().trim().min(3).max(240), city: z.string().trim().min(2).max(120), bookingSettings: bookingSettingsSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise as configurações." }, { status: 400 });
  try { await prisma.$transaction(async (tx) => {
    await lockBusiness(tx, context.business.id);
    await expirePendingBookings(tx, context.business.id);
    const appointments = await tx.appointment.findMany({ where: { businessId: context.business.id, status: { in: ["PENDING", "CONFIRMED"] }, endsAt: { gt: new Date() } }, include: { professional: { select: { availability: true } } }, orderBy: { startsAt: "asc" } });
    const settings = parsed.data.bookingSettings;
    const conflicts = appointments.some((item, index) =>
      workingWindowError(settings, item.startsAt, (item.endsAt.getTime() - item.startsAt.getTime()) / 60_000)
      || professionalWindowError(item.professional.availability, item.startsAt, item.endsAt, settings.bufferMin)
      || appointments.slice(index + 1).some((next) => next.professionalId === item.professionalId && next.startsAt.getTime() < item.endsAt.getTime() + settings.bufferMin * 60_000));
    if (conflicts) throw new BookingError("Os novos horários ou intervalos conflitam com atendimentos em aberto. Reagende ou cancele esses atendimentos antes de salvar.", 409);
    await tx.business.update({ where: { id: context.business.id }, data: parsed.data });
  }); } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "settings_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "Não foi possível salvar as configurações. Recarregue a página para conferir." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
