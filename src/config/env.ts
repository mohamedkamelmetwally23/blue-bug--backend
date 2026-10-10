import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z
    .string()
    .regex(/^ops_(dev|preview|test|production)(_[a-z0-9_]+)?$/),
  AUTH_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
});
export function frontendOrigin() {
  // Preflight must not depend on database or authentication configuration.
  return new URL(schema.shape.FRONTEND_URL.parse(process.env.FRONTEND_URL)).origin;
}
export function configuration() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const message =
      "Missing or invalid environment variables: " +
      result.error.issues.map((i) => i.path.join(".")).join(", ");
    console.error(message);
    throw new Error(message);
  }
  return result.data;
}
