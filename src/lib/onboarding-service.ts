import { prisma } from "@/lib/prisma";

export class OnboardingServiceError extends Error {
  constructor(public readonly code: "FORBIDDEN") {
    super(code);
  }
}

export async function completeBusinessOnboarding(input: {
  actorMembershipId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  now?: Date;
}) {
  return prisma.$transaction(async (tx) => {
    let membership = await tx.membership.findFirst({
      where: { id: input.actorMembershipId, active: true, role: "OWNER" },
      select: { businessId: true },
    });
    if (!membership) throw new OnboardingServiceError("FORBIDDEN");

    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${membership.businessId} FOR UPDATE`;
    membership = await tx.membership.findFirst({
      where: { id: input.actorMembershipId, active: true, role: "OWNER" },
      select: { businessId: true },
    });
    if (!membership) throw new OnboardingServiceError("FORBIDDEN");

    return tx.business.update({
      where: { id: membership.businessId },
      data: {
        name: input.name.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        phone: input.phone.replace(/\D/g, ""),
        onboardingCompletedAt: input.now ?? new Date(),
      },
    });
  });
}
