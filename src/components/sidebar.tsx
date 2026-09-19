"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartNoAxesCombined, ContactRound, ExternalLink, LogOut, Scissors, Settings, Sparkles, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/auth-actions";

const navigation = [
  { href: "/", label: "Visão geral", icon: ChartNoAxesCombined },
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
          return <Link className={`nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}><item.icon size={19} /><span>{item.label}</span></Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <Link className="nav-link" href={`/agendar/${business.slug}`} target="_blank"><ExternalLink size={19} /><span>Página de agendamento</span></Link>
        {role === "OWNER" && <Link className={`nav-link ${pathname.startsWith("/equipe") ? "active" : ""}`} href="/equipe"><UsersRound size={19} /><span>Membros e acessos</span></Link>}
        <button className="nav-link plain"><Settings size={19} /><span>Configurações</span></button>
        <form action={logoutAction}><button className="nav-link plain" type="submit"><LogOut size={19} /><span>Sair</span></button></form>
        <div className="plan-card"><span>PLANO PIONEIRO</span><strong>Seu período de teste</strong><div className="progress"><i /></div><small>24 dias restantes</small></div>
      </div>
    </aside>
  );
}
