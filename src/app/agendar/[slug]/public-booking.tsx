"use client";

import { CalendarCheck, Check, Clock3, MapPin, Scissors, Sparkles, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { addDateDays, businessDate, businessTime } from "@/lib/booking-policy";

type Professional = { id: string; name: string; role: string; color: string };
type Service = { version: number; id: string; name: string; durationMin: number; priceCents: number; professionals: { professional: Professional }[] };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const dayLabel = (day: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

export function PublicBooking({ business, services, enabled }: { business: { name: string; city: string; address: string | null; slug: string; phone: string | null }; services: Service[]; enabled: boolean }) {
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(businessDate());
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState<{ key: string; slots: string[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [revision, setRevision] = useState(0);
  const service = services.find((item) => item.id === serviceId);
  const key = `${serviceId}/${professionalId}/${date}/${revision}`;
  const ready = availability?.key === key;
  const slots = ready ? availability.slots : [];
  useEffect(() => {
    if (!serviceId || !professionalId || !date) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ professionalId, serviceId, date });
    fetch(`/api/public/${business.slug}/appointments?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => setAvailability({ key, slots: data.slots }))
      .catch((reason) => { if (!controller.signal.aborted) setAvailability({ key, slots: [], error: reason instanceof Error ? reason.message : "Não foi possível consultar os horários." }); });
    return () => controller.abort();
  }, [business.slug, date, professionalId, serviceId, key]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || !slots.includes(time) || loading) return;
    setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/public/${business.slug}/appointments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceVersion: service?.version, serviceId, professionalId, startsAt: time, clientName: data.get("name"), clientPhone: data.get("phone") }) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error); if (response.status === 409) { setTime(""); setRevision((value) => value + 1); } return; }
      setDone(true);
    } catch { setError("Não conseguimos confirmar o envio. Consulte o estabelecimento antes de enviar outra solicitação."); }
    finally { setLoading(false); }
  }
  if (done) return <main className="booking-page"><div className="booking-success"><span><Check size={35}/></span><small>AGENDAMENTO SOLICITADO</small><h1>Seu próximo cuidado está a caminho.</h1><p>{business.name} recebeu sua solicitação de <strong>{service?.name}</strong> para {dayLabel(date)}, às <strong>{businessTime(new Date(time))}</strong>.</p><div><CalendarCheck/><span>Aguarde a confirmação do estabelecimento. Sem confirmação, a solicitação expira em até 24 horas ou no início do atendimento. O envio automático de mensagens ainda não está disponível.</span></div>{business.phone && <a className="button primary" target="_blank" rel="noreferrer" href={`https://wa.me/55${business.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`}>Falar com o estabelecimento</a>}</div></main>;
  return <main className="booking-page"><header className="booking-top"><div className="booking-brand"><span><Sparkles size={17}/></span>Bela</div><span>Seu tempo de cuidado começa aqui</span></header><div className="booking-layout"><aside className="booking-business"><div className="business-logo">{business.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</div><span className="eyebrow">AGENDE ONLINE</span><h1>{business.name}</h1><p><MapPin size={16}/>{[business.address, business.city].filter(Boolean).join(", ")}</p><div className="booking-promise"><Sparkles size={17}/><div><strong>Um momento para você</strong><span>Escolha seu serviço, encontre um horário e deixe o resto com a equipe.</span></div></div><p className="timezone-note">Todos os horários são de Brasília.</p></aside><section className="booking-form">
    {!enabled || !services.length ? <div className="empty"><CalendarCheck size={32}/><h2>Estamos preparando nossa agenda</h2><p>As reservas online estarão disponíveis em breve. Entre em contato com o estabelecimento para agendar.</p></div> : <>
      <div className="booking-intro"><span>01</span><div><h2>Qual cuidado combina com hoje?</h2><p>Escolha o serviço que você procura.</p></div></div><div className="service-options">{services.map((item) => <button key={item.id} aria-pressed={serviceId === item.id} className={serviceId === item.id ? "selected" : ""} onClick={() => { setServiceId(item.id); setProfessionalId(""); setTime(""); setError(""); }}><span><Scissors size={17}/></span><div><strong>{item.name}</strong><small><Clock3 size={12}/>{item.durationMin} min</small></div><b>{money(item.priceCents)}</b>{serviceId === item.id && <i><Check size={13}/></i>}</button>)}</div>
      {service && <><div className="booking-intro"><span>02</span><div><h2>Escolha seu profissional</h2><p>Quem vai cuidar de você?</p></div></div><div className="professional-options">{service.professionals.map(({ professional: item }) => <button key={item.id} aria-pressed={professionalId === item.id} className={professionalId === item.id ? "selected" : ""} onClick={() => { setProfessionalId(item.id); setTime(""); setError(""); }}><i style={{ background: `${item.color}22`, color: item.color }}><UserRound/></i><strong>{item.name}</strong><small>{item.role}</small></button>)}</div></>}
      {professionalId && <><div className="booking-intro"><span>03</span><div><h2>Encontre seu melhor horário</h2><p>Disponibilidade para o serviço completo, no horário de Brasília.</p></div></div><label className="booking-date">Data do atendimento<input className="field-input" type="date" value={date} min={businessDate()} max={addDateDays(businessDate(), 180)} onChange={(event) => { setDate(event.target.value); setTime(""); setError(""); }}/></label><div aria-live="polite">{!ready ? <p className="empty">Consultando horários...</p> : availability.error ? <p className="form-error">{availability.error} <button className="button outline" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button></p> : slots.length === 0 ? <p className="empty">Nenhum horário disponível nesta data. Experimente outro dia.</p> : <div className="time-options">{slots.map((slot) => <button key={slot} aria-pressed={time === slot} className={time === slot ? "selected" : ""} onClick={() => setTime(slot)}>{businessTime(new Date(slot))}</button>)}</div>}</div></>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {time && ready && slots.includes(time) && <form className="booking-contact" onSubmit={submit}><div className="booking-intro"><span>04</span><div><h2>Quase pronto</h2><p>Informe seus dados para a equipe entrar em contato.</p></div></div><fieldset className="settings-fieldset" disabled={loading}><div className="contact-fields"><label>Seu nome<input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Nome completo"/></label><label>WhatsApp com DDD<input name="phone" type="tel" required autoComplete="tel-national" placeholder="(47) 99999-9999"/></label></div><div className="booking-summary"><strong>{service?.name}</strong><span>{dayLabel(date)} · {businessTime(new Date(time))}</span><b>{money(service!.priceCents)}</b></div><p className="settings-note">Seus dados serão usados pelo estabelecimento para organizar este atendimento. A equipe precisa confirmar a solicitação em até 24 horas ou antes do início do atendimento, o que ocorrer primeiro.</p><button className="button primary booking-submit" disabled={loading}>{loading ? "Enviando..." : "Solicitar agendamento"}<CalendarCheck size={18}/></button></fieldset></form>}
    </>}
  </section></div><footer className="booking-footer">Feito para cuidar do seu tempo · <strong>Bela Agenda</strong></footer></main>;
}
