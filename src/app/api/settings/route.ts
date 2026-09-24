import { getCurrentContext } from "@/lib/auth";
import { bookingSettingsSchema, phoneSchema } from "@/lib/booking-policy";
import { lockBusiness } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(request: Request) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (context.role !== "OWNER") return NextResponse.json({ error: "Somente proprietários podem alterar as configurações." }, { status: 403 });
  const parsed = z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema, address: z.string().trim().min(3).max(240), city: z.string().trim().min(2).max(120), bookingSettings: bookingSettingsSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise as configurações." }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await lockBusiness(tx, context.business.id);
    await tx.business.update({ where: { id: context.business.id }, data: parsed.data });
  });
  return NextResponse.json({ ok: true });
}
