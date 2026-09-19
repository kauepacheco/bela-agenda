import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionRecord,
  getSessionContextFromToken,
  revokeSessionToken,
} from "@/lib/auth-service";

export const SESSION_COOKIE = "bela_session";

export async function createSession(membershipId: string) {
  const { token, expiresAt } = await createSessionRecord(membershipId);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  cookieStore.delete(SESSION_COOKIE);
}

const getAnyCurrentContext = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return getSessionContextFromToken(token);
});

export async function getCurrentContext() {
  const context = await getAnyCurrentContext();
  return context?.business.onboardingCompletedAt ? context : null;
}

export async function requireAuthContext(options: { allowIncompleteOnboarding?: boolean } = {}) {
  const context = await getAnyCurrentContext();
  if (!context) redirect("/entrar");
  if (!options.allowIncompleteOnboarding && !context.business.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  return context;
}
