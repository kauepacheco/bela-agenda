"use server";

import { headers } from "next/headers";
import { consumeRateLimit, limitNetwork, RateLimitError } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteCurrentSession } from "@/lib/auth";
import { authenticateCredentials, createAccount } from "@/lib/auth-service";

export type AuthState = { error?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
const password = z.string().max(128).min(8, "A senha deve ter ao menos 8 caracteres.").regex(/[A-Za-z]/, "Inclua uma letra na senha.").regex(/[0-9]/, "Inclua um número na senha.");

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({
    name: z.string().trim().min(2, "Informe seu nome.").max(120),
    businessName: z.string().trim().min(2, "Informe o nome do estabelecimento.").max(120),
    email,
    password,
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };

  const { name, businessName, email: userEmail, password: plainPassword } = parsed.data;
  try {
    await limitNetwork("signup", await headers(), 10, 3600);
    await consumeRateLimit("signup:email", userEmail, 3, 3600);
    const membership = await createAccount({
      name,
      businessName,
      email: userEmail,
      password: plainPassword,
    });
    await createSession(membership.id);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Já existe uma conta com esse e-mail. Entre para continuar." };
    }
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }

  redirect("/onboarding");
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1).max(128) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe e-mail e senha." };

  let membership;
  try {
    await limitNetwork("login", await headers(), 60, 900);
    await consumeRateLimit("login:email", parsed.data.email, 10, 900);
    membership = await authenticateCredentials(parsed.data.email, parsed.data.password);
    if (!membership) return { error: "E-mail ou senha inválidos." };
    await createSession(membership.id);
  } catch (error) {
    return { error: error instanceof RateLimitError ? error.message : "Não foi possível entrar agora. Tente novamente." };
  }
  redirect(membership.business.onboardingCompletedAt ? "/" : "/onboarding");
}

export async function logoutAction() {
  await deleteCurrentSession();
  redirect("/entrar");
}
