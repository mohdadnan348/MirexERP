
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

// ==========================================
// ENVIRONMENT VALIDATION SCHEMA
// ==========================================

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),

  API_PREFIX: z
    .string()
    .default("/api/v1"),

  APP_NAME: z
    .string()
    .default("MirexERP"),

  APP_URL: z
    .string()
    .url()
    .default("http://localhost:5000"),

  // Database
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required"),

  // Frontend
  FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),

  MOBILE_APP_SCHEME: z
    .string()
    .default("mirexerp"),

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must contain at least 32 characters"),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must contain at least 32 characters"),

  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default("15m"),

  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default("7d"),

  // Password
  BCRYPT_SALT_ROUNDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(15)
    .default(12),

  // File storage
  UPLOAD_DIR: z
    .string()
    .default("uploads"),

  MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),

  ALLOWED_FILE_TYPES: z
    .string()
    .default(
      "image/jpeg,image/png,image/webp,application/pdf"
    ),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),

  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(100),

  // Pagination
  DEFAULT_PAGE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  MAX_PAGE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(100),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "debug"])
    .default("debug"),

  // Email
  SMTP_HOST: z.string().default(""),

  SMTP_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(587),

  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM_NAME: z.string().default("MirexERP"),
  SMTP_FROM_EMAIL: z.string().default(""),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  // Push notifications
  EXPO_ACCESS_TOKEN: z.string().default(""),
});

// ==========================================
// VALIDATE ENVIRONMENT VARIABLES
// ==========================================

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("\n❌ Invalid environment configuration:\n");

  for (const issue of parsedEnv.error.issues) {
    const field = issue.path.join(".") || "environment";
    console.error(`- ${field}: ${issue.message}`);
  }

  console.error(
    "\nPlease check your .env file and restart the server.\n"
  );

  process.exit(1);
}

// ==========================================
// EXPORT VALIDATED ENVIRONMENT
// ==========================================

const validatedEnv = parsedEnv.data;

export const env = {
  ...validatedEnv,

  ALLOWED_FILE_TYPES: validatedEnv.ALLOWED_FILE_TYPES
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean),
};

// ==========================================
// ENVIRONMENT HELPERS
// ==========================================

export const isDevelopment =
  env.NODE_ENV === "development";

export const isProduction =
  env.NODE_ENV === "production";

export const isTest =
  env.NODE_ENV === "test";

// ==========================================
// ENVIRONMENT TYPE
// ==========================================

export type Environment = typeof env;
