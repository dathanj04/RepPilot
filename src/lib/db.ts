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

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function createPrisma(connectionString: string) {
  return createClient(connectionString);
}

export type Db = PrismaClient;
