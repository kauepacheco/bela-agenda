import { PrismaClient } from "@prisma/client";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.professionalService.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  const business = await prisma.business.create({
    data: {
      name: "Ateliê Bela",
      slug: "atelier-bela",
      phone: "(47) 99999-1234",
      address: "Rua Samuel Heusi, 120",
      onboardingCompletedAt: new Date(),
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Marina Costa",
      email: "demo@belaagenda.com.br",
      passwordHash: await hashPassword("Bela1234!"),
    },
  });
  await prisma.membership.create({ data: { userId: owner.id, businessId: business.id, role: "OWNER" } });

  const [ana, camila, julia] = await Promise.all([
    prisma.professional.create({ data: { businessId: business.id, name: "Ana Costa", role: "Cabeleireira", color: "#D97757" } }),
    prisma.professional.create({ data: { businessId: business.id, name: "Camila Luz", role: "Nail designer", color: "#5B7C6F" } }),
    prisma.professional.create({ data: { businessId: business.id, name: "Júlia Martins", role: "Designer", color: "#8B6D9C" } }),
  ]);

  const [corte, escova, manicure, sobrancelha] = await Promise.all([
    prisma.service.create({ data: { businessId: business.id, name: "Corte feminino", durationMin: 60, priceCents: 8500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Escova", durationMin: 45, priceCents: 6500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Manicure", durationMin: 50, priceCents: 4500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Design de sobrancelha", durationMin: 30, priceCents: 4000 } }),
  ]);

  await prisma.professionalService.createMany({ data: [
    { professionalId: ana.id, serviceId: corte.id },
    { professionalId: ana.id, serviceId: escova.id },
    { professionalId: camila.id, serviceId: manicure.id },
    { professionalId: julia.id, serviceId: sobrancelha.id },
  ] });

  const clients = await Promise.all([
    prisma.client.create({ data: { businessId: business.id, name: "Marina Souza", phone: "47991234567" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Beatriz Lima", phone: "47992345678" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Carolina Reis", phone: "47993456789" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Fernanda Melo", phone: "47994567890" } }),
  ]);

  const base = startOfDay(new Date());
  const at = (day: number, hour: number, minute = 0) => setMinutes(setHours(addDays(base, day), hour), minute);
  await prisma.appointment.createMany({ data: [
    { businessId: business.id, clientId: clients[0].id, professionalId: ana.id, serviceId: corte.id, startsAt: at(0, 9), endsAt: at(0, 10), status: "CONFIRMED", source: "WHATSAPP" },
    { businessId: business.id, clientId: clients[1].id, professionalId: camila.id, serviceId: manicure.id, startsAt: at(0, 10, 30), endsAt: at(0, 11, 20), status: "CONFIRMED", source: "DASHBOARD" },
    { businessId: business.id, clientId: clients[2].id, professionalId: julia.id, serviceId: sobrancelha.id, startsAt: at(0, 14), endsAt: at(0, 14, 30), status: "PENDING", source: "PUBLIC_BOOKING" },
    { businessId: business.id, clientId: clients[3].id, professionalId: ana.id, serviceId: escova.id, startsAt: at(1, 11), endsAt: at(1, 11, 45), status: "CONFIRMED", source: "WHATSAPP" },
    { businessId: business.id, clientId: clients[0].id, professionalId: camila.id, serviceId: manicure.id, startsAt: at(2, 15), endsAt: at(2, 15, 50), status: "CONFIRMED", source: "PUBLIC_BOOKING" },
  ] });
}

main().finally(() => prisma.$disconnect());
