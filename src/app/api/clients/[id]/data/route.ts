import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingError, lockBusiness } from "@/lib/booking-service";
import { expirePendingBookings } from "@/lib/pending-bookings";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const context = await getCurrentContext();
  if (!context) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (context.role !== "OWNER") return Response.json({ error: "Somente o proprietário pode exportar dados." }, { status: 403 });
  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id, businessId: context.business.id }, select: {
    id: true, name: true, phone: true, notes: true, createdAt: true, active: true,
    appointments: { orderBy: { startsAt: "asc" }, select: { id: true, serviceName: true, startsAt: true, endsAt: true, durationMin: true, priceCents: true, priceEstimated: true, status: true, source: true, notes: true, createdAt: true } },
  } });
  if (!client) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
  return Response.json({ exportedAt: new Date().toISOString(), timezone: "America/Sao_Paulo", currency: "BRL", client }, {
    headers: { "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="dados-cliente.json"', "X-Content-Type-Options": "nosniff" },
  });
}

// Removes direct contact identifiers; does not claim to erase the whole account,
// backups, external exports, or all possible indirect identifiers in history.
export async function DELETE(request: Request, { params }: Context) {
  const context = await getCurrentContext();
  if (!context) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (context.role !== "OWNER") return Response.json({ error: "Somente o proprietário pode remover dados de contato." }, { status: 403 });
  const { id } = await params;
  const parsed = z.object({ confirmation: z.literal("REMOVER CONTATO"), version: z.number().int().nonnegative() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Confirme a remoção dos dados de contato." }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      await lockBusiness(tx, context.business.id);
      await expirePendingBookings(tx, context.business.id);
      const client = await tx.client.findFirst({ where: { id, businessId: context.business.id } });
      if (!client) throw new BookingError("Cliente não encontrado.", 404);
      if (client.version !== parsed.data.version) throw new BookingError("O cadastro mudou. Atualize a página antes de continuar.", 409);
      if (await tx.appointment.count({ where: { businessId: context.business.id, clientId: id, status: { in: ["PENDING", "CONFIRMED"] } } })) throw new BookingError("Encerre ou cancele os atendimentos abertos antes de remover o contato.", 409);
      await tx.appointment.updateMany({ where: { businessId: context.business.id, clientId: id }, data: { notes: null } });
      await tx.client.update({ where: { id }, data: { name: "Contato removido", phone: `removed-${id}`, notes: null, active: false, version: { increment: 1 } } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "contact_removal_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "Não foi possível remover o contato. Atualize a página para conferir." }, { status: 500 });
  }
}
