import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDay, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, ChevronRight, CircleDollarSign, Clock3, MessageCircle, Plus, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const context = await requireAuthContext();
  const { business } = context;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const [today, week, clients, upcoming] = await Promise.all([
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: todayStart, lte: todayEnd }, status: { not: "CANCELLED" } }, include: { service: true } }),
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: weekStart, lte: weekEnd }, status: { not: "CANCELLED" } }, include: { service: true } }),
    prisma.client.count({ where: { businessId: business.id } }),
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: now }, status: { not: "CANCELLED" } }, include: { client: true, service: true, professional: true }, orderBy: { startsAt: "asc" }, take: 4 }),
  ]);
  const weekRevenue = week.reduce((total, item) => total + item.service.priceCents, 0);
  return <AppShell context={context}>
    <div className="page-heading"><div><span className="eyebrow">SEXTA-FEIRA, {format(now, "dd 'DE' MMMM", { locale: ptBR }).toUpperCase()}</span><h1>Bom dia, {context.user.name.split(" ")[0]} <span>✦</span></h1><p>Aqui está o pulso do seu negócio hoje.</p></div><Link href="/agenda?novo=1" className="button primary"><Plus size={18} /> Novo agendamento</Link></div>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-icon clay"><CalendarCheck /></div><div className="metric-value">{today.length}</div><div className="metric-label">Agendamentos hoje</div><span className="trend positive"><ArrowUpRight size={15} /> agenda do dia</span></article>
      <article className="metric-card"><div className="metric-icon green"><CircleDollarSign /></div><div className="metric-value">{money(weekRevenue)}</div><div className="metric-label">Previsto nesta semana</div><span className="trend positive"><ArrowUpRight size={15} /> {week.length} atendimentos</span></article>
      <article className="metric-card"><div className="metric-icon purple"><UsersRound /></div><div className="metric-value">{clients}</div><div className="metric-label">Clientes cadastrados</div><span className="trend neutral"><ArrowDownRight size={15} /> base inicial</span></article>
      <article className="metric-card assistant-metric"><div className="metric-icon dark"><MessageCircle /></div><div className="metric-value">68%</div><div className="metric-label">Atendidos automaticamente</div><span className="trend positive"><Sparkles size={14} /> secretária ativa</span></article>
    </section>
    <div className="dashboard-grid">
      <section className="panel agenda-preview"><div className="panel-head"><div><h2>Próximos atendimentos</h2><p>Sua agenda a partir de agora</p></div><Link href="/agenda">Ver agenda <ChevronRight size={16} /></Link></div>
        <div className="appointment-list">{upcoming.length ? upcoming.map((item) => <div className="appointment-row" key={item.id}><div className="appointment-time"><strong>{format(item.startsAt, "HH:mm")}</strong><span>{format(item.startsAt, "dd MMM", { locale: ptBR })}</span></div><i style={{ background: item.professional.color }} /><div className="appointment-main"><strong>{item.client.name}</strong><span>{item.service.name} · {item.professional.name}</span></div><span className={`status ${item.status.toLowerCase()}`}>{item.status === "CONFIRMED" ? "Confirmado" : "Pendente"}</span><button className="icon-button"><ChevronRight size={18} /></button></div>) : <div className="empty">Nenhum próximo atendimento.</div>}</div>
      </section>
      <aside className="panel assistant-card"><div className="assistant-orb"><Sparkles size={23} /></div><span className="eyebrow">SECRETÁRIA VIRTUAL</span><h2>A Bela está trabalhando</h2><p>Respondendo seus clientes e mantendo sua agenda organizada.</p><div className="assistant-stat"><MessageCircle size={18} /><div><strong>12 conversas</strong><span>atendidas hoje</span></div></div><div className="assistant-stat"><Clock3 size={18} /><div><strong>2h 18min</strong><span>economizados</span></div></div><button className="button soft">Ver conversas</button></aside>
    </div>
    <section className="panel quick-panel"><div><span className="eyebrow">ATALHOS</span><h2>O que você quer fazer?</h2></div><div className="quick-actions"><Link href="/agenda?novo=1"><CalendarCheck /><span><strong>Novo horário</strong><small>Agende um cliente</small></span></Link><Link href="/clientes"><UsersRound /><span><strong>Novo cliente</strong><small>Adicione à sua base</small></span></Link><Link href={`/agendar/${business.slug}`} target="_blank"><MessageCircle /><span><strong>Testar página pública</strong><small>Veja como o cliente</small></span></Link></div></section>
  </AppShell>;
}
