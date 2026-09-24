import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("professional"), name: z.string().trim().min(2), role: z.string().trim().min(2), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  z.object({ type: z.literal("service"), name: z.string().trim().min(2), durationMin: z.coerce.number().int().min(10).max(480), priceCents: z.coerce.number().int().min(0), professionalId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados informados." }, { status: 400 });
  const business = (await getCurrentContext())?.business;
  if (!business) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (parsed.data.type === "professional") {
    const item = await prisma.professional.create({ data: { businessId: business.id, name: parsed.data.name, role: parsed.data.role, color: parsed.data.color } });
    return NextResponse.json(item, { status: 201 });
  }
  const professional = await prisma.professional.findFirst({ where: { id: parsed.data.professionalId, businessId: business.id, active: true } });
  if (!professional) return NextResponse.json({ error: "Profissional inválido." }, { status: 404 });
  const item = await prisma.service.create({ data: { businessId: business.id, name: parsed.data.name, durationMin: parsed.data.durationMin, priceCents: parsed.data.priceCents, professionals: { create: { professionalId: professional.id } } }, include: { professionals: true } });
  return NextResponse.json(item, { status: 201 });
}
