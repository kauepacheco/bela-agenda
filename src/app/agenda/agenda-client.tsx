"use client";

import { ChevronLeft, ChevronRight, Plus, CalendarDays, List } from "lucide-react";
import { useRef, useState } from "react";
import { addDateDays, atBusinessTime, businessDate, businessTime } from "@/lib/booking-policy";
import { AppointmentHistory } from "./appointment-history";
import { manualContactUrl } from "@/lib/manual-contact";
import { Dialog } from "@/components/dialog";

type Person = { id: string; name: string; role: string; color: string };
type Service = { version: number; id: string; name: string; durationMin: number; priceCents: number; professionals: { professionalId: string }[] };
type Client = { id: string; name: string; phone: string };
type Appointment = { id: string; serviceName: string; priceCents: number; durationMin: number; priceEstimated: boolean; startsAt: string; endsAt: string; status: string; pendingExpiresAt?: string | null; client: Client; professional: Person; service: Service };
const labels: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };
const monday = () => { const day = businessDate(); const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); return addDateDays(day, -(weekday === 0 ? 6 : weekday - 1)); };
const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

export function AgendaClient({ businessName, initialAppointments, professionals, services, clients, initialOpen = false }: { businessName: string; initialAppointments: Appointment[]; professionals: Person[]; services: Service[]; clients: Client[]; initialOpen?: boolean }) {
  const [week, setWeek] = useState(monday);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [modal, setModal] = useState(initialOpen);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [professional, setProfessional] = useState("");
  const [status, setStatus] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [view, setView] = useState<"week" | "list" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(businessDate);
  const sequence = useRef(0);
  const days = Array.from({ length: 7 }, (_, index) => addDateDays(week, index));
  const filtered = appointments.filter((item) => (!professional || item.professional.id === professional) && (!status || item.status === status) && (view !== "day" || businessDate(new Date(item.startsAt)) === selectedDay));
  async function loadWeek(next: string) {
    const request = ++sequence.current; setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ start: atBusinessTime(next).toISOString(), end: new Date(atBusinessTime(addDateDays(next, 7)).getTime() - 1).toISOString() });
      const response = await fetch(`/api/appointments?${query}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (request === sequence.current) { setWeek(next); setAppointments(data); if (selectedDay < next || selectedDay >= addDateDays(next, 7)) setSelectedDay(next); }
    } catch { if (request === sequence.current) setError("Não foi possível carregar a agenda. Tente novamente."); }
    finally { if (request === sequence.current) setLoading(false); }
  }
  async function save(body: object, method: "POST" | "PATCH") {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/appointments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) { setError(data.error); return; }
      setAppointments((current) => [...current.filter((item) => item.id !== data.id), data].filter((item) => businessDate(new Date(item.startsAt)) >= week && businessDate(new Date(item.startsAt)) < addDateDays(week, 7)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setModal(false); setSelected(null);
    } catch { setError("Não foi possível confirmar a alteração. Atualize a agenda antes de tentar novamente."); }
    finally { setSaving(false); }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void save({ serviceVersion: services.find((item) => item.id === serviceId)?.version, clientId: data.get("clientId"), serviceId: data.get("serviceId"), professionalId: data.get("professionalId"), startsAt: atBusinessTime(String(data.get("date")), String(data.get("time"))).toISOString() }, "POST");
  }
  const contact = selected ? manualContactUrl(selected, businessName) : null;
  const openAppointment = (item: Appointment) => { setError(""); setSelected(item); };
  return <>
    <div className="page-heading"><div><span className="eyebrow">ESPAÇO PARA CADA CUIDADO</span><h1>Sua agenda, em ordem.</h1><p>Atendimentos da equipe · Horário de Brasília</p></div><button className="button primary" onClick={() => { setModal(true); setError(""); }}><Plus size={18}/> Novo agendamento</button></div>
    <div className="agenda-filters"><div className="view-switch"><button aria-pressed={view === "day"} onClick={() => setView("day")}>Dia</button><button aria-pressed={view === "week"} onClick={() => setView("week")}><CalendarDays size={16}/> Semana</button><button aria-pressed={view === "list"} onClick={() => setView("list")}><List size={16}/> Lista</button></div><select aria-label="Filtrar por profissional" value={professional} onChange={(event) => setProfessional(event.target.value)}><option value="">Toda a equipe</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span>{filtered.length} atendimentos</span></div>
    {view === "day" && <label className="agenda-day-picker">Dia do atendimento<select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>{days.map((day) => <option key={day} value={day}>{dateLabel(day, { weekday: "short", day: "2-digit", month: "short" })}</option>)}</select></label>}
    {error && !modal && !selected && <p role="alert" className="form-error">{error}</p>}
    <section className={`calendar panel ${loading ? "loading" : ""}`} aria-busy={loading}><div className="calendar-toolbar"><div className="calendar-nav"><button aria-label="Semana anterior" disabled={loading} onClick={() => loadWeek(addDateDays(week, -7))}><ChevronLeft/></button><button aria-label="Próxima semana" disabled={loading} onClick={() => loadWeek(addDateDays(week, 7))}><ChevronRight/></button><button className="today-btn" disabled={loading} onClick={() => loadWeek(monday())}>Hoje</button></div><h2>{dateLabel(week, { day: "2-digit", month: "short" })} — {dateLabel(days[6], { day: "2-digit", month: "short", year: "numeric" })}</h2><span className="calendar-timezone">Brasília (BRT)</span></div>
      {view === "week" ? <div className="week-board">{days.map((day) => <section className={`week-column ${day === businessDate() ? "is-today" : ""}`} key={day}><header><span>{dateLabel(day, { weekday: "short" })}</span><strong>{day.slice(-2)}</strong></header><div>{filtered.filter((item) => businessDate(new Date(item.startsAt)) === day).map((item) => <button className="appointment-tile" key={item.id} style={{ borderLeftColor: item.professional.color }} onClick={() => openAppointment(item)}><time>{businessTime(new Date(item.startsAt))} — {businessTime(new Date(item.endsAt))}</time><strong>{item.client.name}</strong><span>{item.serviceName}</span><small>{item.professional.name}</small><span className={`status ${item.status.toLowerCase()}`}>{labels[item.status]}</span></button>)}{!filtered.some((item) => businessDate(new Date(item.startsAt)) === day) && <p className="day-empty">Sem atendimentos</p>}</div></section>)}</div> : <div className="agenda-list">{filtered.length === 0 && <div className="empty">Nenhum atendimento neste período com os filtros selecionados.</div>}{filtered.map((item) => <button key={item.id} className="agenda-list-item" onClick={() => openAppointment(item)}><time>{dateLabel(businessDate(new Date(item.startsAt)), { day: "2-digit", month: "short" })}<strong>{businessTime(new Date(item.startsAt))}</strong></time><div><strong>{item.client.name}</strong><span>{item.serviceName} · {item.professional.name}</span></div><span className={`status ${item.status.toLowerCase()}`}>{labels[item.status]}</span><ChevronRight size={17}/></button>)}</div>}
    </section>
    {modal && <Dialog busy={saving} title="Agendar atendimento" onClose={() => { if (!saving) setModal(false); }}><form className="form-grid" onSubmit={submit}><label className="full">Cliente<select name="clientId" required defaultValue=""><option value="" disabled>Selecione um cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}</select></label><label>Serviço<select name="serviceId" required value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="" disabled>Selecione</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMin} min</option>)}</select></label><label>Profissional<select key={serviceId} name="professionalId" required defaultValue=""><option value="" disabled>Selecione</option>{professionals.filter((item) => services.find((service) => service.id === serviceId)?.professionals.some((link) => link.professionalId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Data<input name="date" type="date" min={businessDate()} required defaultValue={businessDate()}/></label><label>Horário de Brasília<input name="time" type="time" required defaultValue="09:00"/></label>{!clients.length && <p className="settings-note full">Cadastre um cliente na página Clientes antes de agendar.</p>}{error && <p role="alert" className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button outline" disabled={saving} onClick={() => setModal(false)}>Voltar</button><button className="button primary" disabled={saving || !clients.length}>{saving ? "Salvando..." : "Confirmar horário"}</button></div></form></Dialog>}
    {selected && <Dialog busy={saving} title={selected.client.name} onClose={() => { if (!saving) setSelected(null); }}><div className="appointment-detail"><span className={`status ${selected.status.toLowerCase()}`}>{labels[selected.status]}</span><h3>{selected.serviceName}</h3><p>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selected.priceCents / 100)} · {selected.durationMin} min{selected.priceEstimated && " · Preço estimado a partir do catálogo na migração"}</p><p>{selected.professional.name} · {dateLabel(businessDate(new Date(selected.startsAt)), { dateStyle: "long" })} · {businessTime(new Date(selected.startsAt))}</p>{selected.status === "PENDING" && selected.pendingExpiresAt && <p>Confirmar até {dateLabel(businessDate(new Date(selected.pendingExpiresAt)), { day: "2-digit", month: "short" })} às {businessTime(new Date(selected.pendingExpiresAt))}. Após esse prazo, o horário será liberado.</p>}</div>{!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(selected.status) && <><div className="status-actions">{selected.status === "PENDING" && <button disabled={saving} className="button primary" onClick={() => save({ id: selected.id, status: "CONFIRMED" }, "PATCH")}>Confirmar</button>}{new Date(selected.startsAt) <= new Date() && <><button disabled={saving} className="button outline" onClick={() => save({ id: selected.id, status: "COMPLETED" }, "PATCH")}>Concluir</button><button disabled={saving} className="button outline" onClick={() => save({ id: selected.id, status: "NO_SHOW" }, "PATCH")}>Marcar falta</button></>}<button disabled={saving} className="button danger" onClick={() => { if (window.confirm("Cancelar este atendimento? O horário ficará disponível para novas reservas.")) void save({ id: selected.id, status: "CANCELLED" }, "PATCH"); }}>Cancelar atendimento</button></div><form className="form-grid reschedule-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void save({ id: selected.id, startsAt: atBusinessTime(String(data.get("date")), String(data.get("time"))).toISOString() }, "PATCH"); }}><h3 className="full">Reagendar</h3><label>Nova data<input type="date" name="date" min={businessDate()} required defaultValue={businessDate(new Date(selected.startsAt))}/></label><label>Horário de Brasília<input type="time" name="time" required defaultValue={businessTime(new Date(selected.startsAt))}/></label><button disabled={saving} className="button outline full">Salvar novo horário</button></form></>}{error && <p role="alert" className="form-error">{error}</p>}{contact && <div className="manual-contact"><a className="button outline" href={contact} target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp</a><p className="settings-note">Revise o rascunho e envie a mensagem pelo WhatsApp. As alterações na agenda não enviam avisos automaticamente.</p></div>}<AppointmentHistory key={selected.id} id={selected.id}/></Dialog>}
  </>;
}
