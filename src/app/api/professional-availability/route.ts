import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth";
import { BookingError } from "@/lib/booking-service";
import { professionalAvailabilitySchema } from "@/lib/professional-policy";
import { saveProfessionalAvailability } from "@/lib/professional-service";

export async function PATCH(request: Request) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (context.role !== "OWNER") return NextResponse.json({ error: "Somente proprietários podem alterar jornadas." }, { status: 403 });
  const parsed = z.object({ professionalId: z.string().min(1), version: z.number().int().min(0), availability: professionalAvailabilitySchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise a jornada." }, { status: 400 });
  try {
    const { professionalId, version, availability } = parsed.data;
    return NextResponse.json(await saveProfessionalAvailability(context.business.id, professionalId, version, availability));
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "professional_availability_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "Não foi possível salvar. Recarregue a página para conferir a jornada." }, { status: 500 });
  }
}
