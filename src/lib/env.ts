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

// Reminders (brief §4.6). Each channel switches on only when its values are
// set, so the app runs without them and a missing key never breaks a page.
const reminderSchema = z.object({
  CRON_SECRET: z.string().min(32).optional(),
  VAPID_PUBLIC_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{87}$/, "a base64url P-256 public key")
    .optional(),
  VAPID_PRIVATE_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, "a base64url P-256 private key")
    .optional(),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/, "a mailto: or https:// address")
    .optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;
export type ReminderEnv = z.infer<typeof reminderSchema>;

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

export function reminderEnv(): ReminderEnv {
  const read = (name: string) => process.env[name] || undefined;
  return parse(
    reminderSchema,
    {
      CRON_SECRET: read("CRON_SECRET"),
      VAPID_PUBLIC_KEY: read("VAPID_PUBLIC_KEY"),
      VAPID_PRIVATE_KEY: read("VAPID_PRIVATE_KEY"),
      VAPID_SUBJECT: read("VAPID_SUBJECT"),
      RESEND_API_KEY: read("RESEND_API_KEY"),
      EMAIL_FROM: read("EMAIL_FROM"),
    },
    "reminder",
  );
}

export const isProduction = process.env.NODE_ENV === "production";
