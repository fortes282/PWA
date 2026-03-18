import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * SQLite mode (dev / default):
 *   DATABASE_PATH=/path/to/pristav.db npx drizzle-kit push
 *
 * PostgreSQL mode (production):
 *   DATABASE_URL=postgresql://... npx drizzle-kit push
 *   DATABASE_URL=postgresql://... npx drizzle-kit migrate
 */

const isPg = !!process.env.DATABASE_URL;

const config: Config = isPg
  ? {
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "postgresql",
      dbCredentials: {
        url: process.env.DATABASE_URL!,
      },
    }
  : {
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: {
        url: process.env.DATABASE_PATH ?? "./data/pristav.db",
      },
    };

export default config;
