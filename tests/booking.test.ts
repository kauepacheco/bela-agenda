import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ context: null as null | { business: { id: string }; role: string; membershipId: string } }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: async () => auth.context }));
import { prisma } from "@/lib/prisma";
import { availableSlots, changeBooking, createBooking } from "@/lib/booking-service";
import { addDateDays, atBusinessTime, businessDate, businessTime, bookingSettingsSchema, defaultBookingSettings, phoneSchema } from "@/lib/booking-policy";
import { GET, POST } from "@/app/api/public/[slug]/appointments/route";
import { GET as privateGet, POST as privatePost, PATCH as privatePatch } from "@/app/api/appointments/route";
import { PATCH as settingsPatch } from "@/app/api/settings/route";

beforeEach(async () => {
  auth.context = null;
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Business", "User" CASCADE');
});
afterAll(async () => { await prisma.$disconnect(); });

async function fixture(slug = "teste") {
  const settings = { ...defaultBookingSettings, minNoticeMin: 0, days: defaultBookingSettings.days.map((day) => ({ ...day, enabled: true })) };
  const business = await prisma.business.create({ data: { name: "Espaço Teste", slug, onboardingCompletedAt: new Date(), bookingSettings: settings } });
  const professional = await prisma.professional.create({ data: { businessId: business.id, name: "Ana", role: "Cabeleireira" } });
  const service = await prisma.service.create({ data: { businessId: business.id, name: "Corte", priceCents: 8500, durationMin: 60, professionals: { create: { professionalId: professional.id } } } });
  const client = await prisma.client.create({ data: { businessId: business.id, name: "Nome original", phone: "47999991234" } });
  const day = addDateDays(businessDate(), 2);
  const booking = { businessId: business.id, professionalId: professional.id, serviceId: service.id, clientId: client.id, startsAt: atBusinessTime(day, "10:00"), source: "DASHBOARD" as const };
  auth.context = { business, role: "OWNER", membershipId: "test-owner" };
  return { business, professional, service, client, day, booking, settings };
}
const jsonRequest = (url: string, method: string, data: unknown) => new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

describe("agenda operacional", () => {
  it("serializa reservas simultâneas: apenas uma vence e a outra retorna conflito", async () => {
    const { booking } = await fixture();
    const results = await Promise.allSettled([createBooking(booking), createBooking(booking)]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((item) => item.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason.status).toBe(409);
    expect(await prisma.appointment.count()).toBe(1);
    expect(await prisma.appointmentEvent.count()).toBe(1);
  });

  it("considera duração e intervalo dos dois lados, e o fechamento", async () => {
    const { business, professional, service, booking, day, settings } = await fixture();
    await prisma.business.update({ where: { id: business.id }, data: { bookingSettings: { ...settings, bufferMin: 15 } } });
    await createBooking(booking);
    const slots = (await availableSlots(business.id, professional.id, service.id, day)).map((slot) => businessTime(new Date(slot)));
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("10:30");
    expect(slots).not.toContain("11:00");
    expect(slots).toContain("11:15");
    expect(slots).toContain("16:45");
    expect(slots).not.toContain("17:00");
    await expect(createBooking({ ...booking, startsAt: atBusinessTime(day, "11:00") })).rejects.toMatchObject({ status: 409 });
  });

  it("rejeita datas passadas, jornada fechada, antecedência e prazo máximo", async () => {
    const { booking, day, settings, business, professional, service } = await fixture();
    await expect(createBooking({ ...booking, startsAt: new Date(Date.now() - 86400_000) })).rejects.toMatchObject({ status: 400 });
    await expect(createBooking({ ...booking, startsAt: atBusinessTime(addDateDays(day, 50), "10:00") })).rejects.toMatchObject({ status: 400 });
    await expect(createBooking({ ...booking, startsAt: atBusinessTime(day, "17:30") })).rejects.toMatchObject({ status: 400 });
    await prisma.business.update({ where: { id: business.id }, data: { bookingSettings: { ...settings, minNoticeMin: 10080 } } });
    await expect(createBooking(booking)).rejects.toMatchObject({ status: 400 });
    await prisma.business.update({ where: { id: business.id }, data: { bookingSettings: { ...settings, days: settings.days.map((item) => ({ ...item, enabled: false })) } } });
    expect(await availableSlots(business.id, professional.id, service.id, day)).toEqual([]);
    await expect(createBooking(booking)).rejects.toMatchObject({ status: 400 });
  });

  it("não agenda com profissional sem vínculo ao serviço ou de outra empresa", async () => {
    const { booking, business } = await fixture();
    const otherProfessional = await prisma.professional.create({ data: { businessId: business.id, name: "Bia", role: "Nail designer" } });
    await expect(createBooking({ ...booking, professionalId: otherProfessional.id })).rejects.toMatchObject({ status: 404 });
    const other = await fixture("outro");
    await expect(createBooking({ ...booking, professionalId: other.professional.id, serviceId: other.service.id })).rejects.toMatchObject({ status: 404 });
    await expect(changeBooking(other.business.id, { id: (await createBooking(booking)).id, status: "CANCELLED" })).rejects.toMatchObject({ status: 404 });
  });

  it("cancelamento libera o horário e não pode reativar uma reserva encerrada", async () => {
    const { booking } = await fixture();
    const item = await createBooking(booking);
    await changeBooking(booking.businessId, { id: item.id, status: "CANCELLED" }, "owner");
    await createBooking(booking);
    await expect(changeBooking(booking.businessId, { id: item.id, status: "CONFIRMED" })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.appointmentEvent.count({ where: { appointmentId: item.id } })).toBe(2);
  });

  it("reagendamento valida conflitos e preserva histórico e horário em falhas", async () => {
    const { booking, day } = await fixture();
    const first = await createBooking(booking);
    const second = await createBooking({ ...booking, startsAt: atBusinessTime(day, "12:00") });
    await expect(changeBooking(booking.businessId, { id: first.id, startsAt: second.startsAt })).rejects.toMatchObject({ status: 409 });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: first.id } })).startsAt).toEqual(first.startsAt);
    await changeBooking(booking.businessId, { id: first.id, startsAt: atBusinessTime(day, "14:00") }, "owner");
    const events = await prisma.appointmentEvent.findMany({ where: { appointmentId: first.id, action: "RESCHEDULED" } });
    expect(events).toHaveLength(1);
    expect(events[0].details).toMatchObject({ previousStartsAt: first.startsAt.toISOString() });
    await expect(changeBooking(booking.businessId, { id: first.id, status: "COMPLETED" })).rejects.toMatchObject({ status: 400 });
  });

  it("marca conclusão e falta somente após o início do atendimento", async () => {
    const { booking } = await fixture();
    for (const status of ["COMPLETED", "NO_SHOW"] as const) {
      const item = await prisma.appointment.create({ data: { ...booking, clientId: booking.clientId, startsAt: new Date(Date.now() - 3600_000), endsAt: new Date(Date.now() - 1800_000) } });
      expect((await changeBooking(booking.businessId, { id: item.id, status })).status).toBe(status);
    }
  });
});

