import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const publicAppointmentSchema = z.object({
  clientName: z.string().trim().min(2),
  clientPhone: z.string().trim().min(8),
  professionalId: z.string().min(1),
  serviceId: z.string().min(1),
  startsAt: z.coerce.date(),
});

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const query = z.object({ professionalId: z.string().min(1), start: z.coerce.date(), end: z.coerce.date() })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Consulta inválida." }, { status: 400 });

  const professional = await prisma.professional.findFirst({
    where: { id: query.data.professionalId, business: { slug }, active: true },
    select: { id: true },
  });
  if (!professional) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });

  const appointments = await prisma.appointment.findMany({
    where: { professionalId: professional.id, status: { not: "CANCELLED" }, startsAt: { gte: query.data.start, lt: query.data.end } },
    select: { startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
  });
  return NextResponse.json(appointments);
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = publicAppointmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados do agendamento." }, { status: 400 });

  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });

  const data = parsed.data;
  const service = await prisma.service.findFirst({
    where: {
      id: data.serviceId,
      businessId: business.id,
      active: true,
      professionals: { some: { professionalId: data.professionalId, professional: { businessId: business.id, active: true } } },
    },
  });
  if (!service) return NextResponse.json({ error: "Serviço ou profissional inválido." }, { status: 404 });

  const endsAt = new Date(data.startsAt.getTime() + service.durationMin * 60_000);
  const conflict = await prisma.appointment.findFirst({
    where: { businessId: business.id, professionalId: data.professionalId, status: { not: "CANCELLED" }, startsAt: { lt: endsAt }, endsAt: { gt: data.startsAt } },
    select: { id: true },
  });
  if (conflict) return NextResponse.json({ error: "Esse horário acabou de ser reservado. Escolha outro." }, { status: 409 });

  const phone = data.clientPhone.replace(/\D/g, "");
  const client = await prisma.client.upsert({
    where: { businessId_phone: { businessId: business.id, phone } },
    update: { name: data.clientName },
    create: { businessId: business.id, name: data.clientName, phone },
  });
  const appointment = await prisma.appointment.create({
    data: { businessId: business.id, clientId: client.id, professionalId: data.professionalId, serviceId: service.id, startsAt: data.startsAt, endsAt, source: "PUBLIC_BOOKING", status: "PENDING" },
    select: { id: true, startsAt: true, endsAt: true, status: true },
  });
  return NextResponse.json(appointment, { status: 201 });
}
