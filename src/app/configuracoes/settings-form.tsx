"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Save, Store, ExternalLink } from "lucide-react";
import { weekdays, type BookingSettings } from "@/lib/booking-policy";

export function SettingsForm({ business, initialSettings, canEdit, configured }: { business: { name: string; phone: string; address: string; city: string; slug: string }; initialSettings: BookingSettings; canEdit: boolean; configured: boolean }) {
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, bookingSettings: settings }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error); return; }
      setMessage("Configurações salvas. Os próximos agendamentos já seguem estes horários."); router.refresh();
    } catch { setError("Não foi possível salvar. Verifique sua conexão e tente novamente."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="settings-layout">
    <div>
      {!configured && <div className="setup-notice"><Clock3 size={20}/><p><strong>Falta só configurar sua disponibilidade</strong><span>Revise os horários e salve para liberar novas reservas.</span></p></div>}
      <fieldset disabled={!canEdit || pending} className="settings-fieldset">
        <section className="panel settings-panel"><div className="panel-head"><div><h2><Store size={19}/> Dados do negócio</h2><p>Estas informações aparecem na sua página pública.</p></div></div><div className="form-grid"><label className="full">Nome do estabelecimento<input name="name" defaultValue={business.name} required maxLength={120}/></label><label>WhatsApp<input name="phone" type="tel" defaultValue={business.phone} required/></label><label>Cidade<input name="city" defaultValue={business.city} required maxLength={120}/></label><label className="full">Endereço<input name="address" defaultValue={business.address} required maxLength={240}/></label></div></section>
        <section className="panel settings-panel"><div className="panel-head"><div><h2><Clock3 size={19}/> Horários de funcionamento</h2><p>Horário de Brasília · America/Sao_Paulo. Aplicado a todos os profissionais.</p></div></div><div className="schedule-rows">{weekdays.map((name, index) => <div className="schedule-row" key={name}><label><input type="checkbox" checked={settings.days[index].enabled} onChange={(event) => setSettings({ ...settings, days: settings.days.map((day, i) => i === index ? { ...day, enabled: event.target.checked } : day) })}/>{name}</label><input aria-label={`Abertura — ${name}`} type="time" value={settings.days[index].open} disabled={!settings.days[index].enabled} onChange={(event) => setSettings({ ...settings, days: settings.days.map((day, i) => i === index ? { ...day, open: event.target.value } : day) })}/><span>até</span><input aria-label={`Fechamento — ${name}`} type="time" value={settings.days[index].close} disabled={!settings.days[index].enabled} onChange={(event) => setSettings({ ...settings, days: settings.days.map((day, i) => i === index ? { ...day, close: event.target.value } : day) })}/></div>)}</div><div className="form-grid booking-rules"><label>Antecedência mínima (minutos)<input type="number" min={0} max={10080} required value={settings.minNoticeMin} onChange={(event) => setSettings({ ...settings, minNoticeMin: Number(event.target.value) })}/></label><label>Reservar até (dias à frente)<input type="number" min={1} max={180} required value={settings.maxAdvanceDays} onChange={(event) => setSettings({ ...settings, maxAdvanceDays: Number(event.target.value) })}/></label><label>Intervalo entre serviços (minutos)<input type="number" min={0} max={120} required value={settings.bufferMin} onChange={(event) => setSettings({ ...settings, bufferMin: Number(event.target.value) })}/></label></div></section>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
      {canEdit ? <button disabled={pending} className="button primary settings-save"><Save size={17}/>{pending ? "Salvando..." : "Salvar configurações"}</button> : <p className="settings-note">Peça a um proprietário para alterar estas informações.</p>}
    </div><aside className="panel settings-aside"><span className="eyebrow">SUA VITRINE ONLINE</span><h2>Um link. Mais praticidade.</h2><p>Compartilhe a página do seu estabelecimento para receber solicitações de agendamento.</p><a className="button outline" href={`/agendar/${business.slug}`} target="_blank" rel="noreferrer">Abrir página <ExternalLink size={16}/></a><hr/><h3>Como a agenda funciona</h3><p>O serviço completo e o intervalo precisam caber na jornada. Reservas simultâneas são verificadas ao salvar.</p><p>Alterar a jornada não cancela atendimentos existentes. Revise sua agenda após mudanças.</p><span className="integration-label">WhatsApp automático ainda não integrado</span></aside>
  </form>;
}
