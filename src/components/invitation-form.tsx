"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { acceptInvitationAction, type TeamActionState } from "@/app/team-actions";

type Invitation = {
  email: string;
  role: "OWNER" | "EMPLOYEE";
  businessName: string;
  existingUser: boolean;
} | null;

export function InvitationForm({ token, invitation }: { token: string; invitation: Invitation }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    acceptInvitationAction,
    undefined,
  );

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span><Sparkles size={19} /></span>Bela</div>
    <span className="eyebrow">CONVITE DE EQUIPE</span>
    {!invitation ? <>
      <h1>Convite indisponível</h1>
      <p className="form-error" role="alert">Este link é inválido, expirou ou já foi utilizado.</p>
      <Link className="button primary auth-main-link" href="/entrar">Ir para o login</Link>
    </> : <>
      <h1>Entre para {invitation.businessName}</h1>
      <p>Você foi convidado como {invitation.role === "OWNER" ? "proprietário" : "funcionário"} usando <strong>{invitation.email}</strong>.</p>
      <form action={action} className="auth-form">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="existingUser" value={String(invitation.existingUser)} />
        {!invitation.existingUser && <label>Seu nome<input name="name" required minLength={2} autoComplete="name" /></label>}
        <label>{invitation.existingUser ? "Sua senha atual" : "Crie uma senha"}<input name="password" type="password" required minLength={8} autoComplete={invitation.existingUser ? "current-password" : "new-password"} /></label>
        <label>{invitation.existingUser ? "Confirme sua senha" : "Confirme a nova senha"}<input name="passwordConfirmation" type="password" required minLength={8} autoComplete={invitation.existingUser ? "current-password" : "new-password"} /></label>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <button className="button primary" disabled={pending}>{pending ? "Aceitando..." : "Aceitar convite"}</button>
      </form>
    </>}
  </section></main>;
}
