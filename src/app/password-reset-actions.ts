"use server";

import { headers } from "next/headers";
import { consumeRateLimit, limitNetwork, RateLimitError } from "@/lib/rate-limit";
import { z } from "zod";
import {
  createPasswordResetToken,
  discardPasswordResetToken,
  resetPasswordWithToken,
} from "@/lib/auth-service";
import { sendPasswordResetEmail } from "@/lib/email";

export type PasswordResetState = {
  error?: string;
  success?: string;
} | undefined;

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
const passwordSchema = z.string().max(128)
  .min(8, "A senha deve ter ao menos 8 caracteres.")
  .regex(/[A-Za-z]/, "Inclua uma letra na senha.")
  .regex(/[0-9]/, "Inclua um número na senha.");

const genericRequestMessage = "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.";

export async function requestPasswordResetAction(
  _state: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    await limitNetwork("password-reset", await headers(), 20, 3600);
    await consumeRateLimit("password-reset:email", parsed.data, 3, 3600);
    const reset = await createPasswordResetToken(parsed.data);
    if (reset) {
      try {
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        const resetUrl = new URL("/redefinir-senha", appUrl);
        resetUrl.searchParams.set("token", reset.token);
        await sendPasswordResetEmail({ to: reset.email, resetUrl: resetUrl.toString() });
      } catch (error) {
        await discardPasswordResetToken(reset.token);
        console.error(JSON.stringify({ event: "password_reset_email_failed", error: error instanceof Error ? error.name : "UnknownError" }));
      }
    }
  } catch (error) {
    if (!(error instanceof RateLimitError)) console.error(JSON.stringify({ event: "password_reset_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  }

  return { success: genericRequestMessage };
}

export async function resetPasswordAction(
  _state: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = z.object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };
  }
  if (parsed.data.password !== parsed.data.passwordConfirmation) {
    return { error: "As senhas não coincidem." };
  }

  let changed = false;
  try {
    await limitNetwork("reset-token", await headers(), 30, 900);
    changed = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  } catch (error) {
    if (error instanceof RateLimitError) return { error: error.message };
    console.error(JSON.stringify({ event: "password_reset_token_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return { error: "Não foi possível redefinir a senha agora. Tente novamente." };
  }
  if (!changed) return { error: "Este link é inválido ou expirou. Solicite um novo." };

  return { success: "Senha redefinida. Agora você já pode entrar na sua conta." };
}
