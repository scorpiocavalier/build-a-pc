import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations and the seed need a direct (unpooled) connection. Neon's
    // Vercel integration provides DATABASE_URL_UNPOOLED; elsewhere the one
    // DATABASE_URL is used for everything.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
