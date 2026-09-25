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
import { defaultBookingSettings } from "@/lib/booking-policy";
import { completeBusinessOnboarding } from "@/lib/onboarding-service";
import {
  acceptMemberInvitation,
  createMemberInvitation,
  getMemberInvitation,
  removeMember,
} from "@/lib/team-service";

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

describe("gestão de membros", () => {
  it("permite ao proprietário convidar e aceitar um novo funcionário uma única vez", async () => {
    const owner = await account(1);
    const invitation = await createMemberInvitation({
      actorMembershipId: owner.id,
      email: "FUNCIONARIA@EXAMPLE.COM",
      role: "EMPLOYEE",
    });

    expect(invitation.email).toBe("funcionaria@example.com");
    await expect(getMemberInvitation(invitation.token)).resolves.toMatchObject({
      businessName: "Salão 1",
      existingUser: false,
      role: "EMPLOYEE",
    });

    const membership = await acceptMemberInvitation({
      token: invitation.token,
      name: "Funcionária Um",
      password: "SenhaEquipe123",
    });
    expect(membership).toMatchObject({ businessId: owner.businessId, role: "EMPLOYEE", active: true });
    await expect(authenticateCredentials("funcionaria@example.com", "SenhaEquipe123"))
      .resolves.toMatchObject({ id: membership.id });
    await expect(acceptMemberInvitation({
      token: invitation.token,
      name: "Funcionária Um",
      password: "SenhaEquipe123",
    })).rejects.toMatchObject({ code: "INVALID_INVITATION" });
  });

  it("exige a senha ao convidar um usuário que já possui conta", async () => {
    const [owner, existingAccount] = await Promise.all([account(1), account(2)]);
    const invitation = await createMemberInvitation({
      actorMembershipId: owner.id,
      email: existingAccount.user.email,
      role: "EMPLOYEE",
    });

    await expect(acceptMemberInvitation({
      token: invitation.token,
      password: "senha-incorreta",
    })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const membership = await acceptMemberInvitation({
      token: invitation.token,
      password: "SenhaSegura2",
    });
    expect(membership.userId).toBe(existingAccount.userId);
    expect(membership.businessId).toBe(owner.businessId);
  });

  it("recusa convites expirados", async () => {
    const owner = await account(1);
    const now = new Date("2026-09-18T12:00:00.000Z");
    const invitation = await createMemberInvitation({
      actorMembershipId: owner.id,
      email: "funcionaria@example.com",
      role: "EMPLOYEE",
      now,
      durationMs: 1_000,
    });

    await expect(getMemberInvitation(invitation.token, new Date(now.getTime() + 1_000)))
      .resolves.toBeNull();
    await expect(acceptMemberInvitation({
      token: invitation.token,
      name: "Funcionária",
      password: "SenhaEquipe123",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toMatchObject({ code: "INVALID_INVITATION" });
  });

  it("impede funcionário de convidar ou remover membros", async () => {
    const owner = await account(1);
    const employeeUser = await prisma.user.create({
      data: { name: "Funcionária", email: "funcionaria@example.com", passwordHash: "irrelevante" },
    });
    const employee = await prisma.membership.create({
      data: { userId: employeeUser.id, businessId: owner.businessId, role: "EMPLOYEE" },
    });

    await expect(createMemberInvitation({
      actorMembershipId: employee.id,
      email: "outra@example.com",
      role: "EMPLOYEE",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeMember(employee.id, owner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserva o último proprietário ativo e revoga sessões de membros removidos", async () => {
    const owner = await account(1);
    await expect(removeMember(owner.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });

    const invitation = await createMemberInvitation({
      actorMembershipId: owner.id,
      email: "socia@example.com",
      role: "OWNER",
    });
    const secondOwner = await acceptMemberInvitation({
      token: invitation.token,
      name: "Sócia",
      password: "SenhaSociedade123",
    });
    const session = await createSessionRecord(secondOwner.id);

    await removeMember(owner.id, secondOwner.id);
    await expect(getSessionContextFromToken(session.token)).resolves.toBeNull();
    await expect(prisma.membership.findUnique({ where: { id: secondOwner.id } }))
      .resolves.toMatchObject({ active: false });
    await expect(removeMember(owner.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });
});

describe("onboarding do estabelecimento", () => {
  const onboardingCatalog = {
    professionals: [
      { key: "ana", name: "Ana Lima", role: "Cabeleireira", color: "#D97757" },
      { key: "bia", name: "Bia Souza", role: "Manicure", color: "#547568" },
    ],
    services: [
      {
        name: "Corte feminino",
        durationMin: 60,
        priceCents: 8_000,
        professionalKeys: ["ana"],
      },
      {
        name: "Hidratação",
        durationMin: 45,
        priceCents: 6_500,
        professionalKeys: ["ana", "bia"],
      },
    ],
  };

  it("conclui os dados essenciais e cria equipe e serviços vinculados", async () => {
    const owner = await account(1);
    expect(owner.business.onboardingCompletedAt).toBeNull();

    const completedAt = new Date("2026-09-18T15:00:00.000Z");
    const business = await completeBusinessOnboarding({
      bookingSettings: defaultBookingSettings,
      actorMembershipId: owner.id,
      name: "Salão Renovado",
      address: "Rua das Flores, 123",
      city: "Itajaí",
      phone: "(47) 99999-1234",
      ...onboardingCatalog,
      now: completedAt,
    });

    expect(business).toMatchObject({
      name: "Salão Renovado",
      address: "Rua das Flores, 123",
      city: "Itajaí",
      phone: "47999991234",
      onboardingCompletedAt: completedAt,
      bookingSettings: defaultBookingSettings,
    });
    await expect(prisma.professional.findMany({
      where: { businessId: owner.businessId },
      orderBy: { name: "asc" },
    })).resolves.toMatchObject([
      { name: "Ana Lima", role: "Cabeleireira", color: "#D97757" },
      { name: "Bia Souza", role: "Manicure", color: "#547568" },
    ]);
    const services = await prisma.service.findMany({
      where: { businessId: owner.businessId },
      include: { professionals: { include: { professional: true } } },
      orderBy: { name: "asc" },
    });
    expect(services).toHaveLength(2);
    expect(services.find((service) => service.name === "Hidratação")?.professionals
      .map(({ professional }) => professional.name).sort()).toEqual(["Ana Lima", "Bia Souza"]);
  });

  it("impede funcionário de concluir ou alterar o onboarding", async () => {
    const owner = await account(1);
    const employeeUser = await prisma.user.create({
      data: { name: "Funcionária", email: "equipe@example.com", passwordHash: "irrelevante" },
    });
    const employee = await prisma.membership.create({
      data: { userId: employeeUser.id, businessId: owner.businessId, role: "EMPLOYEE" },
    });

    await expect(completeBusinessOnboarding({
      bookingSettings: defaultBookingSettings,
      actorMembershipId: employee.id,
      name: "Nome indevido",
      address: "Rua indevida, 1",
      city: "Outra cidade",
      phone: "47999999999",
      ...onboardingCatalog,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(prisma.business.findUnique({ where: { id: owner.businessId } }))
      .resolves.toMatchObject({ name: "Salão 1", onboardingCompletedAt: null });
    await expect(prisma.professional.count({ where: { businessId: owner.businessId } })).resolves.toBe(0);
    await expect(prisma.service.count({ where: { businessId: owner.businessId } })).resolves.toBe(0);
  });

  it("mantém catálogos isolados por empresa e não duplica uma conclusão repetida", async () => {
    const [first, second] = await Promise.all([account(1), account(2)]);
    await Promise.all([
      completeBusinessOnboarding({
      bookingSettings: defaultBookingSettings,
        actorMembershipId: first.id,
        name: "Salão Primeiro",
        address: "Rua Um, 10",
        city: "Itajaí",
        phone: "47999990001",
        ...onboardingCatalog,
      }),
      completeBusinessOnboarding({
      bookingSettings: defaultBookingSettings,
        actorMembershipId: second.id,
        name: "Salão Segundo",
        address: "Rua Dois, 20",
        city: "Navegantes",
        phone: "47999990002",
        professionals: [{ key: "carol", name: "Carol", role: "Esteticista", color: "#786283" }],
        services: [{ name: "Limpeza de pele", durationMin: 90, priceCents: 12_000, professionalKeys: ["carol"] }],
      }),
    ]);

    await completeBusinessOnboarding({
      bookingSettings: defaultBookingSettings,
      actorMembershipId: first.id,
      name: "Nome que não deve substituir",
      address: "Outra rua, 30",
      city: "Outra cidade",
      phone: "47999990003",
      ...onboardingCatalog,
    });

    await expect(prisma.business.findUnique({ where: { id: first.businessId } }))
      .resolves.toMatchObject({ name: "Salão Primeiro" });
    await expect(prisma.professional.count({ where: { businessId: first.businessId } })).resolves.toBe(2);
    await expect(prisma.service.count({ where: { businessId: first.businessId } })).resolves.toBe(2);
    await expect(prisma.professional.findMany({ where: { businessId: second.businessId } }))
      .resolves.toMatchObject([{ name: "Carol" }]);
    await expect(prisma.service.findMany({ where: { businessId: second.businessId } }))
      .resolves.toMatchObject([{ name: "Limpeza de pele" }]);
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
      serviceName: catalog.service.name, priceCents: catalog.service.priceCents, durationMin: catalog.service.durationMin,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
    },
  });
}
