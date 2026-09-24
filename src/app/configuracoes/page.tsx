import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { bookingSettingsSchema, defaultBookingSettings } from "@/lib/booking-policy";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const context = await requireAuthContext();
  const settings = bookingSettingsSchema.safeParse(context.business.bookingSettings);
  return <AppShell context={context}><div className="page-heading"><div><span className="eyebrow">DO SEU JEITO</span><h1>Seu estabelecimento</h1><p>Prepare a agenda para receber seus próximos clientes.</p></div></div><SettingsForm business={{ name: context.business.name, phone: context.business.phone ?? "", address: context.business.address ?? "", city: context.business.city, slug: context.business.slug }} initialSettings={settings.success ? settings.data : defaultBookingSettings} canEdit={context.role === "OWNER"} configured={settings.success}/></AppShell>;
}
