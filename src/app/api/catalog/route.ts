import { getCurrentContext } from "@/lib/auth";
import { NextResponse } from "next/server";
import { BookingError } from "@/lib/booking-service";
import { catalogSchema, editVersionSchema, saveCatalog } from "@/lib/catalog-service";

async function save(request: Request, editing: boolean) {
  const context = await getCurrentContext();
  if (!context) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (context.role !== "OWNER") return NextResponse.json({ error: "Somente o proprietário pode alterar o catálogo." }, { status: 403 });
  const body = await request.json().catch(() => null);
  // Accept the original single-professional contract as well as multiple links.
  const parsed = catalogSchema.safeParse(body?.type === "service" && !body.professionalIds ? { ...body, professionalIds: [body.professionalId] } : body);
  const edit = editing ? editVersionSchema.safeParse(body) : null;
  if (!parsed.success || (edit && !edit.success)) return NextResponse.json({ error: "Revise os dados informados." }, { status: 400 });
  try {
    return NextResponse.json(await saveCatalog(context.business.id, parsed.data, edit?.success ? edit.data : undefined), { status: editing ? 200 : 201 });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "catalog_save_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "Não foi possível salvar. Atualize a página para conferir antes de tentar novamente." }, { status: 500 });
  }
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
