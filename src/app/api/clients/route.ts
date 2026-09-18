import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) {
  const body = z.object({ name: z.string().trim().min(2), phone: z.string().trim().min(8), notes: z.string().trim().max(500).optional() }).safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Informe nome e telefone válidos." }, { status: 400 });
  const business = (await getCurrentContext())?.business;
  if (!business) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const phone = body.data.phone.replace(/\D/g, "");
  try {
    const client = await prisma.client.create({ data: { businessId: business.id, name: body.data.name, phone, notes: body.data.notes } });
    return NextResponse.json(client, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe um cliente com esse telefone." }, { status: 409 });
  }
}
