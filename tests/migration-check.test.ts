import path from "node:path";
import { afterAll, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { migrationsMatchRelease } from "../scripts/migration-check";

const directory = path.resolve(__dirname, "../prisma/migrations");
afterAll(() => prisma.$disconnect());

it("confere as migrações reais e recusa versões ausentes, alteradas, incompletas ou desconhecidas", async () => {
  const rows = await prisma.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;
  expect(await migrationsMatchRelease(rows, directory)).toBe(true);
  expect(await migrationsMatchRelease(rows.slice(0, -1), directory)).toBe(false);
  expect(await migrationsMatchRelease([], directory)).toBe(false);
  for (const change of [{ checksum: "modified" }, { finished_at: null }, { rolled_back_at: new Date() }, { migration_name: "unknown" }]) {
    expect(await migrationsMatchRelease([{ ...rows[0], ...change }, ...rows.slice(1)], directory)).toBe(false);
  }
  expect(await migrationsMatchRelease([...rows, { ...rows[0], migration_name: "future_migration" }], directory)).toBe(false);
  expect(await migrationsMatchRelease([...rows, { ...rows[0], finished_at: null, rolled_back_at: new Date() }], directory)).toBe(true);
});
