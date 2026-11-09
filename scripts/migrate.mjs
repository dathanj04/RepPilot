import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const pooled = process.env.DATABASE_URL?.trim() ?? "";
const direct = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DIRECT_URL?.trim() || pooled;

if (!direct) {
  console.log("migrate: DATABASE_URL is not set, skipping");
  process.exit(0);
}

function redact(text) {
  return String(text).replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://redacted");
}

function localHost(connectionString) {
  return /@(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
}

function pgConfig(connectionString) {
  if (localHost(connectionString) || /[?&]sslmode=/i.test(connectionString)) return { connectionString };
  return { connectionString, ssl: { rejectUnauthorized: true } };
}

function run(command, args, env) {
  const result = spawnSync(command, args, { env, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output) console.log(redact(output));
  return result.status === 0;
}

const prismaEnv = { ...process.env, DATABASE_URL: direct, DIRECT_URL: direct };
const migrated = run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], prismaEnv);
if (!migrated) {
  console.error("migrate: database setup did not finish. The server will try again on startup.");
  process.exit(0);
}

const password = process.env.SEED_PASSWORD?.trim() ?? "";
const tokenKey = process.env.TOKEN_ENCRYPTION_KEY?.trim() ?? "";
if (password.length < 12 || !tokenKey) {
  console.log("bootstrap: skipped, reviewer seed is not fully configured");
  process.exit(0);
}

const client = new pg.Client({ ...pgConfig(direct), connectionTimeoutMillis: 15000 });
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
  console.error("bootstrap: could not read whether accounts exist. The server will try again on startup.");
  process.exit(0);
}

const seeded = run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
  ...prismaEnv,
  BOOTSTRAP_EMPTY_DATABASE: "true",
});
if (!seeded) console.error("bootstrap: reviewer accounts were not created. The server will try again on startup.");
process.exit(0);
