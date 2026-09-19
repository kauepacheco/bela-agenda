"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteCurrentSession, requireAuthContext } from "@/lib/auth";
import { sendTeamInvitationEmail } from "@/lib/email";
import {
  acceptMemberInvitation,
  cancelMemberInvitation,
  createMemberInvitation,
  discardMemberInvitation,
  removeMember,
  TeamServiceError,
} from "@/lib/team-service";

export type TeamActionState = { error?: string; success?: string } | undefined;

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.");
const passwordSchema = z.string()
  .min(8, "A senha deve ter ao menos 8 caracteres.")
  .regex(/[A-Za-z]/, "Inclua uma letra na senha.")
  .regex(/[0-9]/, "Inclua um número na senha.");

function teamError(error: unknown) {
  if (!(error instanceof TeamServiceError)) return "Não foi possível concluir esta operação.";
  switch (error.code) {
    case "FORBIDDEN": return "Somente proprietários podem gerenciar membros.";
    case "ALREADY_MEMBER": return "Este e-mail já faz parte do estabelecimento.";
    case "LAST_OWNER": return "O estabelecimento precisa manter ao menos um proprietário ativo.";
    case "NOT_FOUND": return "Este membro ou convite não está mais disponível.";
    case "INVALID_CREDENTIALS": return "A senha informada está incorreta.";
    case "INVALID_NAME": return "Informe seu nome.";
    default: return "Este convite é inválido, expirou ou já foi utilizado.";
  }
}

export async function inviteMemberAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const context = await requireAuthContext();
  const parsed = z.object({
    email: emailSchema,
    role: z.enum(["OWNER", "EMPLOYEE"]),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados." };

  let invitation: Awaited<ReturnType<typeof createMemberInvitation>>;
  try {
    invitation = await createMemberInvitation({
      actorMembershipId: context.membershipId,
      email: parsed.data.email,
      role: parsed.data.role,
    });
  } catch (error) {
    return { error: teamError(error) };
  }

  try {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const invitationUrl = new URL("/aceitar-convite", appUrl);
    invitationUrl.searchParams.set("token", invitation.token);
    await sendTeamInvitationEmail({
      to: invitation.email,
      invitationUrl: invitationUrl.toString(),
      businessName: invitation.businessName,
      role: invitation.role,
    });
  } catch (error) {
    await discardMemberInvitation(invitation.token);
    console.error("Falha ao enviar convite de membro.", error);
    return { error: "Não foi possível enviar o convite. Tente novamente." };
  }

  revalidatePath("/equipe");
  return { success: `Convite enviado para ${invitation.email}.` };
}

export async function removeMemberAction(membershipId: string): Promise<TeamActionState> {
  const context = await requireAuthContext();
  const parsed = z.string().cuid().safeParse(membershipId);
  if (!parsed.success) return { error: "Membro inválido." };
  try {
    await removeMember(context.membershipId, parsed.data);
  } catch (error) {
    return { error: teamError(error) };
  }
  if (parsed.data === context.membershipId) {
    await deleteCurrentSession();
    redirect("/entrar");
  }
  revalidatePath("/equipe");
  return { success: "Acesso do membro removido." };
}

export async function cancelInvitationAction(invitationId: string): Promise<TeamActionState> {
  const context = await requireAuthContext();
  const parsed = z.string().cuid().safeParse(invitationId);
  if (!parsed.success) return { error: "Convite inválido." };
  try {
    await cancelMemberInvitation(context.membershipId, parsed.data);
  } catch (error) {
    return { error: teamError(error) };
  }
  revalidatePath("/equipe");
  return { success: "Convite cancelado." };
}

export async function acceptInvitationAction(
  _state: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const parsed = z.object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    name: z.string().trim().optional(),
    existingUser: z.enum(["true", "false"]),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados." };
  if (parsed.data.password !== parsed.data.passwordConfirmation) {
    return { error: "As senhas não coincidem." };
  }

  let membership;
  try {
    membership = await acceptMemberInvitation(parsed.data);
  } catch (error) {
    return { error: teamError(error) };
  }
  await createSession(membership.id);
  redirect("/");
}
