import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingError, refreshPendingBookings, changeBooking, createBooking, appointmentStatuses } from "@/lib/booking-service";
import { phoneSchema } from "@/lib/booking-policy";
import { NextResponse } from "next/server";
import { z } from "zod";

const appointmentSchema = z.object({
  serviceVersion: z.number().int().nonnegative().optional(), clientId: z.string().optional(), clientName: z.string().trim().min(2).max(120).optional(),
  clientPhone: phoneSchema.optional(), professionalId: z.string().min(1), serviceId: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)), notes: z.string().trim().max(500).optional(),
});

function bookingResponse(error: unknown) {
  if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(JSON.stringify({ event: "booking_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  return NextResponse.json({ error: "Não foi possível salvar. Atualize a agenda para conferir antes de tentar novamente." }, { status: 500 });
}

export async function GET(request: Request) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const query = z.object({ start: z.coerce.date(), end: z.coerce.date() }).refine(({ start, end }) => end >= start && end.getTime() - start.getTime() <= 93 * 86400_000).safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Informe um período válido de até 93 dias." }, { status: 400 });
  await refreshPendingBookings(context.business.id);
  const appointments = await prisma.appointment.findMany({ where: { businessId: context.business.id, startsAt: { gte: query.data.start, lte: query.data.end } }, include: { client: true, service: true, professional: true }, orderBy: { startsAt: "asc" } });
  return NextResponse.json(appointments);
}

export async function POST(request: Request) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parsed = appointmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados do agendamento." }, { status: 400 });
  try {
    const appointment = await createBooking({ ...parsed.data, businessId: context.business.id, actorId: context.membershipId, source: "DASHBOARD" });
    return NextResponse.json(appointment, { status: 201 });
  } catch (error) { return bookingResponse(error); }
}

export async function PATCH(request: Request) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parsed = z.object({ id: z.string().min(1), expectedStatus: z.enum(appointmentStatuses).optional(), status: z.enum(appointmentStatuses).optional(), startsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional() })
    .refine((data) => Boolean(data.status) !== Boolean(data.startsAt)).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });
  try { return NextResponse.json(await changeBooking(context.business.id, parsed.data, context.membershipId)); }
  catch (error) { return bookingResponse(error); }
}
