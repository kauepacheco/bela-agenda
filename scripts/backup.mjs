import { execFileSync } from "node:child_process";
import { mkdir, open, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { connectionUrl, digest, pgEnvironment } from "./backup-common.mjs";

process.umask(0o077);
let file;
let owned = false;
try {
  const database = connectionUrl(process.env.DATABASE_URL);
  file = path.resolve(process.argv[2] ?? `backups/santa-agenda-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await (await open(file, "wx", 0o600)).close();
  owned = true;
  execFileSync(process.env.PG_DUMP_BIN ?? "pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", file], {
    env: pgEnvironment(database), stdio: "pipe", timeout: 600_000,
  });
  await writeFile(`${file}.sha256`, `${await digest(file)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ event: "backup_completed", file: path.basename(file), at: new Date().toISOString() }));
} catch {
  if (owned) await unlink(file).catch(() => {});
  console.error(JSON.stringify({ event: "backup_failed", message: "Confira conexão, permissões, espaço e versão de pg_dump. O destino deve ser um arquivo novo." }));
  process.exitCode = 1;
}
