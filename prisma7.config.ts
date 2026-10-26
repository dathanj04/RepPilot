import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon migrations need the direct (non-pooler) URL. Runtime uses DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
