"use server";

import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteCurrentSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type AuthState = { error?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
const password = z.string().min(8, "A senha deve ter ao menos 8 caracteres.").regex(/[A-Za-z]/, "Inclua uma letra na senha.").regex(/[0-9]/, "Inclua um número na senha.");

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "estabelecimento";
}

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({
    name: z.string().trim().min(2, "Informe seu nome."),
    businessName: z.string().trim().min(2, "Informe o nome do estabelecimento."),
    email,
    password,
  }).safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." };

  const { name, businessName, email: userEmail, password: plainPassword } = parsed.data;
  const passwordHash = await hashPassword(plainPassword);
  const baseSlug = slugify(businessName);
  const existingSlug = await prisma.business.findUnique({ where: { slug: baseSlug }, select: { id: true } });
  const slug = existingSlug ? `${baseSlug}-${randomBytes(3).toString("hex")}` : baseSlug;

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email: userEmail, passwordHash } });
      const business = await tx.business.create({ data: { name: businessName, slug } });
      return tx.membership.create({ data: { userId: user.id, businessId: business.id, role: "OWNER" } });
    });
    await createSession(membership.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Já existe uma conta com esse e-mail. Entre para continuar." };
    }
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }

  redirect("/");
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe e-mail e senha." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { where: { active: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const passwordIsValid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  const membership = user?.memberships[0];

  if (!passwordIsValid || !membership) return { error: "E-mail ou senha inválidos." };

  await createSession(membership.id);
  redirect("/");
}

export async function logoutAction() {
  await deleteCurrentSession();
  redirect("/entrar");
}
