import "dotenv/config";
import { createPrivateKey } from "node:crypto";
import { z } from "zod";

const booleanString = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
const normalizedGooglePrivateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";

if (
  !normalizedGooglePrivateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
  !normalizedGooglePrivateKey.endsWith("-----END PRIVATE KEY-----")
) {
  throw new Error(
    "Invalid GOOGLE_PRIVATE_KEY configuration: expected a PEM private key beginning with -----BEGIN PRIVATE KEY----- and ending with -----END PRIVATE KEY-----"
  );
}

try {
  createPrivateKey(normalizedGooglePrivateKey);
} catch {
  throw new Error("Invalid GOOGLE_PRIVATE_KEY configuration: the normalized PEM key could not be decoded");
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().default("menna"),
  API_PREFIX: z.string().default("/api/v1"),
  GOOGLE_SHEET_ID: z.string().default(""),
  GOOGLE_SHEET_GID: z.string().default("0"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().default(""),
  GOOGLE_PRIVATE_KEY: z.string().min(1),
  GOOGLE_WEBHOOK_SECRET: z.string().default(""),
  GOOGLE_SHEETS_SYNC_ENABLED: booleanString,
  GOOGLE_SHEETS_INITIAL_SYNC: booleanString,
  GOOGLE_SHEETS_SYNC_INTERVAL_MS: z.coerce.number().int().min(15000).default(60000)
});

const parsed = schema.safeParse({ ...process.env, GOOGLE_PRIVATE_KEY: normalizedGooglePrivateKey });
if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.message}`);
export const env = parsed.data;

