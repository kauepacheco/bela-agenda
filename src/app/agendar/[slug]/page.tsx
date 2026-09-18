import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PublicBooking } from "./public-booking";

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({ where: { slug }, include: { services: { where: { active: true }, include: { professionals: { include: { professional: true } } }, orderBy: { name: "asc" } } } });
  if (!business) notFound();
  return <PublicBooking business={{ name: business.name, city: business.city, address: business.address, slug: business.slug }} services={JSON.parse(JSON.stringify(business.services))}/>;
}
