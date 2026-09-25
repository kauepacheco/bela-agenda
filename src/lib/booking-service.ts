import { expirePendingBookings, liveBookingWhere, pendingExpiry } from "./pending-bookings";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { atBusinessTime, bookingSettingsSchema, bookingWindowError, type BookingSettings } from "./booking-policy";

import { professionalWindowError } from "./professional-policy";

export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// All writers lock the business row first, including settings and status changes.
// The lock is shared across application instances and held until commit/rollback.
export async function lockBusiness(tx: Prisma.TransactionClient, businessId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`;
}

async function validateSlot(tx: Prisma.TransactionClient, businessId: string, professionalId: string, serviceId: string, startsAt: Date, excludeId?: string, reservedDuration?: number) {
  const service = await tx.service.findFirst({ where: { id: serviceId, businessId, active: true, professionals: { some: { professionalId, professional: { businessId, active: true } } } } });
  if (!service) throw new BookingError("Serviço ou profissional inválido.", 404);
  const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
  const parsed = bookingSettingsSchema.safeParse(business.bookingSettings);
  if (!parsed.success) throw new BookingError("O estabelecimento precisa configurar os horários de funcionamento antes de receber reservas.", 409);
  const durationMin = reservedDuration ?? service.durationMin;
  const error = bookingWindowError(parsed.data, startsAt, durationMin);
  if (error) throw new BookingError(error);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const professional = await tx.professional.findFirstOrThrow({ where: { id: professionalId, businessId } });
  const professionalError = professionalWindowError(professional.availability, startsAt, endsAt, parsed.data.bufferMin);
  if (professionalError) throw new BookingError(professionalError, 409);
  const buffer = parsed.data.bufferMin * 60_000;
  const conflict = await tx.appointment.findFirst({ where: {
    businessId, professionalId, id: excludeId ? { not: excludeId } : undefined,
    ...liveBookingWhere(),
    startsAt: { lt: new Date(endsAt.getTime() + buffer) }, endsAt: { gt: new Date(startsAt.getTime() - buffer) },
  } });
  if (conflict) throw new BookingError("Esse horário acabou de ser reservado ou está no intervalo entre atendimentos. Escolha outro.", 409);
  return { endsAt, service };
}

type CreateBooking = { businessId: string; professionalId: string; serviceId: string; startsAt: Date; clientId?: string; clientName?: string; clientPhone?: string; notes?: string; source: "DASHBOARD" | "PUBLIC_BOOKING"; serviceVersion?: number; actorId?: string };
export async function createBooking(data: CreateBooking) {
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, data.businessId);
    await expirePendingBookings(tx, data.businessId);
    let client = data.clientId ? await tx.client.findFirst({ where: { id: data.clientId, businessId: data.businessId, active: true } }) : null;
    if (data.clientId && !client) throw new BookingError("Cliente inválido.", 400);
    const { endsAt, service } = await validateSlot(tx, data.businessId, data.professionalId, data.serviceId, data.startsAt);
    if (data.serviceVersion !== undefined && data.serviceVersion !== service.version) throw new BookingError("O serviço foi atualizado. Recarregue a página para conferir preço, duração e profissionais antes de reservar.", 409);
    if (!client && data.clientName && data.clientPhone) {
      client = await tx.client.upsert({
        where: { businessId_phone: { businessId: data.businessId, phone: data.clientPhone } },
        // A public visitor must never overwrite an existing client's name.
        update: {}, create: { businessId: data.businessId, name: data.clientName, phone: data.clientPhone },
      });
    }
    if (client && !client.active) throw new BookingError("Entre em contato com o estabelecimento para atualizar seu cadastro.", 409);
    if (client && data.source === "PUBLIC_BOOKING") {
      const pending = await tx.appointment.count({ where: { businessId: data.businessId, clientId: client.id, status: "PENDING" } });
      if (pending >= 3) throw new BookingError("Você já tem solicitações aguardando confirmação. Fale com o estabelecimento antes de solicitar outra.", 409);
    }
    if (!client) throw new BookingError("Selecione ou informe o cliente.");
    return tx.appointment.create({ data: {
      businessId: data.businessId, professionalId: data.professionalId, serviceId: data.serviceId, clientId: client.id,
      serviceName: service.name, priceCents: service.priceCents, durationMin: service.durationMin,
      startsAt: data.startsAt, endsAt, notes: data.notes, source: data.source,
      status: data.source === "PUBLIC_BOOKING" ? "PENDING" : "CONFIRMED",
      pendingExpiresAt: data.source === "PUBLIC_BOOKING" ? pendingExpiry(data.startsAt) : null,
      history: { create: { action: "CREATED", actorId: data.actorId, details: { startsAt: data.startsAt.toISOString(), source: data.source } } },
    }, include: { client: true, service: true, professional: true } });
  });
}

export const appointmentStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export const statusLabels: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };
export async function changeBooking(businessId: string, data: { id: string; expectedStatus?: typeof appointmentStatuses[number]; status?: typeof appointmentStatuses[number]; startsAt?: Date }, actorId?: string) {
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    await expirePendingBookings(tx, businessId);
    const item = await tx.appointment.findFirst({ where: { id: data.id, businessId } });
    if (!item) throw new BookingError("Agendamento não encontrado.", 404);
    if (data.expectedStatus && data.expectedStatus !== item.status) throw new BookingError("Este pedido já foi alterado. Atualize as solicitações antes de continuar.", 409);
    if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(item.status)) throw new BookingError("Este atendimento já foi encerrado. Crie um novo agendamento.", 409);
    if (data.status === "PENDING") throw new BookingError("Não é possível transformar um atendimento em solicitação pendente.");
    if (data.startsAt && data.status) throw new BookingError("Reagende e altere o status em operações separadas.");
    if ((data.status === "COMPLETED" || data.status === "NO_SHOW") && item.startsAt > new Date()) throw new BookingError("Aguarde o horário do atendimento para concluir ou marcar falta.");
    const endsAt = data.startsAt ? await validateSlot(tx, businessId, item.professionalId, item.serviceId, data.startsAt, item.id, item.durationMin) : undefined;
    return tx.appointment.update({ where: { id: item.id }, data: {
      status: data.status, startsAt: data.startsAt, endsAt: endsAt?.endsAt,
      pendingExpiresAt: data.status ? null : data.startsAt && item.status === "PENDING"
        ? new Date(Math.min(item.pendingExpiresAt?.getTime() ?? Infinity, pendingExpiry(data.startsAt).getTime())) : undefined,
      history: { create: { action: data.startsAt ? "RESCHEDULED" : "STATUS_CHANGED", actorId, details: { previousStatus: item.status, status: data.status ?? item.status, previousStartsAt: item.startsAt.toISOString(), startsAt: (data.startsAt ?? item.startsAt).toISOString() } } },
    }, include: { client: true, service: true, professional: true } });
  });
}

export async function availableSlots(businessId: string, professionalId: string, serviceId: string, day: string) {
  const [business, service, professional] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.service.findFirst({ where: { id: serviceId, businessId, active: true, professionals: { some: { professionalId, professional: { active: true, businessId } } } } }),
    prisma.professional.findFirst({ where: { id: professionalId, businessId, active: true } }),
  ]);
  if (!service || !professional) throw new BookingError("Serviço ou profissional inválido.", 404);
  const parsed = bookingSettingsSchema.safeParse(business.bookingSettings);
  if (!parsed.success) return [];
  const settings: BookingSettings = parsed.data;
  const schedule = settings.days[new Date(`${day}T12:00:00Z`).getUTCDay()];
  if (!schedule.enabled) return [];
  const open = atBusinessTime(day, schedule.open);
  const close = atBusinessTime(day, schedule.close);
  const buffer = settings.bufferMin * 60_000;
  const busy = await prisma.appointment.findMany({ where: { businessId, professionalId, ...liveBookingWhere(), startsAt: { lt: new Date(close.getTime() + buffer) }, endsAt: { gt: new Date(open.getTime() - buffer) } }, select: { startsAt: true, endsAt: true } });
  const now = new Date();
  const slots: string[] = [];
  for (let time = open.getTime(); time < close.getTime(); time += 15 * 60_000) {
    const start = new Date(time);
    const end = time + service.durationMin * 60_000;
    if (!bookingWindowError(settings, start, service.durationMin, now) && !professionalWindowError(professional.availability, start, new Date(end), settings.bufferMin) && !busy.some((item) => item.startsAt.getTime() < end + buffer && item.endsAt.getTime() > time - buffer)) slots.push(start.toISOString());
  }
  return slots;
}


export async function refreshPendingBookings(businessId: string) {
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    return expirePendingBookings(tx, businessId);
  });
}
