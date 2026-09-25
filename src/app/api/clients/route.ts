import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { phoneSchema } from "@/lib/booking-policy";
import { BookingError, lockBusiness } from "@/lib/booking-service";
import { expirePendingBookings } from "@/lib/pending-bookings";
import { editVersionSchema } from "@/lib/catalog-service";

const schema = z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema, notes: z.string().trim().max(500).optional(), active: z.boolean().default(true) });
async function save(request: Request, editing: boolean) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const raw = await request.json().catch(() => null);
  const body = schema.safeParse(raw);
  const edit = editing ? editVersionSchema.safeParse(raw) : null;
  if (!body.success || (edit && !edit.success)) return NextResponse.json({ error: "Informe nome e telefone válidos." }, { status: 400 });
  try {
    const client = await prisma.$transaction(async (tx) => {
      await lockBusiness(tx, context.business.id);
      if (!editing) return tx.client.create({ data: { businessId: context.business.id, ...body.data } });
      const { id, version } = editVersionSchema.parse(raw);
      const current = await tx.client.findFirst({ where: { id, businessId: context.business.id } });
      if (!current) throw new BookingError("Cliente não encontrado.", 404);
      if (current.phone.startsWith("removed-")) throw new BookingError("Este contato foi removido. Crie um novo cadastro se o cliente retornar.", 409);
      if (current.version !== version) throw new BookingError("Este cadastro foi alterado. Atualize a página antes de editar novamente.", 409);
      if (!body.data.active) {
        await expirePendingBookings(tx, context.business.id);
        if (await tx.appointment.count({ where: { businessId: context.business.id, clientId: id, status: { in: ["PENDING", "CONFIRMED"] } } })) throw new BookingError("Encerre ou cancele os atendimentos abertos antes de inativar este cliente.", 409);
      }
      return tx.client.update({ where: { id }, data: { ...body.data, version: { increment: 1 } } });
    });
    return NextResponse.json(client, { status: editing ? 200 : 201 });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Já existe um cliente com esse telefone." }, { status: 409 });
    console.error(JSON.stringify({ event: "client_save_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "Não foi possível salvar. Atualize a página para conferir antes de tentar novamente." }, { status: 500 });
  }
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
