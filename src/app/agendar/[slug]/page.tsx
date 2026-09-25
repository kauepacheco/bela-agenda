import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PublicBooking } from "./public-booking";
import { bookingSettingsSchema } from "@/lib/booking-policy";

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({ where: { slug }, include: { services: { where: { active: true, professionals: { some: { professional: { active: true } } } }, include: { professionals: { where: { professional: { active: true } }, select: { professional: { select: { id: true, name: true, role: true, color: true } } } } }, orderBy: { name: "asc" } } } });
  if (!business?.onboardingCompletedAt) notFound();
  return <PublicBooking business={{ name: business.name, city: business.city, address: business.address, slug: business.slug, phone: business.phone }} services={JSON.parse(JSON.stringify(business.services))} enabled={bookingSettingsSchema.safeParse(business.bookingSettings).success}/>;
}
