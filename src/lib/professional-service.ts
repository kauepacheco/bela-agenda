import { expirePendingBookings } from "@/lib/pending-bookings";
import { prisma } from "./prisma";
import { BookingError, lockBusiness } from "./booking-service";
import { bookingSettingsSchema } from "./booking-policy";
import { professionalAvailabilitySchema, professionalWindowError } from "./professional-policy";

export async function saveProfessionalAvailability(businessId: string, professionalId: string, version: number, raw: unknown) {
  const parsed = professionalAvailabilitySchema.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Revise a jornada.");
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    await expirePendingBookings(tx, businessId);
    const professional = await tx.professional.findFirst({ where: { id: professionalId, businessId } });
    if (!professional) throw new BookingError("Profissional não encontrado.", 404);
    if (professional.availabilityVersion !== version) throw new BookingError("Esta jornada foi alterada por outra pessoa. Recarregue a página antes de editar novamente.", 409);
    const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
    const settings = bookingSettingsSchema.safeParse(business.bookingSettings);
    const bookings = await tx.appointment.findMany({ where: { businessId, professionalId, status: { in: ["PENDING", "CONFIRMED"] }, endsAt: { gt: new Date() } }, select: { startsAt: true, endsAt: true } });
    const conflicts = bookings.filter((item) => professionalWindowError(parsed.data, item.startsAt, item.endsAt, settings.success ? settings.data.bufferMin : 0));
    if (conflicts.length) throw new BookingError(`A alteração conflita com ${conflicts.length} atendimento(s). Reagende ou cancele esses atendimentos na agenda antes de salvar.`, 409);
    return tx.professional.update({ where: { id: professional.id }, data: { availability: parsed.data, availabilityVersion: { increment: 1 } }, select: { id: true, availabilityVersion: true } });
  });
}
