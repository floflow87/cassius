import { defineConfig } from "drizzle-kit";

const isDev = process.env.NODE_ENV !== "production";
const dbUrl = isDev
  ? process.env.SUPABASE_DB_URL_DEV
  : process.env.SUPABASE_DB_URL_PROD;

if (!dbUrl) {
  throw new Error(
    isDev
      ? "SUPABASE_DB_URL_DEV is required for migrations in development"
      : "SUPABASE_DB_URL_PROD is required for migrations in production"
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
