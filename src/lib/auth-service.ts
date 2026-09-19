import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_DURATION_MS = 30 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const hashPasswordResetToken = hashSessionToken;

function isPasswordResetTokenFormatValid(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
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
        include: { business: true },
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

export async function createPasswordResetToken(
  email: string,
  options: { now?: Date; durationMs?: number } = {},
) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!user) return null;

  const token = randomBytes(32).toString("base64url");
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (options.durationMs ?? PASSWORD_RESET_DURATION_MS));

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashPasswordResetToken(token), expiresAt },
    }),
  ]);

  return { token, expiresAt, email: user.email };
}

export async function discardPasswordResetToken(token: string) {
  if (!isPasswordResetTokenFormatValid(token)) return;
  await prisma.passwordResetToken.deleteMany({
    where: { tokenHash: hashPasswordResetToken(token), usedAt: null },
  });
}

export async function isPasswordResetTokenValid(token: string, now = new Date()) {
  if (!isPasswordResetTokenFormatValid(token)) return false;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashPasswordResetToken(token) },
    select: { expiresAt: true, usedAt: true },
  });
  return Boolean(record && !record.usedAt && record.expiresAt > now);
}

export async function resetPasswordWithToken(token: string, password: string, now = new Date()) {
  if (!isPasswordResetTokenFormatValid(token)) return false;
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;

    const record = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (!record) return false;

    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.session.deleteMany({
      where: { membership: { userId: record.userId } },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
    return true;
  });
}
