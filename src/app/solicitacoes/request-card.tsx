"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manualContactUrl } from "@/lib/manual-contact";
import { businessDate, businessTime } from "@/lib/booking-policy";

type Item = { id: string; serviceName: string; priceCents: number; priceEstimated: boolean; startsAt: string; status: string; pendingExpiresAt: string | null; client: { name: string; phone: string }; professional: { name: string } };
const when = (date: string) => `${businessDate(new Date(date)).split("-").reverse().join("/")} às ${businessTime(new Date(date))}`;

export function RefreshRequests() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="button outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Atualizando..." : "Atualizar solicitações"}</button>;
}

export function RequestCard({ item, businessName }: { item: Item; businessName: string }) {
  const [updated, setUpdated] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const current = updated ?? item;
  const contact = manualContactUrl(current, businessName);
  async function save(status: "CONFIRMED" | "CANCELLED") {
    if (busy.current) return;
    if (status === "CANCELLED" && !window.confirm("Recusar este pedido e liberar o horário? Depois, avise o cliente.")) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status, expectedStatus: "PENDING" }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setUpdated(data);
    } catch { setError("Não foi possível confirmar a alteração. Atualize as solicitações para conferir antes de tentar novamente."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <article className="panel request-card" aria-label={`Solicitação de ${current.client.name}`}>
    <span className={`status ${current.status.toLowerCase()}`}>{current.status === "PENDING" ? "Aguardando confirmação" : current.status === "CONFIRMED" ? "Confirmado" : "Cancelado"}</span>
    <h2>{current.client.name}</h2><p>{current.serviceName} · {current.professional.name}</p><p><strong>{when(current.startsAt)}</strong> · Brasília</p><p>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(current.priceCents / 100)}{current.priceEstimated && " · Preço estimado na migração"}</p>
    {current.status === "PENDING" && current.pendingExpiresAt && <p>Confirmar até {when(current.pendingExpiresAt)}.</p>}
    <p>Contato: {current.client.phone}</p>
    {current.status === "PENDING" ? <div className="request-actions"><button className="button primary" disabled={saving} onClick={() => save("CONFIRMED")}>{saving ? "Salvando..." : "Confirmar pedido"}</button><button className="button danger" disabled={saving} onClick={() => save("CANCELLED")}>Recusar pedido</button></div> : <p role="status">{current.status === "CONFIRMED" ? "Pedido confirmado na agenda." : "Pedido recusado e horário liberado."} Avise o cliente para concluir o contato.</p>}
    {contact && <a className="button outline" href={contact} target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp</a>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}
