"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type PasswordResetState,
} from "@/app/password-reset-actions";

function Brand() {
  return <div className="auth-brand"><span><Sparkles size={19} /></span>Bela</div>;
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordResetState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  return <main className="auth-page">
    <section className="auth-card">
      <Brand />
      <span className="eyebrow">RECUPERAR ACESSO</span>
      <h1>Esqueceu sua senha?</h1>
      <p>Informe seu e-mail e enviaremos um link de uso único, válido por 30 minutos.</p>
      {state?.success ? <p className="form-success" role="status">{state.success}</p> :
        <form action={formAction} className="auth-form">
          <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@exemplo.com" /></label>
          {state?.error && <p className="form-error" role="alert">{state.error}</p>}
          <button className="button primary" disabled={pending}>{pending ? "Enviando..." : "Enviar link"}</button>
        </form>}
      <small><Link href="/entrar">Voltar para o login</Link></small>
    </section>
  </main>;
}

export function ResetPasswordForm({ token, valid }: { token: string; valid: boolean }) {
  const [state, formAction, pending] = useActionState<PasswordResetState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return <main className="auth-page">
    <section className="auth-card">
      <Brand />
      <span className="eyebrow">NOVA SENHA</span>
      <h1>Redefina sua senha</h1>
      {!valid ? <>
        <p className="form-error" role="alert">Este link é inválido ou expirou. Solicite um novo.</p>
        <Link className="button primary auth-main-link" href="/esqueci-senha">Solicitar novo link</Link>
      </> : state?.success ? <>
        <p className="form-success" role="status">{state.success}</p>
        <Link className="button primary auth-main-link" href="/entrar">Entrar</Link>
      </> : <>
        <p>Escolha uma senha com ao menos 8 caracteres, uma letra e um número.</p>
        <form action={formAction} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <label>Nova senha<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Confirme a nova senha<input name="passwordConfirmation" type="password" required minLength={8} autoComplete="new-password" /></label>
          {state?.error && <p className="form-error" role="alert">{state.error}</p>}
          <button className="button primary" disabled={pending}>{pending ? "Salvando..." : "Redefinir senha"}</button>
        </form>
      </>}
      <small><Link href="/entrar">Voltar para o login</Link></small>
    </section>
  </main>;
}
