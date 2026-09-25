import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import setupDatabase from "../tests/global-setup";

// Always creates a fresh PostgreSQL instance; never seeds the configured user DB.
const project = path.resolve(__dirname, "..");
async function main() {
  const stopDatabase = await setupDatabase();
  let server: ReturnType<typeof spawn> | undefined;
  let closing = false;
  async function close(code = 0) {
    if (closing) return;
    closing = true;
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => server!.once("exit", () => resolve()));
    }
    await stopDatabase();
    process.exitCode = code;
  }
  process.once("SIGTERM", () => void close());
  process.once("SIGINT", () => void close());
  try {
    execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { cwd: project, env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit" });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3107"], {
      cwd: project,
      env: { ...process.env, NODE_ENV: "production", APP_URL: "http://127.0.0.1:3107", RESEND_API_KEY: "", EMAIL_FROM: "", TRUSTED_CLIENT_IP_HEADER: "" },
      stdio: "inherit",
    });
    server.once("exit", (code) => { if (!closing) void close(code ?? 1); });
  } catch {
    console.error("Falha ao iniciar ambiente isolado de navegador.");
    await close(1);
  }
}
void main();
