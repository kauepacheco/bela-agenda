import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientsClient } from "./clients-client";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const context = await requireAuthContext();
  const { business } = context;
  const clients = await prisma.client.findMany({ where: { businessId: business.id }, include: { appointments: { include: { service: true }, orderBy: { startsAt: "desc" }, take: 1 } }, orderBy: { name: "asc" } });
  return <AppShell context={context}><ClientsClient initialClients={JSON.parse(JSON.stringify(clients))} /></AppShell>;
}
