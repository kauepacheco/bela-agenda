import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

type Migration = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export async function migrationsMatchRelease(applied: Migration[], directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const expected = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({
    name: entry.name,
    checksum: createHash("sha256").update(await readFile(path.join(directory, entry.name, "migration.sql"))).digest("hex"),
  })));
  if (expected.length === 0) return false;
  const active = applied.filter((migration) => !migration.rolled_back_at);
  return active.length === expected.length && expected.every((migration) => active.some((row) =>
    row.migration_name === migration.name && row.finished_at !== null && row.checksum === migration.checksum,
  ));
}
