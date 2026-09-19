import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Não foi possível reservar uma porta para os testes.");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

export default async function setup() {
  const projectRoot = path.resolve(__dirname, "..");
  const databaseDir = await mkdtemp(path.join(tmpdir(), "bela-agenda-test-pg-"));
  const port = await availablePort();
  const nativeLibraryDir = path.join(
    projectRoot,
    "node_modules",
    "@embedded-postgres",
    `${process.platform}-${process.arch}`,
    "native",
    "lib",
  );
  process.env.LD_LIBRARY_PATH = [nativeLibraryDir, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(":");

  const postgres = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "postgres",
    password: "postgres",
    persistent: false,
    onLog: () => undefined,
  });

  await postgres.initialise();
  await postgres.start();

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?schema=public`;
  execFileSync(
    process.execPath,
    [path.join(projectRoot, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    { cwd: projectRoot, env: process.env, stdio: "pipe" },
  );

  return async () => {
    await postgres.stop();
  };
}
