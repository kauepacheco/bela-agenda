import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { refreshPendingBookings } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";
import { RequestCard, RefreshRequests } from "./request-card";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requireAuthContext();
  await refreshPendingBookings(context.business.id);
  const query = await searchParams;
  const requested = Number(query.page ?? 1);
  const where = { businessId: context.business.id, status: "PENDING" };
  const count = await prisma.appointment.count({ where });
  const pages = Math.max(1, Math.ceil(count / 50));
  const page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  const appointments = await prisma.appointment.findMany({
    where, take: 50, skip: (page - 1) * 50,
    orderBy: [{ pendingExpiresAt: "asc" }, { startsAt: "asc" }, { id: "asc" }],
    select: { id: true, serviceName: true, priceCents: true, priceEstimated: true, startsAt: true, status: true, pendingExpiresAt: true, client: { select: { name: true, phone: true } }, professional: { select: { name: true } } },
  });
  return <AppShell context={context}>
    <div className="page-heading"><div><span className="eyebrow">CONFIRMAÇÃO PELA EQUIPE</span><h1>Solicitações</h1><p>{count} pedido(s) aguardando confirmação, em ordem de vencimento.</p></div><RefreshRequests/></div>
    <p className="settings-note">Confirme ou recuse cada pedido e avise o cliente pelo canal combinado. Solicitações expiram em até 24 horas ou no início do atendimento. O atalho do WhatsApp abre um rascunho para você revisar e enviar.</p>
    <div className="requests-grid">{appointments.map((item) => <RequestCard key={`${item.id}:${item.startsAt.toISOString()}:${item.pendingExpiresAt?.toISOString()}`} item={{ ...item, startsAt: item.startsAt.toISOString(), pendingExpiresAt: item.pendingExpiresAt?.toISOString() ?? null }} businessName={context.business.name}/>)}</div>
    {!appointments.length && <section className="panel empty"><h2>Tudo em dia</h2><p>Os novos pedidos da página pública aparecerão aqui.</p><Link className="button outline" href="/agenda">Ver agenda</Link></section>}
    {pages > 1 && <nav className="request-pagination" aria-label="Páginas de solicitações">{page > 1 && <Link className="button outline" href={`/solicitacoes?page=${page - 1}`}>Anterior</Link>}<span>Página {page} de {pages}</span>{page < pages && <Link className="button outline" href={`/solicitacoes?page=${page + 1}`}>Próxima</Link>}</nav>}
  </AppShell>;
}
