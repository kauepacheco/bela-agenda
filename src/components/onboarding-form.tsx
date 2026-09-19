"use client";

import { Building2, Check, LogOut, MapPin, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { logoutAction } from "@/app/auth-actions";
import { completeOnboardingAction, type OnboardingState } from "@/app/onboarding-actions";

type BusinessFields = { name: string; address: string; city: string; phone: string };

export function OnboardingForm({
  business,
  userName,
  canManage,
}: {
  business: BusinessFields;
  userName: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboardingAction,
    undefined,
  );

  return <main className="onboarding-page">
    <aside className="onboarding-aside">
      <div className="onboarding-brand"><span><Sparkles size={19} /></span>Bela</div>
      <div className="onboarding-copy">
        <span className="eyebrow">PRIMEIROS PASSOS</span>
        <h1>Vamos preparar seu espaço.</h1>
        <p>Essas informações serão usadas no painel, na página de agendamento e nas conversas com seus clientes.</p>
      </div>
      <div className="onboarding-benefits">
        <div><span><Building2 size={18} /></span><p><strong>Identidade do negócio</strong><small>Seu estabelecimento aparece com os dados corretos.</small></p></div>
        <div><span><MapPin size={18} /></span><p><strong>Localização clara</strong><small>Clientes sabem onde serão atendidos.</small></p></div>
        <div><span><MessageCircle size={18} /></span><p><strong>WhatsApp conectado</strong><small>O canal principal fica pronto para as próximas etapas.</small></p></div>
      </div>
      <p className="onboarding-security"><ShieldCheck size={15} /> Seus dados ficam isolados dos demais estabelecimentos.</p>
    </aside>

    <section className="onboarding-main">
      <div className="onboarding-top">
        <div><span>CONFIGURAÇÃO INICIAL</span><strong>Dados do estabelecimento</strong></div>
        <div className="onboarding-progress"><i /><i /><i /><i /></div>
        <form action={logoutAction}><button type="submit"><LogOut size={16} /> Sair</button></form>
      </div>

      <div className="onboarding-card">
        <span className="onboarding-step"><Check size={14} /> CONTA CRIADA</span>
        <h2>Olá, {userName.split(" ")[0]}!</h2>
        {canManage ? <>
          <p>Confirme os dados que seus clientes verão para liberar o acesso ao painel.</p>
          <form action={action} className="onboarding-form">
            <label className="full">Nome do estabelecimento<input name="name" defaultValue={business.name} required minLength={2} maxLength={100} autoComplete="organization" placeholder="Ex.: Studio Bella" /></label>
            <label className="full">Endereço<input name="address" defaultValue={business.address} required minLength={5} maxLength={160} autoComplete="street-address" placeholder="Rua, número e complemento" /></label>
            <label>Cidade<input name="city" defaultValue={business.city} required minLength={2} maxLength={80} autoComplete="address-level2" /></label>
            <label>WhatsApp<input name="phone" defaultValue={business.phone} type="tel" required autoComplete="tel" inputMode="tel" placeholder="(47) 99999-9999" /></label>
            {state?.error && <p className="form-error full" role="alert">{state.error}</p>}
            <div className="onboarding-actions full"><span>Leva menos de 1 minuto</span><button className="button primary" disabled={pending}>{pending ? "Salvando..." : "Salvar e acessar o painel"}</button></div>
          </form>
        </> : <div className="onboarding-waiting">
          <ShieldCheck size={28} />
          <h3>Aguardando o proprietário</h3>
          <p>Somente um proprietário pode concluir os dados iniciais deste estabelecimento. Entre novamente depois que a configuração estiver pronta.</p>
        </div>}
      </div>
    </section>
  </main>;
}
