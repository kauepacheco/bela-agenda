"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, CalendarDays, ChartNoAxesCombined, ContactRound, ExternalLink, LogOut, Scissors, Settings, Sparkles, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";

const navigation = [
  { href: "/", label: "Visão geral", icon: ChartNoAxesCombined },
  { href: "/solicitacoes", label: "Solicitações", icon: Inbox },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: ContactRound },
  { href: "/catalogo", label: "Serviços e equipe", icon: Scissors },
];

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function Sidebar({ business, role }: { business: { name: string; slug: string; city: string }; role: "OWNER" | "EMPLOYEE" }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Bela</span></div>
      <div className="workspace-card"><span className="workspace-avatar">{initials(business.name)}</span><div><strong>{business.name}</strong><small>{business.city}</small></div></div>
      <nav className="nav-list">
        <span className="nav-title">ESPAÇO DE TRABALHO</span>
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link aria-label={item.label} title={item.label} aria-current={active ? "page" : undefined} className={`nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}><item.icon size={19} /><span>{item.label}</span></Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <Link className="nav-link" aria-label="Página de agendamento" title="Página de agendamento" href={`/agendar/${business.slug}`} target="_blank"><ExternalLink size={19} /><span>Página de agendamento</span></Link>
        {role === "OWNER" && <Link aria-label="Membros e acessos" title="Membros e acessos" className={`nav-link ${pathname.startsWith("/equipe") ? "active" : ""}`} href="/equipe"><UsersRound size={19} /><span>Membros e acessos</span></Link>}
        <Link href="/configuracoes" aria-label="Configurações" title="Configurações" className={`nav-link ${pathname.startsWith("/configuracoes") ? "active" : ""}`}><Settings size={19}/><span>Configurações</span></Link>
        <form action={logoutAction}><button aria-label="Sair" title="Sair" className="nav-link plain" type="submit"><LogOut size={19} /><span>Sair</span></button></form>
        <div className="plan-card"><span>FEITO PARA O SEU NEGÓCIO</span><strong>Mais tempo para cuidar.</strong><small>Agenda, clientes e equipe no mesmo lugar.</small></div>
      </div>
    </aside>
  );
}
