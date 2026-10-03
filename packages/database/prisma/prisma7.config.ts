import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Path di-resolve relatif terhadap lokasi file config ini (prisma/)
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
