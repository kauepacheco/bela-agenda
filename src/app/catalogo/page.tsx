import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const context = await requireAuthContext();
  const { business } = context;
  const [professionals, services] = await Promise.all([prisma.professional.findMany({ where: { businessId: business.id, active: true }, include: { services: { include: { service: true } } }, orderBy: { name: "asc" } }), prisma.service.findMany({ where: { businessId: business.id, active: true }, include: { professionals: { include: { professional: true } } }, orderBy: { name: "asc" } })]);
  return <AppShell context={context}><CatalogClient initialProfessionals={JSON.parse(JSON.stringify(professionals))} initialServices={JSON.parse(JSON.stringify(services))}/></AppShell>;
}
