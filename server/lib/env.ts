import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  DATABASE_URL: z.string().optional(),
  SUPABASE_DB_URL_DEV: z.string().optional(),
  SUPABASE_DB_URL_PROD: z.string().optional(),
  
  SESSION_SECRET: z.string().min(32).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  
  RESEND_API_KEY: z.string().optional(),
  
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error("[ENV] Invalid environment variables:");
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
  }
  
  return result.success ? result.data : (process.env as unknown as Env);
}

export const ENV = loadEnv();

export const isProd = () => ENV.NODE_ENV === "production";
export const isDev = () => ENV.NODE_ENV === "development";
export const isTest = () => ENV.NODE_ENV === "test";

export function getDbUrl(): string {
  if (isProd() && ENV.SUPABASE_DB_URL_PROD) {
    return ENV.SUPABASE_DB_URL_PROD;
  }
  if (ENV.SUPABASE_DB_URL_DEV) {
    return ENV.SUPABASE_DB_URL_DEV;
  }
  if (ENV.DATABASE_URL) {
    return ENV.DATABASE_URL;
  }
  throw new Error("[ENV] No database URL configured");
}

export function requireSecret(name: keyof Env, fallback?: string): string {
  const value = ENV[name] as string | undefined;
  if (!value && !fallback) {
    throw new Error(`[ENV] Missing required secret: ${name}`);
  }
  return value || fallback!;
}
