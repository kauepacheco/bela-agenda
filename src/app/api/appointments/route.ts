import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const appointmentSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().trim().min(2).optional(),
  clientPhone: z.string().trim().min(8).optional(),
  professionalId: z.string().min(1),
  serviceId: z.string().min(1),
  startsAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

async function authenticatedBusiness() {
  return (await getCurrentContext())?.business;
}

export async function GET(request: Request) {
  const business = await authenticatedBusiness();
  if (!business) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const url = new URL(request.url);
  const start = new Date(url.searchParams.get("start") ?? Date.now());
  const end = new Date(url.searchParams.get("end") ?? Date.now());
  const appointments = await prisma.appointment.findMany({
    where: { businessId: business.id, startsAt: { gte: start, lte: end } },
    include: { client: true, service: true, professional: true },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(appointments);
}

export async function POST(request: Request) {
  const parsed = appointmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados do agendamento." }, { status: 400 });
  const business = await authenticatedBusiness();
  if (!business) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const data = parsed.data;
  const [service, professional] = await Promise.all([
    prisma.service.findFirst({ where: { id: data.serviceId, businessId: business.id, active: true } }),
    prisma.professional.findFirst({ where: { id: data.professionalId, businessId: business.id, active: true } }),
  ]);
  if (!service || !professional) return NextResponse.json({ error: "Serviço ou profissional inválido." }, { status: 404 });
  const endsAt = new Date(data.startsAt.getTime() + service.durationMin * 60_000);
  const conflict = await prisma.appointment.findFirst({
    where: { businessId: business.id, professionalId: professional.id, status: { not: "CANCELLED" }, startsAt: { lt: endsAt }, endsAt: { gt: data.startsAt } },
  });
  if (conflict) return NextResponse.json({ error: "Esse profissional já possui um atendimento nesse horário." }, { status: 409 });
  let client;
  if (data.clientId) client = await prisma.client.findFirst({ where: { id: data.clientId, businessId: business.id } });
  else if (data.clientName && data.clientPhone) client = await prisma.client.upsert({
    where: { businessId_phone: { businessId: business.id, phone: data.clientPhone.replace(/\D/g, "") } },
    update: { name: data.clientName },
    create: { businessId: business.id, name: data.clientName, phone: data.clientPhone.replace(/\D/g, "") },
  });
  if (!client) return NextResponse.json({ error: "Selecione ou informe o cliente." }, { status: 400 });
  const appointment = await prisma.appointment.create({
    data: { businessId: business.id, clientId: client.id, professionalId: professional.id, serviceId: service.id, startsAt: data.startsAt, endsAt, source: "DASHBOARD", notes: data.notes, status: "CONFIRMED" },
    include: { client: true, service: true, professional: true },
  });
  return NextResponse.json(appointment, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = z.object({ id: z.string(), status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]) }).safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });
  const business = await authenticatedBusiness();
  if (!business) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const updated = await prisma.appointment.updateMany({ where: { id: body.data.id, businessId: business.id }, data: { status: body.data.status } });
  if (!updated.count) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
