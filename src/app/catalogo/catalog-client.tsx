"use client";

import { Clock3, Plus, Scissors, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";

type Pro = { id: string; name: string; role: string; color: string; active: boolean; version: number; services: { service: { name: string } }[] };
type Service = { id: string; name: string; durationMin: number; priceCents: number; active: boolean; version: number; professionals: { professional: { id: string; name: string } }[] };
type Editor = { type: "professional"; item?: Pro } | { type: "service"; item?: Service };
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);

export function CatalogClient({ initialProfessionals: pros, initialServices: services, canEdit }: { initialProfessionals: Pro[]; initialServices: Service[]; canEdit: boolean }) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const busy = useRef(false);
  const open = (value: Editor) => { setError(""); setEditor(value); };
  const close = () => { if (!busy.current) setEditor(null); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy.current) return;
    const form = new FormData(event.currentTarget);
    const base = { type: editor.type, name: form.get("name"), active: form.get("active") === "on", ...(editor.item ? { id: editor.item.id, version: editor.item.version } : {}) };
    const body = editor.type === "service"
      ? { ...base, durationMin: form.get("durationMin"), priceCents: Math.round(Number(form.get("price")) * 100), professionalIds: form.getAll("professionalIds") }
      : { ...base, role: form.get("role"), color: form.get("color") };
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/catalog", { method: editor.item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setError(result.error); return; }
      setEditor(null); router.refresh();
    } catch { setError("Não foi possível confirmar a alteração. Atualize a página antes de tentar novamente."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">SEU NEGÓCIO</span><h1>Serviços e equipe</h1><p>Defina o que você oferece e quem realiza cada atendimento.</p></div></div>
    <label className="catalog-toggle"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)}/> Mostrar cadastros inativos</label>
    {!canEdit && <p className="settings-note">Somente o proprietário pode alterar o catálogo.</p>}
    <div className="catalog-grid">
      <section className="panel"><div className="panel-head"><div><h2>Serviços</h2><p>{services.filter((s) => s.active).length} serviços ativos</p></div>{canEdit && <button className="button soft" onClick={() => open({ type: "service" })}><Plus size={16}/> Adicionar</button>}</div>
        <div className="catalog-list">{services.filter((s) => showInactive || s.active).map((s) => <article key={s.id}><span className="catalog-icon"><Scissors size={18}/></span><div><strong>{s.name}{!s.active && " · Inativo"}</strong><small><Clock3 size={12}/>{s.durationMin} min · {s.professionals.map((p) => p.professional.name.split(" ")[0]).join(", ")}</small><b>{money(s.priceCents)}</b></div>{canEdit && <button className="button outline" aria-label={`Editar serviço ${s.name}`} onClick={() => open({ type: "service", item: s })}>Editar</button>}</article>)}</div>
        {!services.length && <p className="empty">Cadastre o primeiro serviço.</p>}
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Equipe</h2><p>{pros.filter((p) => p.active).length} profissionais ativos</p></div>{canEdit && <button className="button soft" onClick={() => open({ type: "professional" })}><Plus size={16}/> Adicionar</button>}</div>
        <div className="catalog-list">{pros.filter((p) => showInactive || p.active).map((p) => <article key={p.id}><span className="catalog-icon pro" style={{ background: `${p.color}18`, color: p.color }}><UserRound size={18}/></span><div><strong>{p.name}{!p.active && " · Inativo"}</strong><small>{p.role} · {p.services.length} serviços</small></div>{canEdit && <button className="button outline" aria-label={`Editar profissional ${p.name}`} onClick={() => open({ type: "professional", item: p })}>Editar</button>}</article>)}</div>
        {!pros.length && <p className="empty">Cadastre o primeiro profissional.</p>}
      </section>
    </div>
    {editor && <Dialog busy={saving} title={`${editor.item ? "Editar" : "Novo"} ${editor.type === "service" ? "serviço" : "profissional"}`} onClose={close}><form className="form-grid" onSubmit={submit}>
      <label className="full">Nome<input name="name" minLength={2} maxLength={120} defaultValue={editor.item?.name} required/></label>
      {editor.type === "service" ? <>
        <label>Duração (min)<input name="durationMin" type="number" min="10" max="480" defaultValue={editor.item?.durationMin ?? 60} required/></label>
        <label>Preço (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" defaultValue={editor.item ? editor.item.priceCents / 100 : undefined} required/></label>
        <fieldset className="full catalog-professionals"><legend>Profissionais que realizam o serviço</legend>{pros.map((p) => <label key={p.id}><input name="professionalIds" type="checkbox" value={p.id} defaultChecked={editor.item?.professionals.some((link) => link.professional.id === p.id)}/>{p.name}{!p.active && " (inativo)"}</label>)}</fieldset>
        <p className="settings-note full">Mudanças de preço, nome e duração valem para novas reservas. Atendimentos existentes mantêm os dados registrados, inclusive ao reagendar.</p>
      </> : <><label>Especialidade<input name="role" minLength={2} maxLength={120} defaultValue={editor.item?.role} required/></label><label>Cor na agenda<input name="color" type="color" defaultValue={editor.item?.color ?? "#D97757"}/></label></>}
      <label className="catalog-toggle full"><input name="active" type="checkbox" defaultChecked={editor.item?.active ?? true}/> Cadastro ativo</label>
      {editor.item && <p className="settings-note full">Inativar preserva o histórico e impede novas reservas. Resolva os atendimentos abertos antes de inativar.</p>}
      {error && <p role="alert" className="form-error full">{error}</p>}
      <div className="modal-actions full"><button type="button" className="button outline" disabled={saving} onClick={close}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
    </form></Dialog>}
  </>;
}
