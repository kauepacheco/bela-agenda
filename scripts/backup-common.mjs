import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function connectionUrl(raw) {
  if (!raw) throw new Error("Conexão não configurada.");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Use PostgreSQL.");
  for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout", "connect_timeout"]) url.searchParams.delete(key);
  return url;
}
export async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export function pgEnvironment(url) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGHOSTADDR: undefined,
    PGSERVICE: undefined,
    PGCONNECT_TIMEOUT: "10",
    ...Object.fromEntries([["sslmode", "PGSSLMODE"], ["sslrootcert", "PGSSLROOTCERT"], ["sslcert", "PGSSLCERT"], ["sslkey", "PGSSLKEY"], ["options", "PGOPTIONS"]].map(([key, env]) => [env, url.searchParams.get(key) ?? undefined])),
  };
}
