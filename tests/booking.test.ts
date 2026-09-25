import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ context: null as null | { business: { id: string }; role: string; membershipId: string } }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: async () => auth.context }));
import { saveProfessionalAvailability } from "@/lib/professional-service";
import { professionalAvailabilitySchema } from "@/lib/professional-policy";
import { PATCH as availabilityPatch } from "@/app/api/professional-availability/route";
import { prisma } from "@/lib/prisma";
import { availableSlots, changeBooking, createBooking, refreshPendingBookings } from "@/lib/booking-service";
import { addDateDays, atBusinessTime, businessDate, businessTime, bookingSettingsSchema, defaultBookingSettings, phoneSchema } from "@/lib/booking-policy";
import { GET, POST } from "@/app/api/public/[slug]/appointments/route";
import { GET as privateGet, POST as privatePost, PATCH as privatePatch } from "@/app/api/appointments/route";
import { GET as historyGet } from "@/app/api/appointments/[id]/history/route";
import { PATCH as settingsPatch } from "@/app/api/settings/route";

beforeEach(async () => {
  auth.context = null;
  await prisma.rateLimitBucket.deleteMany();
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
      const item = await prisma.appointment.create({ data: { ...booking, serviceName: "Corte", priceCents: 8500, durationMin: 60, clientId: booking.clientId, startsAt: new Date(Date.now() - 3600_000), endsAt: new Date(Date.now() - 1800_000) } });
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


describe("jornadas individuais e bloqueios", () => {
  it("considera almoço, folga semanal e intervalo no painel e na disponibilidade pública", async () => {
    const { booking, business, professional, service, day, settings } = await fixture();
    const week = Array.from({ length: 7 }, () => [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }]);
    await saveProfessionalAvailability(business.id, professional.id, 0, { week, blocks: [] });
    await prisma.business.update({ where: { id: business.id }, data: { bookingSettings: { ...settings, bufferMin: 15 } } });
    const slots = (await availableSlots(business.id, professional.id, service.id, day)).map((slot) => businessTime(new Date(slot)));
    expect(slots).toContain("10:45");
    expect(slots).not.toContain("11:00");
    expect(slots).not.toContain("12:00");
    expect(slots).toContain("13:00");
    await expect(createBooking({ ...booking, startsAt: atBusinessTime(day, "11:00") })).rejects.toMatchObject({ status: 409 });
    week[new Date(`${day}T12:00:00Z`).getUTCDay()] = [];
    await saveProfessionalAvailability(business.id, professional.id, 1, { week, blocks: [] });
    expect(await availableSlots(business.id, professional.id, service.id, day)).toEqual([]);
  });

  it("bloqueia férias em vários dias e permite reservar exatamente após o fim", async () => {
    const { booking, business, professional, service, day } = await fixture();
    const blocks = [{ startsAt: atBusinessTime(day, "11:00").toISOString(), endsAt: atBusinessTime(addDateDays(day, 2), "12:00").toISOString(), reason: "Férias" }];
    await saveProfessionalAvailability(business.id, professional.id, 0, { week: null, blocks });
    await createBooking(booking); // Ends exactly at the beginning of the block.
    await expect(createBooking({ ...booking, startsAt: atBusinessTime(day, "11:00") })).rejects.toMatchObject({ status: 409 });
    expect(await availableSlots(business.id, professional.id, service.id, addDateDays(day, 1))).toEqual([]);
    await createBooking({ ...booking, startsAt: atBusinessTime(addDateDays(day, 2), "12:00") });
    const item = await createBooking({ ...booking, startsAt: atBusinessTime(addDateDays(day, 2), "14:00") });
    await expect(changeBooking(business.id, { id: item.id, startsAt: atBusinessTime(day, "14:00") })).rejects.toMatchObject({ status: 409 });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: item.id } })).startsAt).toEqual(item.startsAt);
  });

  it("recusa jornada que afeta reservas abertas e permite após cancelamento", async () => {
    const { booking, business, professional, day } = await fixture();
    const item = await createBooking(booking);
    const availability = { week: null, blocks: [{ startsAt: atBusinessTime(day, "10:30").toISOString(), endsAt: atBusinessTime(day, "12:00").toISOString(), reason: "Pausa" }] };
    await expect(saveProfessionalAvailability(business.id, professional.id, 0, availability)).rejects.toMatchObject({ status: 409 });
    expect((await prisma.professional.findUniqueOrThrow({ where: { id: professional.id } })).availabilityVersion).toBe(0);
    await changeBooking(business.id, { id: item.id, status: "CANCELLED" });
    await saveProfessionalAvailability(business.id, professional.id, 0, availability);
  });

  it("serializa bloqueio concorrente com reserva sem deixar conflito persistido", async () => {
    const { booking, business, professional, day } = await fixture();
    const results = await Promise.allSettled([
      createBooking(booking),
      saveProfessionalAvailability(business.id, professional.id, 0, { week: null, blocks: [{ startsAt: atBusinessTime(day, "10:00").toISOString(), endsAt: atBusinessTime(day, "12:00").toISOString(), reason: "Ausência" }] }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.status).toBe(409);
  });

  it("não perde alterações quando duas pessoas editam a mesma versão", async () => {
    const { business, professional } = await fixture();
    const results = await Promise.allSettled([
      saveProfessionalAvailability(business.id, professional.id, 0, { week: null, blocks: [] }),
      saveProfessionalAvailability(business.id, professional.id, 0, { week: Array.from({ length: 7 }, () => []), blocks: [] }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.professional.findUniqueOrThrow({ where: { id: professional.id } })).availabilityVersion).toBe(1);
  });

  it("protege jornadas por autenticação, papel e estabelecimento", async () => {
    const first = await fixture();
    const second = await fixture("segundo");
    const payload = { professionalId: second.professional.id, version: 0, availability: { week: null, blocks: [] } };
    auth.context = null;
    expect((await availabilityPatch(jsonRequest("/api/professional-availability", "PATCH", payload))).status).toBe(401);
    auth.context = { business: first.business, role: "EMPLOYEE", membershipId: "employee" };
    expect((await availabilityPatch(jsonRequest("/api/professional-availability", "PATCH", payload))).status).toBe(403);
    auth.context.role = "OWNER";
    expect((await availabilityPatch(jsonRequest("/api/professional-availability", "PATCH", payload))).status).toBe(404);
    expect((await availabilityPatch(jsonRequest("/api/professional-availability", "PATCH", { ...payload, professionalId: first.professional.id }))).status).toBe(200);
    expect((await prisma.professional.findUniqueOrThrow({ where: { id: second.professional.id } })).availabilityVersion).toBe(0);
  });

  it("rejeita horários inválidos, sobrepostos, bloqueios invertidos e JSON malformado", async () => {
    await fixture();
    const week = Array.from({ length: 7 }, () => [{ open: "10:00", close: "12:00" }, { open: "11:00", close: "13:00" }]);
    expect(professionalAvailabilitySchema.safeParse({ week, blocks: [] }).success).toBe(false);
    expect(professionalAvailabilitySchema.safeParse({ week: null, blocks: [{ startsAt: "2026-10-10T12:00:00Z", endsAt: "2026-10-10T11:00:00Z", reason: "Pausa" }] }).success).toBe(false);
    expect((await availabilityPatch(new Request("http://localhost/api/professional-availability", { method: "PATCH", body: "{" }))).status).toBe(400);
  });
});


describe("operação e proteção pública", () => {
  it("histórico é autenticado, isolado e contém criação e alterações", async () => {
    const first = await fixture();
    const item = await createBooking(first.booking);
    await changeBooking(first.business.id, { id: item.id, status: "CANCELLED" });
    const params = { params: Promise.resolve({ id: item.id }) };
    const request = new Request(`http://localhost/api/appointments/${item.id}/history`);
    const result = await historyGet(request, params);
    expect(result.status).toBe(200);
    const { events } = await result.json();
    expect(events).toHaveLength(2);
    expect(events.map((event: { action: string }) => event.action)).toContain("STATUS_CHANGED");
    await fixture("other-history");
    expect((await historyGet(request, params)).status).toBe(404);
    auth.context = null;
    expect((await historyGet(request, params)).status).toBe(401);
  });

  it("recusa reduzir jornada geral ou aumentar intervalo sobre reservas existentes", async () => {
    const { business, booking, day, settings } = await fixture();
    await createBooking(booking);
    await createBooking({ ...booking, startsAt: atBusinessTime(day, "11:00") });
    const data = { name: business.name, phone: "47999990000", address: "Rua Central, 10", city: "Itajaí", bookingSettings: { ...settings, bufferMin: 15 } };
    expect((await settingsPatch(jsonRequest("/api/settings", "PATCH", data))).status).toBe(409);
    data.bookingSettings = { ...settings, days: settings.days.map((day) => ({ ...day, close: "10:30" })) };
    expect((await settingsPatch(jsonRequest("/api/settings", "PATCH", data))).status).toBe(409);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: business.id } })).bookingSettings).toEqual(settings);
  });

  it("limita reservas por telefone e informa prazo para nova tentativa", async () => {
    const { business, booking, day } = await fixture();
    const params = { params: Promise.resolve({ slug: business.slug }) };
    for (let hour = 10; hour < 14; hour++) {
      const response = await POST(jsonRequest("/api/public/teste/appointments", "POST", { professionalId: booking.professionalId, serviceId: booking.serviceId, startsAt: atBusinessTime(day, `${hour}:00`).toISOString(), clientName: "Cliente Público", clientPhone: "47999991234" }), params);
      expect(response.status).toBe(hour < 13 ? 201 : 429);
      if (hour === 13) expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    }
    expect(await prisma.appointment.count()).toBe(3);
  });
});


