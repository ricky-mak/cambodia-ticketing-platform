import { z } from "zod";

/**
 * Environment-variable validation.
 *
 * Validation is lazy (evaluated on first `getEnv()` call, not at import time)
 * so that `next build` does not crash in environments where runtime secrets
 * such as DATABASE_URL are intentionally absent.
 *
 * Add new variables here as later phases need them. Anything the browser must
 * read has to be prefixed with NEXT_PUBLIC_ and is deliberately kept out of
 * this server-only schema.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgres connection string",
    }),
  APPLICATION_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof serverSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables:", issues);
    throw new Error(
      "Invalid environment variables: " + JSON.stringify(issues),
    );
  }

  cached = parsed.data;
  return cached;
}
