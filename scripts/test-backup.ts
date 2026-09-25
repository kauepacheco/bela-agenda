import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import setupDatabase from "../tests/global-setup";

async function main() {
  const stop = await setupDatabase();
  const directory = await mkdtemp(path.join(tmpdir(), "bela-backup-test-"));
  const source = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const targetUrl = new URL(process.env.DATABASE_URL!);
  targetUrl.pathname = "/bela_restore_test";
  const target = new PrismaClient({ datasources: { db: { url: targetUrl.toString() } } });
  const backup = path.join(directory, "test.dump");
  const env = { ...process.env, RESTORE_DATABASE_URL: targetUrl.toString(), RESTORE_CONFIRM: "isolated-empty-database" };
  try {
    execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...env, NODE_ENV: "test" }, stdio: "pipe" });
    await source.$executeRawUnsafe('CREATE DATABASE "bela_restore_test"');
    execFileSync(process.execPath, ["scripts/backup.mjs", backup], { env, stdio: "pipe" });
    const checksum = await readFile(`${backup}.sha256`, "utf8");
    await writeFile(`${backup}.sha256`, "invalid");
    assert.equal(spawnSync(process.execPath, ["scripts/restore-check.mjs", backup], { env }).status, 1, "reject corrupt backup");
    await writeFile(`${backup}.sha256`, checksum);
    execFileSync(process.execPath, ["scripts/restore-check.mjs", backup], { env, stdio: "pipe" });
    assert.equal(await source.appointment.count(), await target.appointment.count());
    assert.deepEqual(await source.appointment.findMany({ orderBy: { id: "asc" } }), await target.appointment.findMany({ orderBy: { id: "asc" } }));
    assert.deepEqual(await source.business.findMany(), await target.business.findMany());
    assert.equal(await target.membership.count(), 1);
    assert.equal(spawnSync(process.execPath, ["scripts/restore-check.mjs", backup], { env }).status, 1, "reject nonempty target");
    assert.equal(spawnSync(process.execPath, ["scripts/backup.mjs", backup], { env }).status, 1, "never overwrite existing backup");
    assert.equal(await readFile(`${backup}.sha256`, "utf8"), checksum);
    assert.equal(await target.appointment.count(), 5);
    console.log("Backup e restauração aprovados: integridade dos dados, checksum, destino ocupado e arquivo existente.");
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Falha no teste isolado de backup."); process.exitCode = 1; });
