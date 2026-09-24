"use client";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="auth-page"><section className="auth-card"><CalendarDays size={30}/><h1>Não foi possível carregar esta página.</h1><p>Tente novamente em alguns instantes. Se você estava salvando um atendimento, confira a agenda antes de repetir a operação.</p><button className="button primary" onClick={retry}>Tentar novamente</button><Link href="/" className="button outline auth-main-link">Voltar ao início</Link></section></main>;
}
