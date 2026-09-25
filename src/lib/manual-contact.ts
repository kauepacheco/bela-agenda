import { businessDate, businessTime, phoneSchema } from "./booking-policy";

export function manualContactUrl(item: { client: { name: string; phone: string }; serviceName: string; startsAt: string; status: string }, businessName: string) {
  const phone = phoneSchema.safeParse(item.client.phone);
  if (!phone.success) return null;
  const when = new Date(item.startsAt);
  if (!Number.isFinite(when.getTime())) return null;
  const date = businessDate(when).split("-").reverse().join("/");
  const details = `${item.serviceName} em ${businessName}, dia ${date} às ${businessTime(when)} (horário de Brasília)`;
  const message = item.status === "CONFIRMED"
    ? `Olá, ${item.client.name}! Seu atendimento de ${details} está confirmado.`
    : item.status === "CANCELLED"
      ? `Olá, ${item.client.name}. O atendimento de ${details} foi cancelado. Podemos conversar para encontrar outro horário?`
      : item.status === "PENDING"
        ? `Olá, ${item.client.name}! Recebemos sua solicitação de ${details}. Ela ainda aguarda confirmação da equipe.`
        : `Olá, ${item.client.name}! Somos da equipe de ${businessName}. Podemos conversar sobre seu atendimento de ${item.serviceName}?`;
  return `https://wa.me/55${phone.data}?text=${encodeURIComponent(message)}`;
}