describe("contratos públicos e configurações", () => {
  it("expõe apenas horários e confirmação mínima, sem sobrescrever cliente existente", async () => {
    const { business, professional, service, day, client } = await fixture();
    const params = { params: Promise.resolve({ slug: business.slug }) };
    const query = new URLSearchParams({ professionalId: professional.id, serviceId: service.id, date: day });
    const available = await GET(new Request(`http://localhost/api/public/teste/appointments?${query}`), params);
    const payload = await available.json();
    expect(Object.keys(payload)).toEqual(["slots"]);
    const response = await POST(jsonRequest("/api/public/teste/appointments", "POST", { professionalId: professional.id, serviceId: service.id, startsAt: payload.slots[0], clientName: "Nome invasor", clientPhone: "+55 (47) 99999-1234" }), params);
    expect(response.status).toBe(201);
    expect(Object.keys(await response.json()).sort()).toEqual(["endsAt", "id", "startsAt", "status"]);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).name).toBe("Nome original");
  });

  it("somente proprietário altera os horários da sua empresa", async () => {
    const first = await fixture();
    const second = await fixture("segundo");
    auth.context = { business: first.business, role: "EMPLOYEE", membershipId: "employee" };
    const data = { businessId: second.business.id, name: "Atualizado", phone: "47999990000", address: "Rua Central, 10", city: "Itajaí", bookingSettings: { ...first.settings, bufferMin: 20 } };
    expect((await settingsPatch(jsonRequest("/api/settings", "PATCH", data))).status).toBe(403);
    auth.context.role = "OWNER";
    expect((await settingsPatch(jsonRequest("/api/settings", "PATCH", data))).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: first.business.id } })).name).toBe("Atualizado");
    expect((await prisma.business.findUniqueOrThrow({ where: { id: second.business.id } })).name).toBe("Espaço Teste");
  });

  it("trata JSON inválido, data inválida, intervalo invertido e telefone sem dígitos", async () => {
    await fixture();
    expect((await privatePost(new Request("http://localhost/api/appointments", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await privateGet(new Request("http://localhost/api/appointments?start=nope&end=nope"))).status).toBe(400);
    expect((await privateGet(new Request("http://localhost/api/appointments?start=2026-10-10&end=2026-10-01"))).status).toBe(400);
    expect((await privatePatch(jsonRequest("/api/appointments", "PATCH", { id: "x" }))).status).toBe(400);
    expect(phoneSchema.safeParse("abcdefghijk").success).toBe(false);
    expect(bookingSettingsSchema.safeParse({ ...defaultBookingSettings, days: [{ enabled: true, open: "18:00", close: "09:00" }] }).success).toBe(false);
  });

  it("converte datas de Brasília mesmo com o servidor em UTC", () => {
    expect(atBusinessTime("2026-09-24", "09:15").toISOString()).toBe("2026-09-24T12:15:00.000Z");
    expect(businessDate(new Date("2026-09-25T01:30:00Z"))).toBe("2026-09-24");
    expect(businessTime(new Date("2026-09-25T01:30:00Z"))).toBe("22:30");
  });
});
