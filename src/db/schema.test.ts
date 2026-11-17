import { getTableColumns, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";

const tables = Object.values(schema).filter(
  (value) => value instanceof PgTable,
);

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
}, 60_000);

describe("the Drizzle schema matches the migrations", () => {
  it.each(tables.map((table) => [getTableName(table), table] as const))(
    "%s has every column the code expects",
    async (name, table) => {
      const expected = Object.values(getTableColumns(table))
        .map((column) => column.name)
        .sort();
      const result = await t.client.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
        [name],
      );
      const actual = result.rows.map((row) => row.column_name).sort();
      expect(actual).toEqual(expected);
    },
  );

  it("enables row-level security on every public table", async () => {
    const result = await t.client.query<{ relname: string }>(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity",
    );
    expect(result.rows).toEqual([]);
  });

  it("lets anonymous visitors execute no public function", async () => {
    const result = await t.client.query<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'execute')",
    );
    expect(result.rows).toEqual([]);
  });

  it("keeps the private schema out of reach of every app role", async () => {
    const result = await t.client.query<{ role: string; usable: boolean }>(
      "select r as role, has_schema_privilege(r, 'private', 'usage') as usable from unnest(array['anon', 'authenticated']) r",
    );
    expect(result.rows).toEqual([
      { role: "anon", usable: false },
      { role: "authenticated", usable: false },
    ]);
  });

  it("lets signed-in users execute only the functions meant for them", async () => {
    const result = await t.client.query<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', oid, 'execute') order by proname",
    );
    expect(result.rows.map((row) => row.proname)).toEqual([
      "check_in",
      "create_desk_display",
      "current_app_role",
      "erase_member",
      "has_role",
      "is_own_member",
      "is_own_membership",
      "is_staff",
      "issue_claim_token",
      "link_guest_to_member",
      "own_member_id",
      "own_membership_ids",
      "printed_checkin_code",
      "redeem_claim_token",
      "regenerate_printed_checkin_code",
      "revoke_desk_display",
      "save_push_subscription",
      "set_user_active",
      "set_user_role",
    ]);
  });
});
