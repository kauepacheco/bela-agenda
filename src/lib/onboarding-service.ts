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
  professionals: Array<{
    key: string;
    name: string;
    role: string;
    color: string;
  }>;
  services: Array<{
    name: string;
    durationMin: number;
    priceCents: number;
    professionalKeys: string[];
  }>;
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

    const business = await tx.business.findUniqueOrThrow({
      where: { id: membership.businessId },
      select: { onboardingCompletedAt: true },
    });
    if (business.onboardingCompletedAt) {
      return tx.business.findUniqueOrThrow({ where: { id: membership.businessId } });
    }

    const professionalIds = new Map<string, string>();
    for (const professional of input.professionals) {
      const created = await tx.professional.create({
        data: {
          businessId: membership.businessId,
          name: professional.name.trim(),
          role: professional.role.trim(),
          color: professional.color,
        },
        select: { id: true },
      });
      professionalIds.set(professional.key, created.id);
    }

    for (const service of input.services) {
      await tx.service.create({
        data: {
          businessId: membership.businessId,
          name: service.name.trim(),
          durationMin: service.durationMin,
          priceCents: service.priceCents,
          professionals: {
            create: service.professionalKeys.map((key) => ({
              professionalId: professionalIds.get(key)!,
            })),
          },
        },
      });
    }

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
