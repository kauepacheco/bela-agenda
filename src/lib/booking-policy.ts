import { z } from "zod";

export const BUSINESS_TIMEZONE = "America/Sao_Paulo";
export const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const bookingSettingsSchema = z.object({
  days: z.array(z.object({ enabled: z.boolean(), open: clock, close: clock })
    .refine((day) => !day.enabled || day.open < day.close, "O fechamento deve ser depois da abertura.")).length(7),
  minNoticeMin: z.number().int().min(0).max(10080),
  maxAdvanceDays: z.number().int().min(1).max(180),
  bufferMin: z.number().int().min(0).max(120),
}).refine((settings) => settings.minNoticeMin < settings.maxAdvanceDays * 1440, "A antecedência mínima deve ser menor que o prazo máximo.");
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;
export const defaultBookingSettings: BookingSettings = {
  days: weekdays.map((_, index) => ({ enabled: index !== 0, open: "09:00", close: "18:00" })),
  minNoticeMin: 60, maxAdvanceDays: 30, bufferMin: 0,
};
export const phoneSchema = z.string().transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^(?:55)?[1-9]\d{9,10}$/.test(value), "Informe um telefone brasileiro com DDD.")
  .transform((value) => value.length > 11 ? value.slice(2) : value);

export function businessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function businessTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
export function atBusinessTime(day: string, time = "00:00") {
  const target = new Date(`${day}T${time}:00Z`).getTime();
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const date = new Date(instant);
    const wall = new Date(`${businessDate(date)}T${businessTime(date)}:00Z`).getTime();
    instant += target - wall;
  }
  return new Date(instant);
}
export function addDateDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function bookingWindowError(settings: BookingSettings, startsAt: Date, durationMin: number, now = new Date()) {
  if (startsAt.getTime() <= now.getTime() || startsAt.getTime() < now.getTime() + settings.minNoticeMin * 60_000) return "Este horário não atende à antecedência mínima para reservas.";
  if (startsAt.getTime() > now.getTime() + settings.maxAdvanceDays * 86400_000) return "Este horário está além do prazo máximo para reservas.";
  return workingWindowError(settings, startsAt, durationMin);
}

export function workingWindowError(settings: BookingSettings, startsAt: Date, durationMin: number) {
  const day = businessDate(startsAt);
  const schedule = settings.days[new Date(`${day}T12:00:00Z`).getUTCDay()];
  const end = startsAt.getTime() + (durationMin + settings.bufferMin) * 60_000;
  if (!schedule.enabled || startsAt < atBusinessTime(day, schedule.open) || end > atBusinessTime(day, schedule.close).getTime()) return "O serviço completo e o intervalo devem caber no horário de funcionamento.";
  return null;
}
