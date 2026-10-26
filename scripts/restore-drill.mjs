import "dotenv/config";
import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import pg from "pg";

const source = process.env.DATABASE_URL;
if (!source) {
  console.error("DATABASE_URL is required. No database was changed.");
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(source);
if (!local && process.env.RESTORE_DRILL_ALLOW_REMOTE !== "true") {
  console.error("This drill restores a dump on the same Postgres server. It refuses a remote URL so a hosted production database is not overwritten. Use Neon point-in-time restore for Neon.");
  process.exit(1);
}

const drillName = "reppilot_restore_drill";
const adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
const drillUrl = new URL(source);
drillUrl.pathname = `/${drillName}`;
const dumpPath = "/tmp/reppilot-restore-drill.dump";

const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [drillName]);
await admin.query(`DROP DATABASE IF EXISTS "${drillName}"`);
await admin.query(`CREATE DATABASE "${drillName}"`);
await admin.end();

execFileSync("pg_dump", ["--format=custom", "--no-owner", "--file", dumpPath, source], { stdio: "inherit" });
execFileSync("pg_restore", ["--no-owner", "--dbname", drillUrl.toString(), dumpPath], { stdio: "inherit" });

async function count(connectionString, table) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const result = await client.query(`SELECT count(*)::int AS n FROM "${table}"`);
  await client.end();
  return result.rows[0].n;
}

let failed = false;
for (const table of ["Organization", "User", "Account", "_prisma_migrations"]) {
  const original = await count(source, table);
  const restored = await count(drillUrl.toString(), table);
  if (original !== restored) {
    console.error(`${table} mismatch: source ${original}, restored ${restored}`);
    failed = true;
  } else {
    console.log(`${table} matched (${original})`);
  }
}

const cleanup = new pg.Client({ connectionString: adminUrl.toString() });
await cleanup.connect();
await cleanup.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [drillName]);
await cleanup.query(`DROP DATABASE IF EXISTS "${drillName}"`);
await cleanup.end();
unlinkSync(dumpPath);

if (failed) process.exit(1);
console.log("Restore drill passed. The source database was left in place.");
