"use client";

import { Clock3, MailPlus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  type TeamActionState,
} from "@/app/team-actions";

type Member = {
  id: string;
  role: "OWNER" | "EMPLOYEE";
  createdAt: string;
  user: { name: string; email: string };
};

type Invitation = {
  id: string;
  email: string;
  role: "OWNER" | "EMPLOYEE";
  expiresAt: string;
};

const roleName = (role: Member["role"]) => role === "OWNER" ? "Proprietário" : "Funcionário";

export function TeamManager({
  currentMembershipId,
  members,
  invitations,
}: {
  currentMembershipId: string;
  members: Member[];
  invitations: Invitation[];
}) {
  const [inviteState, inviteAction, invitePending] = useActionState<TeamActionState, FormData>(
    inviteMemberAction,
    undefined,
  );
  const [operationState, setOperationState] = useState<TeamActionState>();
  const [pending, startTransition] = useTransition();

  function remove(id: string, name: string) {
    if (!window.confirm(`Remover o acesso de ${name}? As sessões abertas serão encerradas.`)) return;
    setOperationState(undefined);
    startTransition(async () => setOperationState(await removeMemberAction(id)));
  }

  function cancel(id: string, email: string) {
    if (!window.confirm(`Cancelar o convite enviado para ${email}?`)) return;
    setOperationState(undefined);
    startTransition(async () => setOperationState(await cancelInvitationAction(id)));
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">ACESSOS</span><h1>Membros da equipe</h1><p>Convide pessoas e controle quem pode acessar este estabelecimento.</p></div>
    </div>

    <div className="team-layout">
      <section className="panel invite-panel">
        <div className="panel-head"><div><h2>Convidar membro</h2><p>O link enviado expira em 7 dias.</p></div><span className="catalog-icon"><MailPlus size={18} /></span></div>
        <form action={inviteAction} className="invite-form">
          <label>E-mail<input name="email" type="email" required placeholder="pessoa@exemplo.com" /></label>
          <label>Papel<select name="role" defaultValue="EMPLOYEE"><option value="EMPLOYEE">Funcionário</option><option value="OWNER">Proprietário</option></select></label>
          <button className="button primary" disabled={invitePending}>{invitePending ? "Enviando..." : "Enviar convite"}</button>
        </form>
        {inviteState?.error && <p className="form-error" role="alert">{inviteState.error}</p>}
        {inviteState?.success && <p className="form-success" role="status">{inviteState.success}</p>}
        <p className="role-help"><ShieldCheck size={15} /><span><strong>Proprietários</strong> podem convidar e remover membros. Funcionários acessam a operação, mas não gerenciam acessos.</span></p>
      </section>

      <section className="panel members-panel">
        <div className="panel-head"><div><h2>Membros ativos</h2><p>{members.length} {members.length === 1 ? "pessoa com acesso" : "pessoas com acesso"}</p></div></div>
        <div className="member-list">
          {members.map((member) => <article key={member.id}>
            <span className="catalog-icon pro"><UserRound size={18} /></span>
            <div><strong>{member.user.name}{member.id === currentMembershipId ? " (você)" : ""}</strong><small>{member.user.email}</small></div>
            <span className={`member-role ${member.role.toLowerCase()}`}>{roleName(member.role)}</span>
            <button className="icon-button danger" disabled={pending} onClick={() => remove(member.id, member.user.name)} aria-label={`Remover ${member.user.name}`}><Trash2 size={17} /></button>
          </article>)}
        </div>
      </section>
    </div>

    {invitations.length > 0 && <section className="panel pending-panel">
      <div className="panel-head"><div><h2>Convites pendentes</h2><p>Aguardando aceitação</p></div></div>
      <div className="member-list">
        {invitations.map((invitation) => <article key={invitation.id}>
          <span className="catalog-icon pending"><Clock3 size={18} /></span>
          <div><strong>{invitation.email}</strong><small>Expira em {new Intl.DateTimeFormat("pt-BR").format(new Date(invitation.expiresAt))}</small></div>
          <span className={`member-role ${invitation.role.toLowerCase()}`}>{roleName(invitation.role)}</span>
          <button className="icon-button danger" disabled={pending} onClick={() => cancel(invitation.id, invitation.email)} aria-label={`Cancelar convite de ${invitation.email}`}><Trash2 size={17} /></button>
        </article>)}
      </div>
    </section>}
    {operationState?.error && <p className="form-error team-feedback" role="alert">{operationState.error}</p>}
    {operationState?.success && <p className="form-success team-feedback" role="status">{operationState.success}</p>}
  </>;
}
