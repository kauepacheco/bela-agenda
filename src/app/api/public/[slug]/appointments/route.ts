import { consumeRateLimit, limitNetwork, RateLimitError } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { availableSlots, BookingError, createBooking } from "@/lib/booking-service";
import { phoneSchema } from "@/lib/booking-policy";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ serviceVersion: z.number().int().nonnegative().optional(), clientName: z.string().trim().min(2).max(120), clientPhone: phoneSchema, professionalId: z.string().min(1), serviceId: z.string().min(1), startsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)) });
const responseError = (error: unknown) => {
  if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
  if (!(error instanceof BookingError)) console.error(JSON.stringify({ event: "public_booking_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  return NextResponse.json({ error: error instanceof BookingError ? error.message : "Não foi possível processar. Confira sua reserva com o estabelecimento antes de tentar novamente." }, { status: error instanceof BookingError ? error.status : 500 });
};

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { await limitNetwork(request.method === "GET" ? "public-slots" : "public-booking", request.headers, request.method === "GET" ? 120 : 20, 900); } catch (error) { return responseError(error); }
  const { slug } = await params;
  const query = z.object({ professionalId: z.string().min(1), serviceId: z.string().min(1), date: z.iso.date() }).safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Consulta inválida." }, { status: 400 });
  const business = await prisma.business.findFirst({ where: { slug, onboardingCompletedAt: { not: null } }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });
  try { return NextResponse.json({ slots: await availableSlots(business.id, query.data.professionalId, query.data.serviceId, query.data.date) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return responseError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { await limitNetwork(request.method === "GET" ? "public-slots" : "public-booking", request.headers, request.method === "GET" ? 120 : 20, 900); } catch (error) { return responseError(error); }
  const { slug } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe nome, telefone com DDD e um horário válido." }, { status: 400 });
  const business = await prisma.business.findFirst({ where: { slug, onboardingCompletedAt: { not: null } }, select: { id: true } });
  if (!business) return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });
  try {
    await consumeRateLimit("public-booking:business", business.id, 60, 3600);
    await consumeRateLimit("public-booking:phone", `${business.id}:${parsed.data.clientPhone}`, 3, 3600);
    const result = await createBooking({ ...parsed.data, businessId: business.id, source: "PUBLIC_BOOKING" });
    return NextResponse.json({ id: result.id, startsAt: result.startsAt, endsAt: result.endsAt, status: result.status }, { status: 201 });
  } catch (error) { return responseError(error); }
}
