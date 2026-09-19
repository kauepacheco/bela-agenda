import "server-only";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

type TeamInvitationEmail = {
  to: string;
  invitationUrl: string;
  businessName: string;
  role: "OWNER" | "EMPLOYEE";
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);
}

async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  developmentLog: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY e EMAIL_FROM são obrigatórios em produção.");
    }
    console.info(input.developmentLog);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`O Resend recusou o envio (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmail) {
  await sendEmail({
    to,
    subject: "Redefina sua senha do Bela Agenda",
    developmentLog: `[Bela Agenda] Link de recuperação para ${to}: ${resetUrl}`,
    text: [
        "Recebemos uma solicitação para redefinir sua senha do Bela Agenda.",
        `Acesse o link a seguir em até 30 minutos: ${resetUrl}`,
        "Se você não fez esta solicitação, ignore esta mensagem.",
      ].join("\n\n"),
    html: `
        <p>Recebemos uma solicitação para redefinir sua senha do Bela Agenda.</p>
        <p><a href="${resetUrl}">Redefinir minha senha</a></p>
        <p>O link é válido por 30 minutos e só pode ser usado uma vez.</p>
        <p>Se você não fez esta solicitação, ignore esta mensagem.</p>
      `,
  });
}

export async function sendTeamInvitationEmail({
  to,
  invitationUrl,
  businessName,
  role,
}: TeamInvitationEmail) {
  const roleName = role === "OWNER" ? "proprietário" : "funcionário";
  const safeBusinessName = escapeHtml(businessName);
  const safeInvitationUrl = escapeHtml(invitationUrl);
  await sendEmail({
    to,
    subject: `Convite para participar de ${businessName} no Bela Agenda`,
    developmentLog: `[Bela Agenda] Convite para ${to}: ${invitationUrl}`,
    text: [
      `Você foi convidado para participar de ${businessName} como ${roleName}.`,
      `Aceite o convite em até 7 dias: ${invitationUrl}`,
      "Se você não esperava este convite, ignore esta mensagem.",
    ].join("\n\n"),
    html: `
      <p>Você foi convidado para participar de <strong>${safeBusinessName}</strong> como ${roleName}.</p>
      <p><a href="${safeInvitationUrl}">Aceitar convite</a></p>
      <p>O link é válido por 7 dias e só pode ser usado uma vez.</p>
      <p>Se você não esperava este convite, ignore esta mensagem.</p>
    `,
  });
}
