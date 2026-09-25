"use client";

import { useEffect, useState } from "react";
import { businessDate, businessTime } from "@/lib/booking-policy";

type Event = { id: string; action: string; createdAt: string; details: { status?: string; previousStatus?: string; startsAt?: string; previousStartsAt?: string; source?: string } };
const actions: Record<string, string> = { EXPIRED: "Solicitação expirada sem confirmação", CREATED: "Agendamento criado", STATUS_CHANGED: "Status alterado", RESCHEDULED: "Reagendamento" };
const statuses: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu" };
const format = (value: string) => `${businessDate(new Date(value)).split("-").reverse().join("/")} às ${businessTime(new Date(value))}`;

export function AppointmentHistory({ id }: { id: string }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/appointments/${encodeURIComponent(id)}/history`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("history_failed");
      const result = await response.json();
      if (!controller.signal.aborted) { setEvents(result.events); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, attempt]);
  return <section className="appointment-history"><h3>Histórico do atendimento</h3><p className="settings-note">Últimas 100 alterações · Horário de Brasília</p>
    {error ? <p role="alert">Não foi possível carregar. <button type="button" className="button outline" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></p> : events === null ? <p role="status">Carregando histórico...</p> : !events.length ? <p>Não há alterações registradas para este atendimento.</p> : <ol>{events.map((event) => <li key={event.id}><strong>{actions[event.action] ?? "Alteração registrada"}</strong><time dateTime={event.createdAt}>{format(event.createdAt)}</time>
      {event.action === "STATUS_CHANGED" && <span>{statuses[event.details.previousStatus ?? ""] ?? "Anterior"} → {statuses[event.details.status ?? ""] ?? "Atualizado"}</span>}
      {event.action === "RESCHEDULED" && event.details.previousStartsAt && event.details.startsAt && <span>{format(event.details.previousStartsAt)} → {format(event.details.startsAt)}</span>}
      {event.action === "CREATED" && <span>{event.details.source === "PUBLIC_BOOKING" ? "Solicitado pela página pública" : "Criado pelo painel"}</span>}
    </li>)}</ol>}
  </section>;
}
