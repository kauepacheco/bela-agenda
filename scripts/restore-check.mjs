import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { connectionUrl, digest, pgEnvironment } from "./backup-common.mjs";

let prisma;
try {
  const file = path.resolve(process.argv[2] ?? "");
  const target = connectionUrl(process.env.RESTORE_DATABASE_URL);
  if (process.env.RESTORE_CONFIRM !== "isolated-empty-database" || !/^\/[a-zA-Z0-9_]+_restore_test$/.test(target.pathname)) throw new Error("Destino precisa ser um banco isolado com sufixo _restore_test.");
  if ((await readFile(`${file}.sha256`, "utf8")).trim() !== await digest(file)) throw new Error("Checksum inválido.");
  prisma = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  const [{ count }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`;
  if (count !== 0) throw new Error("O banco de destino precisa estar vazio.");
  // No --clean: never drop pre-existing objects. Restore is all-or-nothing.
  execFileSync(process.env.PG_RESTORE_BIN ?? "pg_restore", ["--dbname", target.pathname.slice(1), "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", file], {
    env: pgEnvironment(target),
    stdio: "pipe", timeout: 600_000,
  });
  const [businesses, appointments, migrations] = await Promise.all([prisma.business.count(), prisma.appointment.count(), prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`]);
  console.log(JSON.stringify({ event: "restore_check_completed", businesses, appointments, migrations: migrations[0].count, at: new Date().toISOString() }));
} catch {
  console.error(JSON.stringify({ event: "restore_check_failed", message: "Verifique checksum, banco vazio com sufixo _restore_test, confirmação e versão do pg_restore. Nenhum objeto existente é apagado." }));
  process.exitCode = 1;
} finally { await prisma?.$disconnect(); }
