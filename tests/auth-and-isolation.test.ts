import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ business: null as null | { id: string } }));

vi.mock("@/lib/auth", () => ({
  getCurrentContext: async () => authState.business ? { business: authState.business } : null,
}));

import { GET as getAppointments, PATCH as patchAppointment, POST as postAppointment } from "@/app/api/appointments/route";
import {
  authenticateCredentials,
  createAccount,
  createPasswordResetToken,
  createSessionRecord,
  getSessionContextFromToken,
  hashPasswordResetToken,
  isPasswordResetTokenValid,
  resetPasswordWithToken,
} from "@/lib/auth-service";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

beforeEach(async () => {
  authState.business = null;
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Appointment", "ProfessionalService", "Session", "Client", "Service",
      "Professional", "Membership", "User", "Business" CASCADE
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function account(index: number) {
  return createAccount({
    name: `Proprietária ${index}`,
    businessName: `Salão ${index}`,
    email: `dona${index}@example.com`,
    password: `SenhaSegura${index}`,
  });
}

describe("autenticação", () => {
  it("cadastra usuário, empresa e vínculo proprietário em uma transação", async () => {
    const membership = await account(1);

    expect(membership.role).toBe("OWNER");
    expect(membership.business.slug).toBe("salao-1");
    expect(membership.user.email).toBe("dona1@example.com");
    expect(membership.user.passwordHash).not.toContain("SenhaSegura1");
    await expect(verifyPassword("SenhaSegura1", membership.user.passwordHash)).resolves.toBe(true);
  });

  it("autentica apenas credenciais válidas de um vínculo ativo", async () => {
    const membership = await account(1);

    await expect(authenticateCredentials("dona1@example.com", "SenhaSegura1"))
      .resolves.toMatchObject({ id: membership.id, businessId: membership.businessId });
    await expect(authenticateCredentials("dona1@example.com", "senha-incorreta")).resolves.toBeNull();

    await prisma.membership.update({ where: { id: membership.id }, data: { active: false } });
    await expect(authenticateCredentials("dona1@example.com", "SenhaSegura1")).resolves.toBeNull();
  });

  it("recusa uma sessão no instante em que ela expira", async () => {
    const membership = await account(1);
    const now = new Date("2026-09-18T12:00:00.000Z");
    const { token, expiresAt } = await createSessionRecord(membership.id, { now, durationMs: 1_000 });

    await expect(getSessionContextFromToken(token, new Date(expiresAt.getTime() - 1)))
      .resolves.toMatchObject({ membershipId: membership.id, business: { id: membership.businessId } });
    await expect(getSessionContextFromToken(token, expiresAt)).resolves.toBeNull();
  });

  it("redefine a senha uma única vez e revoga as sessões existentes", async () => {
    const membership = await account(1);
    const session = await createSessionRecord(membership.id);
    const reset = await createPasswordResetToken("DONA1@EXAMPLE.COM");

    expect(reset).not.toBeNull();
    const storedToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashPasswordResetToken(reset!.token) },
    });
    expect(storedToken?.tokenHash).not.toBe(reset!.token);
    await expect(isPasswordResetTokenValid(reset!.token)).resolves.toBe(true);
    await expect(resetPasswordWithToken(reset!.token, "NovaSenha123")).resolves.toBe(true);
    await expect(resetPasswordWithToken(reset!.token, "OutraSenha456")).resolves.toBe(false);
    await expect(isPasswordResetTokenValid(reset!.token)).resolves.toBe(false);
    await expect(authenticateCredentials("dona1@example.com", "SenhaSegura1")).resolves.toBeNull();
    await expect(authenticateCredentials("dona1@example.com", "NovaSenha123"))
      .resolves.toMatchObject({ id: membership.id });
    await expect(getSessionContextFromToken(session.token)).resolves.toBeNull();
  });

  it("recusa token expirado e invalida o anterior ao emitir outro", async () => {
    await account(1);
    const now = new Date("2026-09-18T12:00:00.000Z");
    const first = await createPasswordResetToken("dona1@example.com", { now, durationMs: 1_000 });
    const second = await createPasswordResetToken("dona1@example.com", { now, durationMs: 2_000 });

    await expect(isPasswordResetTokenValid(first!.token, now)).resolves.toBe(false);
    await expect(resetPasswordWithToken(second!.token, "NovaSenha123", new Date(now.getTime() + 2_000)))
      .resolves.toBe(false);
    await expect(authenticateCredentials("dona1@example.com", "SenhaSegura1"))
      .resolves.toBeTruthy();
  });

  it("não cria token para e-mail desconhecido", async () => {
    await expect(createPasswordResetToken("ninguem@example.com")).resolves.toBeNull();
    await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
  });
});

