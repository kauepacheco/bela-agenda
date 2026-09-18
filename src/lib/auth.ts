import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "bela_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(membershipId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { membershipId, tokenHash: hashSessionToken(token), expiresAt },
  });

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
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentContext = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { membership: { include: { user: true, business: true } } },
  });

  if (!session || session.expiresAt <= new Date() || !session.membership.active) return null;

  return {
    sessionId: session.id,
    membershipId: session.membership.id,
    role: session.membership.role,
    user: {
      id: session.membership.user.id,
      name: session.membership.user.name,
      email: session.membership.user.email,
    },
    business: session.membership.business,
  };
});

export async function requireAuthContext() {
  const context = await getCurrentContext();
  if (!context) redirect("/entrar");
  return context;
}
