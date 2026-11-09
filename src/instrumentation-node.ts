import { spawn } from "node:child_process";

export function migrateOnStart() {
  if (!process.env.DATABASE_URL?.trim()) return;
  const child = spawn(process.execPath, ["scripts/migrate.mjs"], {
    stdio: "ignore",
    env: { ...process.env, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "15" },
  });
  child.unref();
  child.on("error", () => undefined);
}