describe("expiração de solicitações públicas", () => {
  it("libera horários expirados, impede confirmação e registra somente um evento", async () => {
    const { booking, business, professional, service, day } = await fixture();
    const item = await createBooking({ ...booking, source: "PUBLIC_BOOKING" });
    expect(item.pendingExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 86400_000);
    await prisma.appointment.update({ where: { id: item.id }, data: { pendingExpiresAt: new Date(Date.now() - 1000) } });
    expect(await availableSlots(business.id, professional.id, service.id, day)).toContain(booking.startsAt.toISOString());
    await expect(changeBooking(business.id, { id: item.id, status: "CONFIRMED" })).rejects.toMatchObject({ status: 409 });
    await Promise.all([refreshPendingBookings(business.id), refreshPendingBookings(business.id)]);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("CANCELLED");
    expect(await prisma.appointmentEvent.count({ where: { appointmentId: item.id, action: "EXPIRED" } })).toBe(1);
    await createBooking(booking);
  });

  it("confirmação remove expiração e reagendamento não estende prazo", async () => {
    const { booking, business, day } = await fixture();
    const item = await createBooking({ ...booking, source: "PUBLIC_BOOKING" });
    const moved = await changeBooking(business.id, { id: item.id, startsAt: atBusinessTime(addDateDays(day, 1), "10:00") });
    expect(moved.pendingExpiresAt).toEqual(item.pendingExpiresAt);
    const confirmed = await changeBooking(business.id, { id: item.id, status: "CONFIRMED" });
    expect(confirmed.pendingExpiresAt).toBeNull();
    await expect(changeBooking(business.id, { id: item.id, status: "PENDING" })).rejects.toMatchObject({ status: 400 });
  });

  it("limita pendências mesmo fora da rota pública e sob concorrência", async () => {
    const { booking, day } = await fixture();
    const results = await Promise.allSettled([10, 11, 12, 13].map((hour) => createBooking({ ...booking, source: "PUBLIC_BOOKING", startsAt: atBusinessTime(day, `${hour}:00`) })));
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(3);
    expect(await prisma.appointment.count({ where: { status: "PENDING" } })).toBe(3);
  });
});

