"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { loginAction, signupAction, type AuthState } from "@/app/auth-actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);
  const signup = mode === "signup";

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><span><Sparkles size={19} /></span>Bela</div>
      <span className="eyebrow">{signup ? "COMECE AGORA" : "BEM-VINDO DE VOLTA"}</span>
      <h1>{signup ? "Crie seu espaço" : "Entre na sua conta"}</h1>
      <p>{signup ? "Configure o ambiente do seu estabelecimento em poucos passos." : "Acesse a agenda e cuide do seu negócio."}</p>
      <form action={formAction} className="auth-form">
        {signup && <>
          <label>Seu nome<input name="name" required autoComplete="name" placeholder="Nome completo" /></label>
          <label>Estabelecimento<input name="businessName" required autoComplete="organization" placeholder="Nome do salão ou studio" /></label>
        </>}
        <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@exemplo.com" /></label>
        <label>Senha<input name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} placeholder="Mínimo de 8 caracteres" /></label>
        {state?.error && <p className="form-error">{state.error}</p>}
        <button className="button primary" disabled={pending}>{pending ? "Aguarde..." : signup ? "Criar conta" : "Entrar"}</button>
      </form>
      <small>{signup ? "Já tem uma conta?" : "Ainda não tem conta?"} <Link href={signup ? "/entrar" : "/cadastro"}>{signup ? "Entrar" : "Criar agora"}</Link></small>
    </section>
  </main>;
}
