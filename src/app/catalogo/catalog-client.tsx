"use client";

import { Clock3, Plus, Scissors, UserRound, X } from "lucide-react";
import { useState } from "react";

type Pro = { id: string; name: string; role: string; color: string; services: { service: { name: string } }[] };
type Service = { id: string; name: string; durationMin: number; priceCents: number; professionals: { professional: { name: string } }[] };
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);

export function CatalogClient({ initialProfessionals, initialServices }: { initialProfessionals: Pro[]; initialServices: Service[] }) {
  const [pros, setPros] = useState(initialProfessionals);
  const [services, setServices] = useState(initialServices);
  const [modal, setModal] = useState<"service" | "professional" | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const body = modal === "service"
      ? { type: modal, name: form.name, durationMin: form.durationMin, priceCents: Math.round(Number(form.price) * 100), professionalId: form.professionalId }
      : { type: modal, name: form.name, role: form.role, color: form.color };
    const res = await fetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    if (modal === "professional") setPros((v) => [...v, { ...data, services: [] }]);
    else { const professional = pros.find((p) => p.id === form.professionalId); if (professional) setServices((v) => [...v, { ...data, professionals: [{ professional }] }]); }
    setModal(null);
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">SEU NEGÓCIO</span><h1>Serviços e equipe</h1><p>Defina o que você oferece e quem realiza cada atendimento.</p></div></div>
    <div className="catalog-grid">
      <section className="panel"><div className="panel-head"><div><h2>Serviços</h2><p>{services.length} serviços ativos</p></div><button className="button soft" onClick={() => setModal("service")}><Plus size={16} /> Adicionar</button></div><div className="catalog-list">{services.map((s) => <article key={s.id}><span className="catalog-icon"><Scissors size={18} /></span><div><strong>{s.name}</strong><small><Clock3 size={12} />{s.durationMin} min · {s.professionals.map((p) => p.professional.name.split(" ")[0]).join(", ")}</small></div><b>{money(s.priceCents)}</b></article>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Equipe</h2><p>{pros.length} profissionais ativos</p></div><button className="button soft" onClick={() => setModal("professional")}><Plus size={16} /> Adicionar</button></div><div className="catalog-list">{pros.map((p) => <article key={p.id}><span className="catalog-icon pro" style={{ background: `${p.color}18`, color: p.color }}><UserRound size={18} /></span><div><strong>{p.name}</strong><small>{p.role} · {p.services.length} serviços</small></div><i className="active-dot">Ativo</i></article>)}</div></section>
    </div>
    {modal && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">CADASTRO</span><h2>{modal === "service" ? "Novo serviço" : "Novo profissional"}</h2></div><button onClick={() => setModal(null)}><X /></button></div><form className="form-grid" onSubmit={submit}>{modal === "service" ? <><label className="full">Nome<input name="name" required placeholder="Ex.: Escova progressiva" /></label><label>Duração (min)<input name="durationMin" type="number" min="10" step="5" defaultValue="60" required /></label><label>Preço (R$)<input name="price" type="number" min="0" step="0.01" required placeholder="120,00" /></label><label className="full">Profissional<select name="professionalId" required defaultValue=""><option value="" disabled>Quem realiza este serviço?</option>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></> : <><label>Nome<input name="name" required placeholder="Nome completo" /></label><label>Especialidade<input name="role" required placeholder="Ex.: Cabeleireira" /></label><label className="full">Cor na agenda<input name="color" type="color" defaultValue="#D97757" /></label></>}{error && <p className="form-error full">{error}</p>}<div className="modal-actions full"><button type="button" className="button outline" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Salvar</button></div></form></div></div>}
  </>;
}