describe("cadastros operacionais e valores históricos", () => {
  it("preserva preço, nome e duração ao editar catálogo e reagendar", async () => {
    const { booking, service, business, professional, day } = await fixture();
    const item = await createBooking(booking);
    const { saveCatalog } = await import("@/lib/catalog-service");
    await saveCatalog(business.id, { type: "service", name: "Corte premium", durationMin: 120, priceCents: 16000, active: true, professionalIds: [professional.id] }, { id: service.id, version: 0 });
    await expect(createBooking({ ...booking, startsAt: atBusinessTime(day, "15:00"), serviceVersion: 0 })).rejects.toMatchObject({ status: 409 });
    const moved = await changeBooking(business.id, { id: item.id, startsAt: atBusinessTime(day, "13:00") });
    expect(moved).toMatchObject({ serviceName: "Corte", priceCents: 8500, durationMin: 60, priceEstimated: false });
    expect(moved.endsAt.getTime() - moved.startsAt.getTime()).toBe(3600_000);
    const fresh = await createBooking({ ...booking, startsAt: atBusinessTime(day, "15:00") });
    expect(fresh).toMatchObject({ serviceName: "Corte premium", priceCents: 16000, durationMin: 120 });
  });

  it("impede inativação e remoção de vínculos com reservas abertas, preservando histórico", async () => {
    const { booking, business, professional, service } = await fixture();
    const { saveCatalog } = await import("@/lib/catalog-service");
    const item = await createBooking(booking);
    const other = await prisma.professional.create({ data: { businessId: business.id, name: "Bia", role: "Cabeleireira" } });
    const proData = { type: "professional" as const, name: professional.name, role: professional.role, color: professional.color, active: false };
    const serviceData = { type: "service" as const, name: service.name, durationMin: 60, priceCents: 8500, active: true, professionalIds: [other.id] };
    await expect(saveCatalog(business.id, proData, { id: professional.id, version: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(saveCatalog(business.id, serviceData, { id: service.id, version: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(saveCatalog(business.id, { ...serviceData, active: false, professionalIds: [professional.id] }, { id: service.id, version: 0 })).rejects.toMatchObject({ status: 409 });
    await changeBooking(business.id, { id: item.id, status: "CANCELLED" });
    await saveCatalog(business.id, proData, { id: professional.id, version: 0 });
    await expect(createBooking(booking)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.appointment.count()).toBe(1);
    await saveCatalog(business.id, serviceData, { id: service.id, version: 0 });
    await createBooking({ ...booking, professionalId: other.id });
  });

  it("serializa reserva e inativação concorrentes", async () => {
    const { booking, business, professional } = await fixture();
    const { saveCatalog } = await import("@/lib/catalog-service");
    const results = await Promise.allSettled([
      createBooking(booking),
      saveCatalog(business.id, { type: "professional", name: professional.name, role: professional.role, color: professional.color, active: false }, { id: professional.id, version: 0 }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("protege catálogo por papel, empresa e versão e aceita múltiplos profissionais", async () => {
    const first = await fixture();
    const other = await fixture("other-catalog");
    const { PATCH, POST } = await import("@/app/api/catalog/route");
    const data = { type: "service", id: first.service.id, version: 0, name: "Novo nome", durationMin: 45, priceCents: 5000, active: true, professionalIds: [first.professional.id] };
    expect((await PATCH(jsonRequest("/api/catalog", "PATCH", data))).status).toBe(404);
    auth.context = { business: first.business, role: "EMPLOYEE", membershipId: "employee" };
    expect((await PATCH(jsonRequest("/api/catalog", "PATCH", data))).status).toBe(403);
    auth.context.role = "OWNER";
    expect((await POST(jsonRequest("/api/catalog", "POST", { ...data, professionalIds: [other.professional.id] }))).status).toBe(404);
    const pro = await prisma.professional.create({ data: { businessId: first.business.id, name: "Bia", role: "Manicure" } });
    expect((await PATCH(jsonRequest("/api/catalog", "PATCH", { ...data, professionalIds: [first.professional.id, pro.id] }))).status).toBe(200);
    expect(await prisma.professionalService.count({ where: { serviceId: first.service.id } })).toBe(2);
    expect((await PATCH(jsonRequest("/api/catalog", "PATCH", data))).status).toBe(409);
    expect((await POST(new Request("http://localhost/api/catalog", { method: "POST", body: "{" }))).status).toBe(400);
  });

  it("edita e inativa clientes sem apagar histórico, com isolamento e duplicidade", async () => {
    const first = await fixture();
    const { PATCH } = await import("@/app/api/clients/route");
    const data = { id: first.client.id, version: 0, name: "Nome corrigido", phone: "+55 (47) 99999-1234", active: false };
    const item = await createBooking(first.booking);
    expect((await PATCH(jsonRequest("/api/clients", "PATCH", data))).status).toBe(409);
    await changeBooking(first.business.id, { id: item.id, status: "CANCELLED" });
    expect((await PATCH(jsonRequest("/api/clients", "PATCH", data))).status).toBe(200);
    expect((await PATCH(jsonRequest("/api/clients", "PATCH", data))).status).toBe(409);
    await expect(createBooking(first.booking)).rejects.toMatchObject({ status: 400 });
    await expect(createBooking({ ...first.booking, clientId: undefined, clientName: "Outro nome", clientPhone: first.client.phone, source: "PUBLIC_BOOKING" })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.appointment.count()).toBe(1);
    await fixture("other-clients");
    expect((await PATCH(jsonRequest("/api/clients", "PATCH", { ...data, version: 1 }))).status).toBe(404);
    auth.context = { business: first.business, role: "OWNER", membershipId: "owner" };
    await prisma.client.create({ data: { businessId: first.business.id, name: "Outro cliente", phone: "47988881234" } });
    expect((await PATCH(jsonRequest("/api/clients", "PATCH", { ...data, version: 1, phone: "47988881234" }))).status).toBe(409);
    expect((await PATCH(jsonRequest("/api/clients", "PATCH", { ...data, version: 1, active: true }))).status).toBe(200);
    await createBooking(first.booking);
  });
});

describe("dados de contato do cliente", () => {
  it("exporta somente dados da empresa e restringe ao proprietário", async () => {
    const first = await fixture();
    await createBooking(first.booking);
    const { GET } = await import("@/app/api/clients/[id]/data/route");
    const request = new Request("http://localhost/api/clients/data");
    const params = { params: Promise.resolve({ id: first.client.id }) };
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const payload = await response.json();
    expect(payload.client.phone).toBe(first.client.phone);
    expect(payload.client.appointments).toHaveLength(1);
    expect(payload.client.appointments[0].priceCents).toBe(8500);
    expect(payload.client.businessId).toBeUndefined();
    auth.context!.role = "EMPLOYEE";
    expect((await GET(request, params)).status).toBe(403);
    await fixture("other-export");
    expect((await GET(request, params)).status).toBe(404);
    auth.context = null;
    expect((await GET(request, params)).status).toBe(401);
  });

  it("remove contato e notas sem apagar serviços e recusa reservas abertas", async () => {
    const { client, booking, business } = await fixture();
    const item = await createBooking({ ...booking, notes: "Observação pessoal" });
    const { DELETE } = await import("@/app/api/clients/[id]/data/route");
    const params = { params: Promise.resolve({ id: client.id }) };
    const request = () => jsonRequest("/api/clients/data", "DELETE", { confirmation: "REMOVER CONTATO", version: 0 });
    expect((await DELETE(request(), params)).status).toBe(409);
    await changeBooking(business.id, { id: item.id, status: "CANCELLED" });
    auth.context!.role = "EMPLOYEE";
    expect((await DELETE(request(), params)).status).toBe(403);
    auth.context!.role = "OWNER";
    expect((await DELETE(jsonRequest("/api/clients/data", "DELETE", { version: 0 }), params)).status).toBe(400);
    expect((await DELETE(request(), params)).status).toBe(200);
    expect(await prisma.client.findUnique({ where: { id: client.id } })).toMatchObject({ name: "Contato removido", phone: `removed-${client.id}`, notes: null, active: false, version: 1 });
    expect(await prisma.appointment.findUnique({ where: { id: item.id } })).toMatchObject({ serviceName: "Corte", priceCents: 8500, notes: null, status: "CANCELLED" });
    expect((await DELETE(request(), params)).status).toBe(409);
    await fixture("other-removal");
    expect((await DELETE(request(), params)).status).toBe(404);
  });
});
