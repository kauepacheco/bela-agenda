import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const appointment = await prisma.appointment.findFirst({ where: { id, businessId: context.business.id }, select: { id: true } });
  if (!appointment) return NextResponse.json({ error: "Atendimento não encontrado." }, { status: 404 });
  const events = await prisma.appointmentEvent.findMany({ where: { appointmentId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, action: true, details: true, createdAt: true } });
  return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
}
