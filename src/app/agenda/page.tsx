import { refreshPendingBookings } from "@/lib/booking-service";
import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDateDays, atBusinessTime, businessDate } from "@/lib/booking-policy";
import { AgendaClient } from "./agenda-client";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const query = await searchParams;
  const context = await requireAuthContext();
  await refreshPendingBookings(context.business.id);
  const { business } = context;
  const today = businessDate();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = addDateDays(today, -(weekday === 0 ? 6 : weekday - 1));
  const start = atBusinessTime(monday);
  const end = new Date(atBusinessTime(addDateDays(monday, 7)).getTime() - 1);
  const [appointments, professionals, services, clients] = await Promise.all([
    prisma.appointment.findMany({ where: { businessId: business.id, startsAt: { gte: start, lte: end } }, include: { client: true, professional: true, service: true }, orderBy: { startsAt: "asc" } }),
    prisma.professional.findMany({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { businessId: business.id, active: true }, include: { professionals: { select: { professionalId: true } } }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  return <AppShell context={context}><AgendaClient businessName={business.name} initialAppointments={JSON.parse(JSON.stringify(appointments))} professionals={professionals} services={services} clients={clients} initialOpen={query.novo === "1"} /></AppShell>;
}
