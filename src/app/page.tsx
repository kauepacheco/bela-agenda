import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDateDays, atBusinessTime, businessDate, businessTime, bookingSettingsSchema } from "@/lib/booking-policy";
import { statusLabels } from "@/lib/booking-service";
import { ArrowUpRight, CalendarCheck, Check, ChevronRight, CircleDollarSign, Clock3, Link2, Plus, Settings2, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const context = await requireAuthContext();
  const { business } = context;
  const now = new Date();
  const day = businessDate(now);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const monday = addDateDays(day, -(weekday === 0 ? 6 : weekday - 1));
  const [today, week, clients, upcoming, pending] = await Promise.all([
    prisma.appointment.count({ where: { businessId: business.id, startsAt: { gte: atBusinessTime(day), lt: atBusinessTime(addDateDays(day, 1)) }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: atBusinessTime(monday), lt: atBusinessTime(addDateDays(monday, 7)) }, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, include: { service: true } }),
    prisma.client.count({ where: { businessId: business.id } }),
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } }, include: { client: true, service: true, professional: true }, orderBy: { startsAt: "asc" }, take: 5 }),
    prisma.appointment.count({ where: { businessId: business.id, status: "PENDING" } }),
  ]);
  const configured = bookingSettingsSchema.safeParse(business.bookingSettings).success;
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(now);
  return <AppShell context={context}>
    <div className="page-heading"><div><span className="eyebrow">{dateLabel}</span><h1>Olá, {context.user.name.split(" ")[0]}. <span>✦</span></h1><p>Mais organização para você. Mais cuidado para seus clientes.</p></div><Link href="/agenda?novo=1" className="button primary"><Plus size={18}/> Novo agendamento</Link></div>
    <section className="welcome-banner"><div><span className="eyebrow">SEU NEGÓCIO, NO SEU RITMO</span><h2>O próximo bom atendimento<br/>começa com uma agenda leve.</h2><p>{business.name} · {business.city}</p><Link href="/agenda">Organizar minha semana <ArrowUpRight size={17}/></Link></div><div className="banner-art" aria-hidden="true"><div className="art-circle"/><Sparkles className="art-spark"/><div className="art-card"><span><CalendarCheck size={20}/> Bela Agenda</span><strong>Tempo para cuidar.</strong><div className="art-line"/><div className="art-line short"/><i><Check size={18}/></i></div></div></section>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-icon clay"><CalendarCheck/></div><div className="metric-value">{today}</div><div className="metric-label">Agendamentos hoje</div><span className="trend neutral">Sua programação do dia</span></article>
      <article className="metric-card"><div className="metric-icon green"><CircleDollarSign/></div><div className="metric-value">{money(week.reduce((total, item) => total + item.service.priceCents, 0))}</div><div className="metric-label">Valor previsto na semana</div><span className="trend neutral">{week.length} atendimentos · valores do catálogo</span></article>
      <article className="metric-card"><div className="metric-icon purple"><UsersRound/></div><div className="metric-value">{clients}</div><div className="metric-label">Clientes cadastrados</div><span className="trend neutral">Relacionamentos que crescem</span></article>
      <article className="metric-card"><div className="metric-icon clay"><Clock3/></div><div className="metric-value">{pending}</div><div className="metric-label">Aguardando confirmação</div><Link className="trend" href="/agenda">Revisar na agenda <ArrowUpRight size={14}/></Link></article>
    </section>
    <div className="dashboard-grid"><section className="panel agenda-preview"><div className="panel-head"><div><h2>Os próximos cuidados</h2><p>Atendimentos a partir de agora · Brasília</p></div><Link href="/agenda">Ver agenda <ChevronRight size={16}/></Link></div><div className="appointment-list">{upcoming.length ? upcoming.map((item) => <Link href="/agenda" className="appointment-row" key={item.id}><div className="appointment-time"><strong>{businessTime(item.startsAt)}</strong><span>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }).format(item.startsAt)}</span></div><i style={{ background: item.professional.color }}/><div className="appointment-main"><strong>{item.client.name}</strong><span>{item.service.name} · {item.professional.name}</span></div><span className={`status ${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span><ChevronRight size={16}/></Link>) : <div className="empty dashboard-empty"><CalendarCheck size={32}/><h3>Espaço para novos encontros</h3><p>Seus próximos agendamentos aparecerão aqui.</p><Link className="button outline" href="/agenda?novo=1">Agendar primeiro atendimento</Link></div>}</div></section>
      <aside className="panel activation-card"><span className="eyebrow">PRÓXIMOS PASSOS</span><h2>Prepare sua agenda</h2><p>Uma experiência simples, desde o primeiro contato.</p><div className="activation-step"><span className="done"><Check size={15}/></span><div><strong>Seu espaço está criado</strong><small>Estabelecimento, serviços e equipe</small></div></div><Link className="activation-step" href="/configuracoes"><span className={configured ? "done" : ""}>{configured ? <Check size={15}/> : "2"}</span><div><strong>{configured ? "Horários configurados" : "Defina seus horários"}</strong><small>Jornada e regras de reserva</small></div><ChevronRight size={15}/></Link><Link className="activation-step" href={`/agendar/${business.slug}`} target="_blank"><span><Link2 size={15}/></span><div><strong>Conheça sua página pública</strong><small>Teste antes de compartilhar</small></div><ChevronRight size={15}/></Link><div className="integration-label">WhatsApp automático: ainda não integrado</div><Link href="/configuracoes" className="button outline"><Settings2 size={16}/> Ajustar estabelecimento</Link></aside>
    </div>
    <section className="panel quick-panel"><div><span className="eyebrow">MENOS CLIQUES, MAIS TEMPO</span><h2>Seu dia a dia, mais fácil.</h2></div><div className="quick-actions"><Link href="/agenda?novo=1"><CalendarCheck/><span><strong>Reservar um horário</strong><small>Organize o próximo cuidado</small></span></Link><Link href="/clientes"><UsersRound/><span><strong>Conhecer seus clientes</strong><small>Contatos sempre por perto</small></span></Link><Link href="/catalogo"><Sparkles/><span><strong>Atualizar serviços</strong><small>Seu catálogo de cuidados</small></span></Link></div></section>
  </AppShell>;
}
