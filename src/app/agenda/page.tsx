import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfWeek, startOfWeek } from "date-fns";
import { AgendaClient } from "./agenda-client";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const query = await searchParams;
  const context = await requireAuthContext();
  const { business } = context;
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  const [appointments, professionals, services, clients] = await Promise.all([
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: start, lte: end } }, include: { client: true, professional: true, service: true }, orderBy: { startsAt: "asc" } }),
    prisma.professional.findMany({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } }),
  ]);
  return <AppShell context={context}><AgendaClient initialAppointments={JSON.parse(JSON.stringify(appointments))} professionals={professionals} services={services} clients={clients} initialOpen={query.novo === "1"} /></AppShell>;
}
