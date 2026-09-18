"use client";

import { addDays, addWeeks, endOfWeek, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Filter, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

type Person = { id: string; name: string; role: string; color: string };
type Service = { id: string; name: string; durationMin: number; priceCents: number };
type Client = { id: string; name: string; phone: string };
type Appointment = { id: string; startsAt: string; endsAt: string; status: string; client: Client; professional: Person; service: Service };

const hours = Array.from({ length: 11 }, (_, i) => i + 8);
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function AgendaClient({ initialAppointments, professionals, services, clients, initialOpen = false }: { initialAppointments: Appointment[]; professionals: Person[]; services: Service[]; clients: Client[]; initialOpen?: boolean }) {
  const [week, setWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState(initialAppointments);
  const [modal, setModal] = useState(initialOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(week, i)), [week]);
  async function loadWeek(next: Date) {
    setWeek(next); setLoading(true);
    const res = await fetch(`/api/appointments?start=${next.toISOString()}&end=${endOfWeek(next, { weekStartsOn: 1 }).toISOString()}`);
    setAppointments(await res.json()); setLoading(false);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const fd = new FormData(event.currentTarget);
    const date = String(fd.get("date")); const time = String(fd.get("time"));
    const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: fd.get("clientId"), professionalId: fd.get("professionalId"), serviceId: fd.get("serviceId"), startsAt: new Date(`${date}T${time}:00`), source: "DASHBOARD" }) });
    const payload = await res.json(); setLoading(false);
    if (!res.ok) return setError(payload.error);
    setAppointments((current) => [...current, payload]); setModal(false);
  }
  return <>
    <div className="page-heading agenda-heading"><div><span className="eyebrow">ORGANIZAÇÃO DO DIA</span><h1>Agenda</h1><p>Visualize e organize os horários da sua equipe.</p></div><div className="heading-actions"><button className="button outline"><Filter size={17} /> Filtrar</button><button className="button primary" onClick={() => setModal(true)}><Plus size={18} /> Novo agendamento</button></div></div>
    <section className={`calendar panel ${loading ? "loading" : ""}`}>
      <div className="calendar-toolbar"><div className="calendar-nav"><button onClick={() => loadWeek(addWeeks(week, -1))}><ChevronLeft /></button><button onClick={() => loadWeek(addWeeks(week, 1))}><ChevronRight /></button><button className="today-btn" onClick={() => loadWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoje</button></div><h2>{format(week, "MMMM 'de' yyyy", { locale: ptBR })}</h2><div className="team-key">{professionals.map((p) => <span key={p.id}><i style={{ background: p.color }} />{p.name.split(" ")[0]}</span>)}</div></div>
      <div className="calendar-grid"><div className="calendar-corner" />{days.map((day) => <div key={day.toISOString()} className={`calendar-day-head ${isToday(day) ? "today" : ""}`}><span>{format(day, "EEE", { locale: ptBR })}</span><strong>{format(day, "dd")}</strong></div>)}
        {hours.flatMap((hour) => [<div className="calendar-hour" key={`h-${hour}`}>{String(hour).padStart(2,"0")}:00</div>, ...days.map((day) => {
          const items = appointments.filter((a) => isSameDay(new Date(a.startsAt), day) && new Date(a.startsAt).getHours() === hour && a.status !== "CANCELLED");
          return <div className={`calendar-cell ${isToday(day) ? "today-col" : ""}`} key={`${day.toISOString()}-${hour}`}>{items.map((a) => { const start = new Date(a.startsAt); return <div className="calendar-event" key={a.id} style={{ borderLeftColor: a.professional.color, background: `${a.professional.color}14` }}><strong>{format(start,"HH:mm")} · {a.client.name}</strong><span>{a.service.name}</span><small>{a.professional.name.split(" ")[0]}</small></div>; })}</div>;
        })])}
      </div>
    </section>
    {modal && <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setModal(false)}><div className="modal"><div className="modal-head"><div><span className="eyebrow">NOVO HORÁRIO</span><h2>Agendar atendimento</h2></div><button onClick={() => setModal(false)}><X /></button></div><form onSubmit={submit} className="form-grid"><label className="full">Cliente<select name="clientId" required defaultValue=""><option value="" disabled>Selecione um cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label><label>Serviço<select name="serviceId" required defaultValue=""><option value="" disabled>Selecione</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.priceCents)}</option>)}</select></label><label>Profissional<select name="professionalId" required defaultValue=""><option value="" disabled>Selecione</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Data<input name="date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} /></label><label>Horário<input name="time" type="time" required defaultValue="09:00" /></label>{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button outline" onClick={() => setModal(false)}>Cancelar</button><button className="button primary" disabled={loading}>{loading ? "Salvando..." : "Confirmar horário"}</button></div></form></div></div>}
  </>;
}
