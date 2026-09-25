import { z } from "zod";
import { atBusinessTime, businessDate } from "./booking-policy";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const interval = z.object({ open: clock, close: clock }).refine((item) => item.open < item.close, "O fim deve ser depois do início.");
const day = z.array(interval).max(6).superRefine((items, ctx) => {
  const sorted = [...items].sort((a, b) => a.open.localeCompare(b.open));
  if (sorted.some((item, i) => i > 0 && item.open < sorted[i - 1].close)) {
    ctx.addIssue({ code: "custom", message: "Os períodos do dia não podem se sobrepor." });
  }
});
export const professionalAvailabilitySchema = z.object({
  // null inherits the business week; an empty day means no work that day.
  week: z.array(day).length(7).nullable(),
  blocks: z.array(z.object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(120),
  }).refine((item) => new Date(item.startsAt) < new Date(item.endsAt), "O fim do bloqueio deve ser depois do início.")).max(200),
});
export type ProfessionalAvailability = z.infer<typeof professionalAvailabilitySchema>;
export const inheritedAvailability: ProfessionalAvailability = { week: null, blocks: [] };

export function professionalWindowError(raw: unknown, startsAt: Date, endsAt: Date, bufferMin: number) {
  if (raw === null) return null;
  const parsed = professionalAvailabilitySchema.safeParse(raw);
  if (!parsed.success) return "A jornada do profissional precisa ser revisada.";
  const { week, blocks } = parsed.data;
  const date = businessDate(startsAt);
  const end = endsAt.getTime() + bufferMin * 60_000;
  if (week && !week[new Date(`${date}T12:00:00Z`).getUTCDay()].some((period) =>
    startsAt >= atBusinessTime(date, period.open) && end <= atBusinessTime(date, period.close).getTime())) {
    return "O atendimento e o intervalo devem caber na jornada do profissional, fora das pausas.";
  }
  if (blocks.some((block) => new Date(block.startsAt).getTime() < end && new Date(block.endsAt) > startsAt)) {
    return "O profissional está indisponível neste período (folga, férias ou bloqueio).";
  }
  return null;
}
