"use client";

import { MessageCircle, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { businessDate } from "@/lib/booking-policy";

type Client = { id: string; name: string; phone: string; notes?: string | null; active: boolean; version: number; appointments: { startsAt: string; serviceName: string }[] };
const phone = (value: string) => value.length === 11 ? `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}` : value;

export function ClientsClient({ initialClients: clients, canManageData }: { initialClients: Client[]; canManageData: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ item?: Client } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const busy = useRef(false);
  const filtered = useMemo(() => clients.filter((c) => (showInactive || c.active) && `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase())), [clients, query, showInactive]);
  const open = (item?: Client) => { setError(""); setEditor({ item }); };
  const close = () => { if (!busy.current) setEditor(null); };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy.current) return;
    const form = new FormData(event.currentTarget);
    const body = { ...Object.fromEntries(form), active: form.get("active") === "on", ...(editor.item ? { id: editor.item.id, version: editor.item.version } : {}) };
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/clients", { method: editor.item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setEditor(null); router.refresh();
    } catch { setError("Não foi possível confirmar a alteração. Atualize a página antes de tentar novamente."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function removeContact() {
    if (!editor?.item || busy.current) return;
    const confirmation = window.prompt("Remover nome, telefone e observações deste cliente e as observações dos atendimentos? O histórico de serviços será mantido. A ação não pode ser desfeita e não remove cópias exportadas ou backups. Digite REMOVER CONTATO para confirmar.");
    if (confirmation !== "REMOVER CONTATO") return;
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(editor.item.id)}/data`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, version: editor.item.version }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setEditor(null); router.refresh();
    } catch { setError("Não foi possível confirmar a remoção. Atualize a página para conferir."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">RELACIONAMENTO</span><h1>Clientes</h1><p>{clients.filter((c) => c.active).length} pessoas ativas na sua base.</p></div><button className="button primary" onClick={() => open()}><Plus size={18}/> Novo cliente</button></div>
    <label className="catalog-toggle"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)}/> Mostrar clientes inativos</label>
    <section className="panel table-panel"><div className="table-tools"><div className="field-search"><Search size={17}/><input aria-label="Buscar clientes" placeholder="Buscar por nome ou telefone" value={query} onChange={(event) => setQuery(event.target.value)}/></div><span>{filtered.length} resultados</span></div>
      <div className="data-table"><div className="table-row table-head"><span>Cliente</span><span>Contato</span><span>Último atendimento</span><span>Observação</span><span/></div>{filtered.map((client) => <div className="table-row" key={client.id}><div className="client-cell"><span className="client-avatar"><UserRound size={16}/></span><button className="client-edit" onClick={() => open(client)} aria-label={`Editar cliente ${client.name}`}>{client.name}{!client.active && " · Inativo"}</button></div><span>{client.phone.startsWith("removed-") ? "Contato removido" : phone(client.phone)}</span><span>{client.appointments[0] ? `${client.appointments[0].serviceName} · ${businessDate(new Date(client.appointments[0].startsAt)).split("-").reverse().join("/")}` : "Ainda não atendido"}</span><span className="truncate">{client.notes || "—"}</span>{!client.phone.startsWith("removed-") && <a className="whatsapp-link" aria-label={`Conversar com ${client.name} no WhatsApp`} href={`https://wa.me/55${client.phone}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/></a>}</div>)}</div>
      {!filtered.length && <p className="empty">Nenhum cliente encontrado.</p>}
    </section>
    {editor && <Dialog busy={saving} title={editor.item ? "Editar cliente" : "Adicionar cliente"} onClose={close}><form className="form-grid" onSubmit={submit}>
      <label>Nome<input name="name" minLength={2} maxLength={120} required defaultValue={editor.item?.name}/></label><label>WhatsApp<input name="phone" type="tel" maxLength={25} required defaultValue={editor.item?.phone} placeholder="(47) 99999-9999"/></label><label className="full">Observações<textarea name="notes" maxLength={500} rows={3} defaultValue={editor.item?.notes ?? ""}/></label>
      <label className="catalog-toggle full"><input name="active" type="checkbox" defaultChecked={editor.item?.active ?? true}/> Cadastro ativo</label>
      {editor.item && <p className="settings-note full">Inativar preserva o histórico. Encerre ou cancele os atendimentos abertos primeiro.</p>}
      {editor.item?.phone.startsWith("removed-") && <p className="settings-note full">Contato removido. Crie um novo cadastro se o cliente retornar.</p>}
      {editor.item && canManageData && <div className="full privacy-actions"><a className="button outline" href={`/api/clients/${encodeURIComponent(editor.item.id)}/data`} download>Exportar dados do cliente</a><button type="button" className="button danger" disabled={saving || editor.item.phone.startsWith("removed-")} onClick={removeContact}>Remover dados de contato</button><p className="settings-note">Verifique a identidade e a solicitação do cliente antes de fornecer o arquivo ou remover os dados.</p></div>}
      {error && <p role="alert" className="form-error full">{error}</p>}
      <div className="modal-actions full"><button type="button" className="button outline" disabled={saving} onClick={close}>Cancelar</button><button className="button primary" disabled={saving || editor.item?.phone.startsWith("removed-")}>{saving ? "Salvando..." : "Salvar"}</button></div>
    </form></Dialog>}
  </>;
}
