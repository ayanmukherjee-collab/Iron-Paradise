import { z } from "zod";

// NEXT_PUBLIC_ values are inlined into the browser bundle at build time, so
// each must be read with a literal `process.env.NAME` expression.
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T>(
  schema: z.ZodType<T>,
  values: Record<string, string | undefined>,
  label: string,
): T {
  const result = schema.safeParse(values);
  if (!result.success) {
    const names = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Missing or invalid ${label} environment variables: ${names}. See .env.example.`,
    );
  }
  return result.data;
}

// Parsed on first use rather than at import, so `next build` and tests that
// never touch these values do not need a full .env.
export function publicEnv(): PublicEnv {
  return parse(
    publicSchema,
    {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY:
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
    "public",
  );
}

export function serverEnv(): ServerEnv {
  return parse(
    serverSchema,
    {
      DATABASE_URL: process.env.DATABASE_URL,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || undefined,
      UPSTASH_REDIS_REST_TOKEN:
        process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
    },
    "server",
  );
}

export const isProduction = process.env.NODE_ENV === "production";
