"use server";

import { bookingSettingsSchema, phoneSchema } from "@/lib/booking-policy";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { completeBusinessOnboarding, OnboardingServiceError } from "@/lib/onboarding-service";

export type OnboardingState = { error?: string } | undefined;

const catalogSchema = z.object({
  professionals: z.array(z.object({
    key: z.string().min(1),
    name: z.string().trim().min(2, "Informe o nome de cada profissional.").max(100),
    role: z.string().trim().min(2, "Informe a especialidade de cada profissional.").max(80),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
  })).min(1, "Cadastre pelo menos um profissional.").max(10),
  services: z.array(z.object({
    name: z.string().trim().min(2, "Informe o nome de cada serviço.").max(100),
    durationMin: z.number().int().min(10).max(480),
    priceCents: z.number().int().min(0).max(100_000_000),
    professionalKeys: z.array(z.string().min(1)).min(1, "Selecione quem realiza cada serviço."),
  })).min(1, "Cadastre pelo menos um serviço.").max(30),
}).superRefine((catalog, context) => {
  const keys = new Set(catalog.professionals.map((professional) => professional.key));
  if (keys.size !== catalog.professionals.length) {
    context.addIssue({ code: "custom", message: "A lista de profissionais é inválida." });
  }
  for (const service of catalog.services) {
    if (new Set(service.professionalKeys).size !== service.professionalKeys.length
      || service.professionalKeys.some((key) => !keys.has(key))) {
      context.addIssue({ code: "custom", message: "Selecione profissionais válidos para cada serviço." });
    }
  }
});

export async function completeOnboardingAction(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const context = await requireAuthContext({ allowIncompleteOnboarding: true });
  if (context.business.onboardingCompletedAt) redirect("/");

  let catalog: unknown;
  let bookingSettings: unknown;
  try {
    bookingSettings = JSON.parse(String(formData.get("bookingSettings") ?? ""));
    catalog = JSON.parse(String(formData.get("catalog") ?? ""));
  } catch {
    return { error: "Revise os profissionais, serviços e horários informados." };
  }

  const parsed = z.object({
    name: z.string().trim().min(2, "Informe o nome do estabelecimento.").max(100),
    address: z.string().trim().min(5, "Informe o endereço completo.").max(160),
    city: z.string().trim().min(2, "Informe a cidade.").max(80),
    phone: phoneSchema,
    catalog: catalogSchema,
    bookingSettings: bookingSettingsSchema,
  }).safeParse({ ...Object.fromEntries(formData), catalog, bookingSettings });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };
  }

  try {
    await completeBusinessOnboarding({
      actorMembershipId: context.membershipId,
      bookingSettings: parsed.data.bookingSettings,
      name: parsed.data.name,
      address: parsed.data.address,
      city: parsed.data.city,
      phone: parsed.data.phone,
      ...parsed.data.catalog,
    });
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return { error: "Somente o proprietário pode concluir a configuração inicial." };
    }
    console.error(JSON.stringify({ event: "onboarding_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return { error: "Não foi possível salvar os dados agora. Tente novamente." };
  }

  redirect("/");
}
