import { spawn } from "node:child_process";

export function migrateOnStart() {
  if (!process.env.DATABASE_URL?.trim()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const child = spawn(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit" });
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}
