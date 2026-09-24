import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  return <main className="auth-page"><section className="auth-card"><Sparkles size={30}/><span className="eyebrow"> BELA AGENDA · 404</span><h1>Este endereço não está disponível.</h1><p>Confira se o link foi copiado por completo. Para agendar, peça o endereço atualizado ao estabelecimento.</p><Link href="/" className="button primary">Ir para o início</Link></section></main>;
}
