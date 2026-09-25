import { prisma } from "../src/lib/prisma";

async function main() {
  const checks: { check: string; ok: boolean }[] = [];
  let https = false;
  try { const url = new URL(process.env.APP_URL ?? ""); https = url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname); } catch {}
  checks.push({ check: "app_url_https", ok: https });
  checks.push({ check: "email_credentials_present", ok: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes("seudominio")) });
  checks.push({ check: "trusted_ingress_header_configured", ok: Boolean(process.env.TRUSTED_CLIENT_IP_HEADER) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ check: "database_connection", ok: true });
    const pending = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
    checks.push({ check: "no_failed_migrations", ok: pending[0].count === 0 });
    checks.push({ check: "no_demo_account", ok: !await prisma.user.findUnique({ where: { email: "demo@belaagenda.com.br" }, select: { id: true } }) });
  } catch { checks.push({ check: "database_schema", ok: false }); }
  console.log(JSON.stringify({ event: "preflight", checks, note: "Não comprova entrega de email, confiança do proxy, backup externo, documentos legais ou integrações comerciais." }));
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}
main().catch(() => { console.error(JSON.stringify({ event: "preflight_failed" })); process.exitCode = 1; }).finally(() => prisma.$disconnect());