describe("isolamento entre empresas", () => {
  it("não lista nem altera agendamentos de outra empresa", async () => {
    const [first, second] = await Promise.all([account(1), account(2)]);
    const firstCatalog = await createCatalog(first.businessId, 1);
    const secondCatalog = await createCatalog(second.businessId, 2);
    const firstAppointment = await createAppointment(first.businessId, firstCatalog, 1);
    const secondAppointment = await createAppointment(second.businessId, secondCatalog, 2);
    authState.business = { id: first.businessId };

    const listResponse = await getAppointments(new Request(
      "http://localhost/api/appointments?start=2026-09-01T00:00:00.000Z&end=2026-10-01T00:00:00.000Z",
    ));
    const listed = await listResponse.json();
    expect(listed.map((item: { id: string }) => item.id)).toEqual([firstAppointment.id]);

    const patchResponse = await patchAppointment(new Request("http://localhost/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({ id: secondAppointment.id, status: "CANCELLED" }),
    }));
    expect(patchResponse.status).toBe(404);
    await expect(prisma.appointment.findUnique({ where: { id: secondAppointment.id } }))
      .resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("rejeita referências de catálogo e cliente pertencentes a outra empresa", async () => {
    const [first, second] = await Promise.all([account(1), account(2)]);
    const firstCatalog = await createCatalog(first.businessId, 1);
    const secondCatalog = await createCatalog(second.businessId, 2);
    authState.business = { id: first.businessId };

    const foreignCatalogResponse = await postAppointment(new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: firstCatalog.client.id,
        professionalId: secondCatalog.professional.id,
        serviceId: secondCatalog.service.id,
        startsAt: "2026-09-20T15:00:00.000Z",
      }),
    }));
    const foreignClientResponse = await postAppointment(new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: secondCatalog.client.id,
        professionalId: firstCatalog.professional.id,
        serviceId: firstCatalog.service.id,
        startsAt: "2026-09-20T16:00:00.000Z",
      }),
    }));

    expect(foreignCatalogResponse.status).toBe(404);
    expect(foreignClientResponse.status).toBe(400);
    await expect(prisma.appointment.count({ where: { businessId: first.businessId } })).resolves.toBe(0);
  });
});

async function createCatalog(businessId: string, index: number) {
  const professional = await prisma.professional.create({
    data: { businessId, name: `Profissional ${index}`, role: "Cabeleireira" },
  });
  const service = await prisma.service.create({
    data: {
      businessId,
      name: `Serviço ${index}`,
      durationMin: 60,
      priceCents: 10_000,
      professionals: { create: { professionalId: professional.id } },
    },
  });
  const client = await prisma.client.create({
    data: { businessId, name: `Cliente ${index}`, phone: `4799999000${index}` },
  });
  return { professional, service, client };
}

async function createAppointment(
  businessId: string,
  catalog: Awaited<ReturnType<typeof createCatalog>>,
  day: number,
) {
  const startsAt = new Date(`2026-09-${20 + day}T15:00:00.000Z`);
  return prisma.appointment.create({
    data: {
      businessId,
      clientId: catalog.client.id,
      professionalId: catalog.professional.id,
      serviceId: catalog.service.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
    },
  });
}
