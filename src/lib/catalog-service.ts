import { z } from "zod";
import { prisma } from "./prisma";
import { BookingError, lockBusiness } from "./booking-service";
import { expirePendingBookings } from "./pending-bookings";

const name = z.string().trim().min(2).max(120);
export const catalogSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("professional"), name, role: name, color: z.string().regex(/^#[0-9a-f]{6}$/i), active: z.boolean().default(true) }),
  z.object({ type: z.literal("service"), name, durationMin: z.coerce.number().int().min(10).max(480), priceCents: z.coerce.number().int().min(0).max(100_000_000), professionalIds: z.array(z.string().min(1)).min(1).max(100), active: z.boolean().default(true) }),
]);
export const editVersionSchema = z.object({ id: z.string().min(1), version: z.number().int().nonnegative() });

export async function saveCatalog(businessId: string, data: z.infer<typeof catalogSchema>, edit?: z.infer<typeof editVersionSchema>) {
  return prisma.$transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    await expirePendingBookings(tx, businessId);
    const open = { businessId, status: { in: ["PENDING", "CONFIRMED"] } };
    if (data.type === "professional") {
      const current = edit ? await tx.professional.findFirst({ where: { id: edit.id, businessId } }) : null;
      if (edit && !current) throw new BookingError("Profissional não encontrado.", 404);
      if (current && current.version !== edit!.version) throw new BookingError("Este cadastro foi alterado. Atualize a página antes de editar novamente.", 409);
      if (current && !data.active && await tx.appointment.count({ where: { ...open, professionalId: current.id } })) throw new BookingError("Encerre ou cancele os atendimentos abertos antes de inativar este profissional.", 409);
      const values = { name: data.name, role: data.role, color: data.color, active: data.active };
      return current ? tx.professional.update({ where: { id: current.id }, data: { ...values, version: { increment: 1 } } }) : tx.professional.create({ data: { ...values, businessId } });
    }
    const current = edit ? await tx.service.findFirst({ where: { id: edit.id, businessId } }) : null;
    if (edit && !current) throw new BookingError("Serviço não encontrado.", 404);
    if (current && current.version !== edit!.version) throw new BookingError("Este cadastro foi alterado. Atualize a página antes de editar novamente.", 409);
    const ids = [...new Set(data.professionalIds)];
    // Inactive professionals may remain linked for historical continuity.
    if (await tx.professional.count({ where: { businessId, id: { in: ids } } }) !== ids.length) throw new BookingError("Profissional inválido.", 404);
    if (data.active && !await tx.professional.count({ where: { businessId, id: { in: ids }, active: true } })) throw new BookingError("Selecione pelo menos um profissional ativo.", 400);
    if (current && await tx.appointment.count({ where: { ...open, serviceId: current.id, ...(!data.active ? {} : { professionalId: { notIn: ids } }) } })) throw new BookingError("Há atendimentos abertos afetados. Encerre ou cancele esses atendimentos antes de inativar o serviço ou remover seus profissionais.", 409);
    const values = { name: data.name, durationMin: data.durationMin, priceCents: data.priceCents, active: data.active };
    return current ? tx.service.update({ where: { id: current.id }, data: { ...values, version: { increment: 1 }, professionals: { deleteMany: {}, create: ids.map((professionalId) => ({ professionalId })) } } }) : tx.service.create({ data: { ...values, businessId, professionals: { create: ids.map((professionalId) => ({ professionalId })) } } });
  });
}
