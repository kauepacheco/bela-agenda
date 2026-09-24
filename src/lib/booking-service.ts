import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { atBusinessTime, bookingSettingsSchema, bookingWindowError, type BookingSettings } from "./booking-policy";

export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// All writers lock the business row first, including settings and status changes.
// The lock is shared across application instances and held until commit/rollback.
export async function lockBusiness(tx: Prisma.TransactionClient, businessId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`;
}

async function validateSlot(tx: Prisma.TransactionClient, businessId: string, professionalId: string, serviceId: string, startsAt: Date, excludeId?: string) {
  const service = await tx.service.findFirst({ where: { id: serviceId, businessId, active: true, professionals: { some: { professionalId, professional: { businessId, active: true } } } } });
  if (!service) throw new BookingError("Serviço ou profissional inválido.", 404);
  const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
  const parsed = bookingSettingsSchema.safeParse(business.bookingSettings);
  if (!parsed.success) throw new BookingError("O estabelecimento precisa configurar os horários de funcionamento antes de receber reservas.", 409);
  const error = bookingWindowError(parsed.data, startsAt, service.durationMin);
  if (error) throw new BookingError(error);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const buffer = parsed.data.bufferMin * 60_000;
  const conflict = await tx.appointment.findFirst({ where: {
    businessId, professionalId, id: excludeId ? { not: excludeId } : undefined,
    status: { notIn: ["CANCELLED", "NO_SHOW"] },
    startsAt: { lt: new Date(endsAt.getTime() + buffer) }, endsAt: { gt: new Date(startsAt.getTime() - buffer) },
  } });
  if (conflict) throw new BookingError("Esse horário acabou de ser reservado ou está no intervalo entre atendimentos. Escolha outro.", 409);
  return endsAt;
}

type CreateBooking = { businessId: string; professionalId: string; serviceId: string; startsAt: Date; clientId?: string; clientName?: string; clientPhone?: string; notes?: string; source: "DASHBOARD" | "PUBLIC_BOOKING"; actorId?: string };
export async function createBooking(data: CreateBooking) {
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, data.businessId);
    let client = data.clientId ? await tx.client.findFirst({ where: { id: data.clientId, businessId: data.businessId } }) : null;
    if (data.clientId && !client) throw new BookingError("Cliente inválido.", 400);
    const endsAt = await validateSlot(tx, data.businessId, data.professionalId, data.serviceId, data.startsAt);
    if (!client && data.clientName && data.clientPhone) {
      client = await tx.client.upsert({
        where: { businessId_phone: { businessId: data.businessId, phone: data.clientPhone } },
        // A public visitor must never overwrite an existing client's name.
        update: {}, create: { businessId: data.businessId, name: data.clientName, phone: data.clientPhone },
      });
    }
    if (!client) throw new BookingError("Selecione ou informe o cliente.");
    return tx.appointment.create({ data: {
      businessId: data.businessId, professionalId: data.professionalId, serviceId: data.serviceId, clientId: client.id,
      startsAt: data.startsAt, endsAt, notes: data.notes, source: data.source,
      status: data.source === "PUBLIC_BOOKING" ? "PENDING" : "CONFIRMED",
      history: { create: { action: "CREATED", actorId: data.actorId, details: { startsAt: data.startsAt.toISOString(), source: data.source } } },
    }, include: { client: true, service: true, professional: true } });
  });
}

export const appointmentStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export const statusLabels: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };
export async function changeBooking(businessId: string, data: { id: string; status?: typeof appointmentStatuses[number]; startsAt?: Date }, actorId?: string) {
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const item = await tx.appointment.findFirst({ where: { id: data.id, businessId } });
    if (!item) throw new BookingError("Agendamento não encontrado.", 404);
    if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(item.status)) throw new BookingError("Este atendimento já foi encerrado. Crie um novo agendamento.", 409);
    if (data.startsAt && data.status) throw new BookingError("Reagende e altere o status em operações separadas.");
    if ((data.status === "COMPLETED" || data.status === "NO_SHOW") && item.startsAt > new Date()) throw new BookingError("Aguarde o horário do atendimento para concluir ou marcar falta.");
    const endsAt = data.startsAt ? await validateSlot(tx, businessId, item.professionalId, item.serviceId, data.startsAt, item.id) : undefined;
    return tx.appointment.update({ where: { id: item.id }, data: {
      status: data.status, startsAt: data.startsAt, endsAt,
      history: { create: { action: data.startsAt ? "RESCHEDULED" : "STATUS_CHANGED", actorId, details: { previousStatus: item.status, status: data.status ?? item.status, previousStartsAt: item.startsAt.toISOString(), startsAt: (data.startsAt ?? item.startsAt).toISOString() } } },
    }, include: { client: true, service: true, professional: true } });
  });
}

export async function availableSlots(businessId: string, professionalId: string, serviceId: string, day: string) {
  const [business, service] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.service.findFirst({ where: { id: serviceId, businessId, active: true, professionals: { some: { professionalId, professional: { active: true, businessId } } } } }),
  ]);
  if (!service) throw new BookingError("Serviço ou profissional inválido.", 404);
  const parsed = bookingSettingsSchema.safeParse(business.bookingSettings);
  if (!parsed.success) return [];
  const settings: BookingSettings = parsed.data;
  const schedule = settings.days[new Date(`${day}T12:00:00Z`).getUTCDay()];
  if (!schedule.enabled) return [];
  const open = atBusinessTime(day, schedule.open);
  const close = atBusinessTime(day, schedule.close);
  const buffer = settings.bufferMin * 60_000;
  const busy = await prisma.appointment.findMany({ where: { businessId, professionalId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, startsAt: { lt: new Date(close.getTime() + buffer) }, endsAt: { gt: new Date(open.getTime() - buffer) } }, select: { startsAt: true, endsAt: true } });
  const now = new Date();
  const slots: string[] = [];
  for (let time = open.getTime(); time < close.getTime(); time += 15 * 60_000) {
    const start = new Date(time);
    const end = time + service.durationMin * 60_000;
    if (!bookingWindowError(settings, start, service.durationMin, now) && !busy.some((item) => item.startsAt.getTime() < end + buffer && item.endsAt.getTime() > time - buffer)) slots.push(start.toISOString());
  }
  return slots;
}
