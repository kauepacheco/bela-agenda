import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { bookingSettingsSchema, defaultBookingSettings } from "@/lib/booking-policy";
import { prisma } from "@/lib/prisma";
import { inheritedAvailability, professionalAvailabilitySchema } from "@/lib/professional-policy";
import { ProfessionalSchedules } from "./professional-schedules";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const context = await requireAuthContext();
  const settings = bookingSettingsSchema.safeParse(context.business.bookingSettings);
  const professionals = await prisma.professional.findMany({ where: { businessId: context.business.id, active: true }, orderBy: { name: "asc" } });
  const schedules = professionals.map((item) => ({ id: item.id, name: item.name, version: item.availabilityVersion, availability: item.availability === null ? inheritedAvailability : professionalAvailabilitySchema.parse(item.availability) }));
  return <AppShell context={context}><div className="page-heading"><div><span className="eyebrow">DO SEU JEITO</span><h1>Seu estabelecimento</h1><p>Prepare a agenda para receber seus próximos clientes.</p></div></div><SettingsForm business={{ name: context.business.name, phone: context.business.phone ?? "", address: context.business.address ?? "", city: context.business.city, slug: context.business.slug }} initialSettings={settings.success ? settings.data : defaultBookingSettings} canEdit={context.role === "OWNER"} configured={settings.success}/><ProfessionalSchedules professionals={schedules} settings={settings.success ? settings.data : defaultBookingSettings} canEdit={context.role === "OWNER"}/></AppShell>;
}
