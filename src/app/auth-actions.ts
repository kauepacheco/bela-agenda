"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteCurrentSession } from "@/lib/auth";
import { authenticateCredentials, createAccount } from "@/lib/auth-service";

export type AuthState = { error?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
const password = z.string().min(8, "A senha deve ter ao menos 8 caracteres.").regex(/[A-Za-z]/, "Inclua uma letra na senha.").regex(/[0-9]/, "Inclua um número na senha.");

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({
    name: z.string().trim().min(2, "Informe seu nome."),
    businessName: z.string().trim().min(2, "Informe o nome do estabelecimento."),
    email,
    password,
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };

  const { name, businessName, email: userEmail, password: plainPassword } = parsed.data;
  try {
    const membership = await createAccount({
      name,
      businessName,
      email: userEmail,
      password: plainPassword,
    });
    await createSession(membership.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Já existe uma conta com esse e-mail. Entre para continuar." };
    }
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }

  redirect("/onboarding");
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe e-mail e senha." };

  const membership = await authenticateCredentials(parsed.data.email, parsed.data.password);
  if (!membership) return { error: "E-mail ou senha inválidos." };

  await createSession(membership.id);
  redirect(membership.business.onboardingCompletedAt ? "/" : "/onboarding");
}

export async function logoutAction() {
  await deleteCurrentSession();
  redirect("/entrar");
}
