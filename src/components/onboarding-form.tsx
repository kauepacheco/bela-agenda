"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock3,
  LogOut,
  Plus,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { logoutAction } from "@/app/auth-actions";
import { completeOnboardingAction, type OnboardingState } from "@/app/onboarding-actions";

import { weekdays, defaultBookingSettings } from "@/lib/booking-policy";

type BusinessFields = { name: string; address: string; city: string; phone: string };
type ProfessionalDraft = { key: string; name: string; role: string; color: string };
type ServiceDraft = {
  key: string;
  name: string;
  durationMin: string;
  price: string;
  professionalKeys: string[];
};

const STEP_TITLES = ["Dados do estabelecimento", "Equipe profissional", "Serviços oferecidos", "Horários de funcionamento"];
const COLORS = ["#D97757", "#547568", "#786283", "#B8863B", "#527A9B"];

export function OnboardingForm({
  business,
  userName,
  canManage,
}: {
  business: BusinessFields;
  userName: string;
  canManage: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(2);
  const [bookingSettings, setBookingSettings] = useState(defaultBookingSettings);
  const [step, setStep] = useState(0);
  const [clientError, setClientError] = useState("");
  const [professionals, setProfessionals] = useState<ProfessionalDraft[]>([
    { key: "professional-1", name: userName, role: "Profissional", color: COLORS[0] },
  ]);
  const [services, setServices] = useState<ServiceDraft[]>([
    { key: "service-1", name: "", durationMin: "60", price: "", professionalKeys: ["professional-1"] },
  ]);
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboardingAction,
    undefined,
  );

  function advance() {
    setClientError("");
    const fields = formRef.current?.querySelectorAll<HTMLInputElement>(`[data-step="${step}"] input`);
    if (fields && !Array.from(fields).every((field) => field.reportValidity())) return;
    if (step === 1 && professionals.some((professional) => !professional.name.trim() || !professional.role.trim())) {
      setClientError("Preencha o nome e a especialidade de todos os profissionais.");
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  function addProfessional() {
    if (professionals.length >= 10) return;
    const index = nextKey.current++;
    setProfessionals((current) => [...current, {
      key: `professional-${index}`,
      name: "",
      role: "",
      color: COLORS[(index - 1) % COLORS.length],
    }]);
  }

  function updateProfessional(key: string, field: keyof Omit<ProfessionalDraft, "key">, value: string) {
    setProfessionals((current) => current.map((professional) => (
      professional.key === key ? { ...professional, [field]: value } : professional
    )));
  }

  function removeProfessional(key: string) {
    if (professionals.length === 1) return;
    const remaining = professionals.filter((professional) => professional.key !== key);
    setProfessionals(remaining);
    setServices((current) => current.map((service) => {
      const professionalKeys = service.professionalKeys.filter((professionalKey) => professionalKey !== key);
      return { ...service, professionalKeys: professionalKeys.length ? professionalKeys : [remaining[0].key] };
    }));
  }

  function addService() {
    if (services.length >= 30) return;
    const index = nextKey.current++;
    setServices((current) => [...current, {
      key: `service-${index}`,
      name: "",
      durationMin: "60",
      price: "",
      professionalKeys: [professionals[0].key],
    }]);
  }

  function updateService(key: string, field: "name" | "durationMin" | "price", value: string) {
    setServices((current) => current.map((service) => (
      service.key === key ? { ...service, [field]: value } : service
    )));
  }

  function toggleServiceProfessional(serviceKey: string, professionalKey: string) {
    setServices((current) => current.map((service) => {
      if (service.key !== serviceKey) return service;
      const selected = service.professionalKeys.includes(professionalKey);
      if (selected && service.professionalKeys.length === 1) return service;
      return {
        ...service,
        professionalKeys: selected
          ? service.professionalKeys.filter((key) => key !== professionalKey)
          : [...service.professionalKeys, professionalKey],
      };
    }));
  }

  function removeService(key: string) {
    if (services.length > 1) setServices((current) => current.filter((service) => service.key !== key));
  }

  const catalog = JSON.stringify({
    professionals,
    services: services.map((service) => ({
      name: service.name,
      durationMin: Number(service.durationMin),
      priceCents: Math.round(Number(service.price.replace(",", ".")) * 100),
      professionalKeys: service.professionalKeys,
    })),
  });

  return <main className="onboarding-page">
    <aside className="onboarding-aside">
      <div className="onboarding-brand"><span><Sparkles size={19} /></span>Santa Agenda</div>
      <div className="onboarding-copy">
        <span className="eyebrow">PRIMEIROS PASSOS</span>
        <h1>Vamos preparar seu espaço.</h1>
        <p>Configure o essencial para começar a receber agendamentos com sua equipe e seus serviços.</p>
      </div>
      <div className="onboarding-benefits">
        <div><span><Building2 size={18} /></span><p><strong>Identidade do negócio</strong><small>Seu estabelecimento aparece com os dados corretos.</small></p></div>
        <div><span><Users size={18} /></span><p><strong>Equipe organizada</strong><small>Cada profissional aparece na agenda com sua especialidade.</small></p></div>
        <div><span><Scissors size={18} /></span><p><strong>Catálogo pronto</strong><small>Serviços, duração, preço e responsáveis ficam conectados.</small></p></div>
      </div>
      <p className="onboarding-security"><ShieldCheck size={15} /> Seus dados ficam isolados dos demais estabelecimentos.</p>
    </aside>

    <section className="onboarding-main">
      <div className="onboarding-top">
        <div><span>CONFIGURAÇÃO INICIAL</span><strong>{STEP_TITLES[step]}</strong></div>
        <div className={`onboarding-progress step-${step + 1}`}><i /><i /><i /><i /></div>
        <form action={logoutAction}><button type="submit"><LogOut size={16} /> Sair</button></form>
      </div>

      <div className="onboarding-card">
        <span className="onboarding-step"><Check size={14} /> ETAPA {step + 1} DE 4</span>
        <h2>{step === 0 ? `Olá, ${userName.split(" ")[0]}!` : STEP_TITLES[step]}</h2>
        {canManage ? <>
          <p>{step === 0
            ? "Confirme os dados que seus clientes verão."
            : step === 1
              ? "Cadastre quem realiza os atendimentos. Você poderá editar a equipe depois."
              : step === 2 ? "Informe o que você oferece e selecione quem pode realizar cada serviço." : "Revise os dias e horários em que seu estabelecimento recebe clientes. Você poderá configurar pausas e folgas individuais em Configurações."}</p>
          <form ref={formRef} action={action} className="onboarding-form">
            <input type="hidden" name="catalog" value={catalog} />
            <input type="hidden" name="bookingSettings" value={JSON.stringify(bookingSettings)} />

            <div className="onboarding-fields full" data-step="0" hidden={step !== 0}>
              <label className="full">Nome do estabelecimento<input name="name" defaultValue={business.name} required minLength={2} maxLength={100} autoComplete="organization" placeholder="Ex.: Studio Bella" /></label>
              <label className="full">Endereço<input name="address" defaultValue={business.address} required minLength={5} maxLength={160} autoComplete="street-address" placeholder="Rua, número e complemento" /></label>
              <label>Cidade<input name="city" defaultValue={business.city} required minLength={2} maxLength={80} autoComplete="address-level2" /></label>
              <label>WhatsApp<input name="phone" defaultValue={business.phone} type="tel" required autoComplete="tel" inputMode="tel" placeholder="(47) 99999-9999" /></label>
            </div>

            <div className="onboarding-collection full" data-step="1" hidden={step !== 1}>
              {professionals.map((professional, index) => <article className="onboarding-item" key={professional.key}>
                <div className="onboarding-item-title"><span style={{ background: `${professional.color}1f`, color: professional.color }}><Users size={16} /></span><strong>Profissional {index + 1}</strong><button type="button" aria-label={`Remover profissional ${index + 1}`} disabled={professionals.length === 1} onClick={() => removeProfessional(professional.key)}><Trash2 size={15} /></button></div>
                <div className="onboarding-fields">
                  <label>Nome<input required minLength={2} maxLength={100} value={professional.name} onChange={(event) => updateProfessional(professional.key, "name", event.target.value)} placeholder="Nome completo" /></label>
                  <label>Especialidade<input required minLength={2} maxLength={80} value={professional.role} onChange={(event) => updateProfessional(professional.key, "role", event.target.value)} placeholder="Ex.: Cabeleireira" /></label>
                  <label className="onboarding-color full">Cor na agenda<input type="color" value={professional.color} onChange={(event) => updateProfessional(professional.key, "color", event.target.value)} /></label>
                </div>
              </article>)}
              <button type="button" className="onboarding-add" disabled={professionals.length >= 10} onClick={addProfessional}><Plus size={16} /> Adicionar profissional</button>
            </div>

            <div className="onboarding-collection full" data-step="2" hidden={step !== 2}>
              {services.map((service, index) => <article className="onboarding-item" key={service.key}>
                <div className="onboarding-item-title"><span><Scissors size={16} /></span><strong>Serviço {index + 1}</strong><button type="button" aria-label={`Remover serviço ${index + 1}`} disabled={services.length === 1} onClick={() => removeService(service.key)}><Trash2 size={15} /></button></div>
                <div className="onboarding-fields">
                  <label className="full">Nome<input required minLength={2} maxLength={100} value={service.name} onChange={(event) => updateService(service.key, "name", event.target.value)} placeholder="Ex.: Corte feminino" /></label>
                  <label>Duração (min)<span className="input-with-icon"><Clock3 size={14} /><input required type="number" min="10" max="480" step="5" value={service.durationMin} onChange={(event) => updateService(service.key, "durationMin", event.target.value)} /></span></label>
                  <label>Preço (R$)<input required type="number" min="0" max="1000000" step="0.01" value={service.price} onChange={(event) => updateService(service.key, "price", event.target.value)} placeholder="80,00" /></label>
                  <fieldset className="full"><legend>Quem realiza</legend><div className="onboarding-checks">{professionals.map((professional) => <label key={professional.key}><input type="checkbox" checked={service.professionalKeys.includes(professional.key)} onChange={() => toggleServiceProfessional(service.key, professional.key)} /><span style={{ background: professional.color }} />{professional.name || "Sem nome"}</label>)}</div></fieldset>
                </div>
              </article>)}
              <button type="button" className="onboarding-add" disabled={services.length >= 30} onClick={addService}><Plus size={16} /> Adicionar serviço</button>
            </div>

            <div className="onboarding-collection full" data-step="3" hidden={step !== 3}>
              <p className="settings-note">Horário de Brasília · America/Sao_Paulo</p>
              {weekdays.map((name, index) => <div className="schedule-row" key={name}>
                <label><input type="checkbox" checked={bookingSettings.days[index].enabled} onChange={(event) => setBookingSettings({ ...bookingSettings, days: bookingSettings.days.map((day, i) => i === index ? { ...day, enabled: event.target.checked } : day) })}/>{name}</label>
                <input type="time" aria-label={`Abertura — ${name}`} required disabled={!bookingSettings.days[index].enabled} value={bookingSettings.days[index].open} onChange={(event) => setBookingSettings({ ...bookingSettings, days: bookingSettings.days.map((day, i) => i === index ? { ...day, open: event.target.value } : day) })}/><span>até</span>
                <input type="time" aria-label={`Fechamento — ${name}`} required disabled={!bookingSettings.days[index].enabled} value={bookingSettings.days[index].close} onChange={(event) => setBookingSettings({ ...bookingSettings, days: bookingSettings.days.map((day, i) => i === index ? { ...day, close: event.target.value } : day) })}/>
              </div>)}
              <div className="form-grid"><label>Antecedência mínima (minutos)<input type="number" min={0} max={10080} required value={bookingSettings.minNoticeMin} onChange={(event) => setBookingSettings({ ...bookingSettings, minNoticeMin: Number(event.target.value) })}/></label><label>Prazo máximo (dias)<input type="number" min={1} max={180} required value={bookingSettings.maxAdvanceDays} onChange={(event) => setBookingSettings({ ...bookingSettings, maxAdvanceDays: Number(event.target.value) })}/></label><label>Intervalo entre serviços (minutos)<input type="number" min={0} max={120} required value={bookingSettings.bufferMin} onChange={(event) => setBookingSettings({ ...bookingSettings, bufferMin: Number(event.target.value) })}/></label></div>
            </div>

            {(clientError || state?.error) && <p className="form-error full" role="alert">{clientError || state?.error}</p>}
            <div className="onboarding-actions full">
              {step > 0 ? <button type="button" className="button outline" onClick={() => { setClientError(""); setStep((current) => current - 1); }}><ArrowLeft size={16} /> Voltar</button> : <span>Leva apenas alguns minutos</span>}
              {step < 3
                ? <button type="button" className="button primary" onClick={advance}>Continuar <ArrowRight size={16} /></button>
                : <button className="button primary" disabled={pending}>{pending ? "Salvando..." : "Concluir e acessar o painel"}</button>}
            </div>
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
