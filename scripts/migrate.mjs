import pg from "pg";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim() ?? "";
if (!url) {
  console.log("migrate: DATABASE_URL is not set, skipping");
  process.exit(0);
}

const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const password = process.env.SEED_PASSWORD?.trim() ?? "";
if (password.length < 12) {
  console.log("bootstrap: skipped, reviewer seed password is not configured");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const count = await client.query('select count(*)::int as count from "User"');
  const existing = count.rows[0]?.count ?? 0;
  await client.end();
  if (existing > 0) {
    console.log("bootstrap: skipped, accounts already exist");
    process.exit(0);
  }
} catch {
  try { await client.end(); } catch { /* already closed */ }
  console.error("bootstrap: could not read whether accounts exist");
  process.exit(1);
}

const seed = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: { ...process.env, BOOTSTRAP_EMPTY_DATABASE: "true" },
});
process.exit(seed.status ?? 1);
