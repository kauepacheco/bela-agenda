"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { atBusinessTime, businessDate, businessTime, weekdays, type BookingSettings } from "@/lib/booking-policy";
import { professionalAvailabilitySchema, type ProfessionalAvailability } from "@/lib/professional-policy";

type Professional = { id: string; name: string; version: number; availability: ProfessionalAvailability };
const localDateTime = (iso: string) => `${businessDate(new Date(iso))}T${businessTime(new Date(iso))}`;

export function ProfessionalSchedules({ professionals, settings, canEdit }: { professionals: Professional[]; settings: BookingSettings; canEdit: boolean }) {
  return <section className="professional-schedules"><h2>Jornadas e ausências</h2><p className="settings-note">Horário de Brasília. A jornada individual funciona dentro dos horários do estabelecimento. Separe os períodos para reservar pausas de almoço. Alterações que afetem atendimentos em aberto serão recusadas.</p>
    {!professionals.length && <p>Cadastre profissionais no catálogo para configurar suas jornadas.</p>}
    {professionals.map((professional) => <ScheduleForm key={professional.id} professional={professional} settings={settings} canEdit={canEdit}/>)}
  </section>;
}

function ScheduleForm({ professional, settings, canEdit }: { professional: Professional; settings: BookingSettings; canEdit: boolean }) {
  const [availability, setAvailability] = useState(professional.availability);
  const [version, setVersion] = useState(professional.version);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [reason, setReason] = useState("");
  const router = useRouter();

  function updateDay(index: number, periods: { open: string; close: string }[]) {
    setAvailability({ ...availability, week: availability.week!.map((day, i) => i === index ? periods : day) });
  }
  function addBlock() {
    setError(""); setMessage("");
    if (!blockStart || !blockEnd || !reason.trim()) { setError("Informe início, fim e motivo do bloqueio."); return; }
    const convert = (value: string) => atBusinessTime(value.slice(0, 10), value.slice(11, 16)).toISOString();
    const updated = { ...availability, blocks: [...availability.blocks, { startsAt: convert(blockStart), endsAt: convert(blockEnd), reason }] };
    const parsed = professionalAvailabilitySchema.safeParse(updated);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setAvailability(parsed.data); setBlockStart(""); setBlockEnd(""); setReason("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (blockStart || blockEnd || reason) { setError("Adicione o bloqueio preenchido à lista antes de salvar, ou limpe os campos."); return; }
    const parsed = professionalAvailabilitySchema.safeParse(availability);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      const response = await fetch("/api/professional-availability", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ professionalId: professional.id, version, availability: parsed.data }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error); return; }
      setVersion(result.availabilityVersion);
      setMessage("Jornada e bloqueios salvos."); router.refresh();
    } catch { setError("Não foi possível salvar. Confira sua conexão e recarregue a página antes de tentar novamente."); }
    finally { setPending(false); }
  }
  return <details className="panel professional-schedule"><summary>{professional.name}</summary><form onSubmit={submit}>
    <fieldset disabled={pending || !canEdit} className="settings-fieldset">
      <label className="inherit-schedule"><input type="checkbox" checked={availability.week === null} onChange={(event) => setAvailability({ ...availability, week: event.target.checked ? null : settings.days.map((day) => day.enabled ? [{ open: day.open, close: day.close }] : []) })}/> Usar jornada do estabelecimento</label>
      {availability.week?.map((periods, dayIndex) => <div className="professional-day" key={dayIndex}><strong>{weekdays[dayIndex]}</strong>{!periods.length && <span className="settings-note">Folga</span>}
        {periods.map((period, index) => <div className="professional-period" key={index}><input type="time" aria-label={`Início ${weekdays[dayIndex]} período ${index + 1}`} required value={period.open} onChange={(event) => updateDay(dayIndex, periods.map((item, i) => i === index ? { ...item, open: event.target.value } : item))}/><span>até</span><input type="time" aria-label={`Fim ${weekdays[dayIndex]} período ${index + 1}`} required value={period.close} onChange={(event) => updateDay(dayIndex, periods.map((item, i) => i === index ? { ...item, close: event.target.value } : item))}/><button className="button outline" type="button" aria-label={`Remover período ${index + 1} de ${weekdays[dayIndex]}`} onClick={() => updateDay(dayIndex, periods.filter((_, i) => i !== index))}>Remover</button></div>)}
        <button className="button outline" type="button" disabled={periods.length >= 6} onClick={() => updateDay(dayIndex, [...periods, { open: "09:00", close: "12:00" }])}>Adicionar período</button>
      </div>)}
      <h3>Folgas, férias e bloqueios</h3><p className="settings-note">Para bloquear um dia inteiro, use 00:00 desse dia até 00:00 do dia seguinte. O bloqueio termina no horário indicado.</p>
      <ul className="schedule-blocks">{availability.blocks.map((block, index) => <li key={index}><div><strong>{block.reason}</strong><span>{localDateTime(block.startsAt).replace("T", " às ")} — {localDateTime(block.endsAt).replace("T", " às ")}</span></div><button className="button outline" type="button" aria-label={`Remover bloqueio ${block.reason}`} onClick={() => setAvailability({ ...availability, blocks: availability.blocks.filter((_, i) => i !== index) })}>Remover</button></li>)}</ul>
      <div className="form-grid"><label>Início (Brasília)<input type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)}/></label><label>Fim (Brasília)<input type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)}/></label><label className="full">Motivo interno<input maxLength={120} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: Férias"/></label></div>
      <button className="button outline" type="button" disabled={availability.blocks.length >= 200} onClick={addBlock}>Adicionar bloqueio à lista</button>
      {canEdit && <button className="button primary settings-save" disabled={pending}>{pending ? "Salvando..." : "Salvar jornada e bloqueios"}</button>}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    {!canEdit && <p className="settings-note">Somente proprietários podem alterar jornadas.</p>}
  </form></details>;
}
