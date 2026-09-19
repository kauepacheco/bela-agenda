import "server-only";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY e EMAIL_FROM são obrigatórios em produção.");
    }

    console.info(`[Bela Agenda] Link de recuperação para ${to}: ${resetUrl}`);
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
      to: [to],
      subject: "Redefina sua senha do Bela Agenda",
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
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`O Resend recusou o envio (${response.status}): ${detail.slice(0, 300)}`);
  }
}
