import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: process.env.VERCEL ? 1 : 10,
    ssl: local ? undefined : { rejectUnauthorized: true },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// The client connects on the first query. Importing this module during a build
// does not require DATABASE_URL.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

export function createPrisma(connectionString: string) {
  return createClient(connectionString);
}

export type Db = PrismaClient;
