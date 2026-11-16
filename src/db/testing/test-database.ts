import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database } from "@/db/user-context";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const stubPath = join(
  process.cwd(),
  "src",
  "db",
  "testing",
  "supabase-stub.sql",
);

export type AppRole = (typeof schema.appRole.enumValues)[number];

export interface TestDatabase {
  client: PGlite;
  db: Database;
  /** Creates an auth user (the trigger makes their profile) and sets their role. */
  createUser(role: AppRole, name?: string): Promise<string>;
  /** Inserts a member row as the database owner, bypassing RLS. */
  createMember(fields?: { profileId?: string; name?: string }): Promise<string>;
}

/** A fresh in-memory Postgres with the Supabase stub and every migration applied. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  await client.exec(readFileSync(stubPath, "utf8"));

  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await client.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  // Check-ins are refused outside the training batches. Open them round the
  // clock so tests pass whatever time they run; batch tests set real hours.
  await client.exec(
    "update public.gym_settings set morning_opens = '00:00', morning_closes = '12:00', evening_opens = '12:00', evening_closes = '24:00'",
  );

  const db = drizzle(client, { schema }) as unknown as Database;

  async function createUser(role: AppRole, name = `${role} user`) {
    const id = crypto.randomUUID();
    await client.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [id, `${id}@example.test`, { full_name: name }],
    );
    await client.query("update public.profiles set role = $1 where id = $2", [
      role,
      id,
    ]);
    return id;
  }

  async function createMember(
    fields: { profileId?: string; name?: string } = {},
  ) {
    const result = await client.query<{ id: string }>(
      "insert into public.members (full_name, phone, profile_id) values ($1, $2, $3) returning id",
      [fields.name ?? "Test Member", "9876543210", fields.profileId ?? null],
    );
    return result.rows[0].id;
  }

  return { client, db, createUser, createMember };
}
