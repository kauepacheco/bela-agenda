import { ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "./sidebar";

type ShellContext = {
  role: "OWNER" | "EMPLOYEE";
  user: { name: string };
  business: { name: string; slug: string; city: string };
};

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function AppShell({ children, context }: { children: React.ReactNode; context: ShellContext }) {
  return <div className="app-shell"><a className="skip-link" href="#main-content">Pular para o conteúdo</a><Sidebar business={context.business} role={context.role}/><main className="main" id="main-content"><header className="topbar"><div className="topbar-label"><Sparkles size={16}/><span>Seu espaço de cuidado</span></div><div className="top-actions"><Link className="public-page-link" href={`/agendar/${context.business.slug}`} target="_blank">Minha página <ExternalLink size={14}/></Link><span className="divider"/><span className="user-avatar">{initials(context.user.name)}</span><div className="user-name"><strong>{context.user.name}</strong><small>{context.role === "OWNER" ? "Proprietário" : "Funcionário"}</small></div></div></header><div className="content">{children}</div></main></div>;
}
