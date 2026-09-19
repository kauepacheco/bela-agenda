"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth";
import { completeBusinessOnboarding, OnboardingServiceError } from "@/lib/onboarding-service";

export type OnboardingState = { error?: string } | undefined;

const phoneSchema = z.string().trim().refine(
  (value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  },
  "Informe um WhatsApp válido com DDD.",
);

export async function completeOnboardingAction(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const context = await requireAuthContext({ allowIncompleteOnboarding: true });
  if (context.business.onboardingCompletedAt) redirect("/");

  const parsed = z.object({
    name: z.string().trim().min(2, "Informe o nome do estabelecimento.").max(100),
    address: z.string().trim().min(5, "Informe o endereço completo.").max(160),
    city: z.string().trim().min(2, "Informe a cidade.").max(80),
    phone: phoneSchema,
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };
  }

  try {
    await completeBusinessOnboarding({
      actorMembershipId: context.membershipId,
      ...parsed.data,
    });
  } catch (error) {
    if (error instanceof OnboardingServiceError) {
      return { error: "Somente o proprietário pode concluir a configuração inicial." };
    }
    console.error("Falha ao concluir onboarding.", error);
    return { error: "Não foi possível salvar os dados agora. Tente novamente." };
  }

  redirect("/");
}
