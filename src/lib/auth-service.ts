import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "estabelecimento";
}

export async function createAccount(input: {
  name: string;
  businessName: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const baseSlug = slugify(input.businessName);
  const existingSlug = await prisma.business.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  const slug = existingSlug ? `${baseSlug}-${randomBytes(3).toString("hex")}` : baseSlug;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
    const business = await tx.business.create({
      data: { name: input.businessName, slug },
    });
    return tx.membership.create({
      data: { userId: user.id, businessId: business.id, role: "OWNER" },
      include: { user: true, business: true },
    });
  });
}

export async function authenticateCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return user.memberships[0] ?? null;
}

export async function createSessionRecord(
  membershipId: string,
  options: { now?: Date; durationMs?: number } = {},
) {
  const token = randomBytes(32).toString("base64url");
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (options.durationMs ?? SESSION_DURATION_MS));

  await prisma.session.create({
    data: { membershipId, tokenHash: hashSessionToken(token), expiresAt },
  });

  return { token, expiresAt };
}

export async function revokeSessionToken(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function getSessionContextFromToken(token: string, now = new Date()) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { membership: { include: { user: true, business: true } } },
  });

  if (!session || session.expiresAt <= now || !session.membership.active) return null;

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
}
