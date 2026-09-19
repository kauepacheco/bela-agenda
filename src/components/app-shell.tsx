import { Bell, ChevronDown, HelpCircle, Search } from "lucide-react";
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
  return <div className="app-shell"><Sidebar business={context.business} role={context.role} /><main className="main"><header className="topbar"><div className="search"><Search size={18} /><input aria-label="Buscar" placeholder="Buscar cliente, horário..." /><kbd>⌘ K</kbd></div><div className="top-actions"><button aria-label="Ajuda"><HelpCircle size={19} /></button><button className="notification" aria-label="Notificações"><Bell size={19} /><i /></button><span className="divider" /><span className="user-avatar">{initials(context.user.name)}</span><div className="user-name"><strong>{context.user.name}</strong><small>{context.role === "OWNER" ? "Proprietário" : "Funcionário"}</small></div><ChevronDown size={16} /></div></header><div className="content">{children}</div></main></div>;
}
