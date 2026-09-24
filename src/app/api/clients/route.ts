import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { phoneSchema } from "@/lib/booking-policy";

export async function POST(request: Request) {
  const body = z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema, notes: z.string().trim().max(500).optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Informe nome e telefone válidos." }, { status: 400 });
  const business = (await getCurrentContext())?.business;
  if (!business) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const phone = body.data.phone.replace(/\D/g, "");
  try {
    const client = await prisma.client.create({ data: { businessId: business.id, name: body.data.name, phone, notes: body.data.notes } });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Já existe um cliente com esse telefone." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível cadastrar o cliente. Tente novamente." }, { status: 500 });
  }
}
