import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TeamManager } from "@/components/team-manager";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const context = await requireAuthContext();
  if (context.role !== "OWNER") redirect("/");

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { businessId: context.business.id, active: true },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membershipInvitation.findMany({
      where: {
        businessId: context.business.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <AppShell context={context}>
    <TeamManager
      currentMembershipId={context.membershipId}
      members={members.map((member) => ({ ...member, createdAt: member.createdAt.toISOString() }))}
      invitations={invitations.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      }))}
    />
  </AppShell>;
}
