import { createHash, randomBytes } from "node:crypto";
import type { MembershipRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export const INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type TeamErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_MEMBER"
  | "LAST_OWNER"
  | "INVALID_INVITATION"
  | "INVALID_CREDENTIALS"
  | "INVALID_NAME";

export class TeamServiceError extends Error {
  constructor(public readonly code: TeamErrorCode) {
    super(code);
  }
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

async function requireOwner(
  tx: Prisma.TransactionClient,
  membershipId: string,
) {
  const membership = await tx.membership.findFirst({
    where: { id: membershipId, active: true, role: "OWNER" },
    select: { id: true, businessId: true },
  });
  if (!membership) throw new TeamServiceError("FORBIDDEN");
  return membership;
}

async function lockBusiness(tx: Prisma.TransactionClient, businessId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`;
}

export async function createMemberInvitation(input: {
  actorMembershipId: string;
  email: string;
  role: MembershipRole;
  now?: Date;
  durationMs?: number;
}) {
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.durationMs ?? INVITATION_DURATION_MS));

  const invitation = await prisma.$transaction(async (tx) => {
    let actor = await requireOwner(tx, input.actorMembershipId);
    await lockBusiness(tx, actor.businessId);
    actor = await requireOwner(tx, input.actorMembershipId);
    const existingMember = await tx.membership.findFirst({
      where: { businessId: actor.businessId, active: true, user: { email } },
      select: { id: true },
    });
    if (existingMember) throw new TeamServiceError("ALREADY_MEMBER");

    await tx.membershipInvitation.deleteMany({
      where: { businessId: actor.businessId, email, acceptedAt: null },
    });
    return tx.membershipInvitation.create({
      data: {
        businessId: actor.businessId,
        invitedByMembershipId: actor.id,
        email,
        role: input.role,
        tokenHash: hashInvitationToken(token),
        expiresAt,
      },
      include: { business: { select: { name: true } } },
    });
  });

  return {
    token,
    email: invitation.email,
    role: invitation.role,
    businessName: invitation.business.name,
    expiresAt: invitation.expiresAt,
  };
}

export async function discardMemberInvitation(token: string) {
  if (!validToken(token)) return;
  await prisma.membershipInvitation.deleteMany({
    where: { tokenHash: hashInvitationToken(token), acceptedAt: null },
  });
}

export async function cancelMemberInvitation(actorMembershipId: string, invitationId: string) {
  return prisma.$transaction(async (tx) => {
    let actor = await requireOwner(tx, actorMembershipId);
    await lockBusiness(tx, actor.businessId);
    actor = await requireOwner(tx, actorMembershipId);
    const removed = await tx.membershipInvitation.deleteMany({
      where: { id: invitationId, businessId: actor.businessId, acceptedAt: null },
    });
    if (removed.count !== 1) throw new TeamServiceError("NOT_FOUND");
  });
}

export async function getMemberInvitation(token: string, now = new Date()) {
  if (!validToken(token)) return null;
  const invitation = await prisma.membershipInvitation.findFirst({
    where: {
      tokenHash: hashInvitationToken(token),
      acceptedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      email: true,
      role: true,
      business: { select: { name: true } },
    },
  });
  if (!invitation) return null;
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  return {
    email: invitation.email,
    role: invitation.role,
    businessName: invitation.business.name,
    existingUser: Boolean(existingUser),
  };
}

export async function acceptMemberInvitation(input: {
  token: string;
  name?: string;
  password: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const details = await getMemberInvitation(input.token, now);
  if (!details) throw new TeamServiceError("INVALID_INVITATION");

  const existingUser = await prisma.user.findUnique({ where: { email: details.email } });
  if (existingUser && !(await verifyPassword(input.password, existingUser.passwordHash))) {
    throw new TeamServiceError("INVALID_CREDENTIALS");
  }
  if (!existingUser && (!input.name || input.name.trim().length < 2)) {
    throw new TeamServiceError("INVALID_NAME");
  }
  const passwordHash = existingUser ? null : await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.membershipInvitation.updateMany({
      where: {
        tokenHash: hashInvitationToken(input.token),
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      data: { acceptedAt: now },
    });
    if (claimed.count !== 1) throw new TeamServiceError("INVALID_INVITATION");

    const invitation = await tx.membershipInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(input.token) },
    });
    if (!invitation) throw new TeamServiceError("INVALID_INVITATION");

    const user = existingUser
      ? await tx.user.findUnique({ where: { id: existingUser.id } })
      : await tx.user.create({
          data: {
            name: input.name!.trim(),
            email: invitation.email,
            passwordHash: passwordHash!,
          },
        });
    if (!user) throw new TeamServiceError("INVALID_INVITATION");

    const current = await tx.membership.findUnique({
      where: { userId_businessId: { userId: user.id, businessId: invitation.businessId } },
    });
    if (current?.active) throw new TeamServiceError("ALREADY_MEMBER");

    const membership = current
      ? await tx.membership.update({
          where: { id: current.id },
          data: { active: true, role: invitation.role },
        })
      : await tx.membership.create({
          data: { userId: user.id, businessId: invitation.businessId, role: invitation.role },
        });

    await tx.membershipInvitation.deleteMany({
      where: {
        businessId: invitation.businessId,
        email: invitation.email,
        acceptedAt: null,
      },
    });
    return membership;
  });
}

export async function removeMember(actorMembershipId: string, targetMembershipId: string) {
  return prisma.$transaction(async (tx) => {
    let actor = await requireOwner(tx, actorMembershipId);
    await lockBusiness(tx, actor.businessId);
    actor = await requireOwner(tx, actorMembershipId);

    const target = await tx.membership.findFirst({
      where: { id: targetMembershipId, businessId: actor.businessId, active: true },
      select: { id: true, role: true },
    });
    if (!target) throw new TeamServiceError("NOT_FOUND");

    if (target.role === "OWNER") {
      const owners = await tx.membership.count({
        where: { businessId: actor.businessId, role: "OWNER", active: true },
      });
      if (owners <= 1) throw new TeamServiceError("LAST_OWNER");
    }

    await tx.membership.update({ where: { id: target.id }, data: { active: false } });
    await tx.session.deleteMany({ where: { membershipId: target.id } });
  });
}
