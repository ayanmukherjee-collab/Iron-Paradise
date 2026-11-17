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

  it("lets anonymous visitors execute only the desk display's code", async () => {
    const result = await t.client.query<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'execute')",
    );
    // The signed-out desk device's long secret link is its credential
    // (public.desk_code checks it, as private.desk_checkin_code did).
    expect(result.rows).toEqual([{ proname: "desk_code" }]);
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
      "add_member",
      "attendance_month",
      "bulletin",
      "check_in",
      "collected",
      "convert_guest",
      "correct_payment",
      "counted_payment_totals",
      "create_desk_display",
      "current_app_role",
      "deactivate_member",
      "delete_member",
      "desk_code",
      "gym_hours_on",
      "has_role",
      "is_day_hours",
      "is_own_member",
      "is_own_membership",
      "is_staff",
      "is_weekly_hours",
      "issue_claim_token",
      "latest_payments",
      "link_guest_to_member",
      "member_activity",
      "own_member_id",
      "own_membership_ids",
      "printed_checkin_code",
      "publish_bulletin",
      "reactivate_member",
      "record_payment",
      "redeem_claim_token",
      "regenerate_printed_checkin_code",
      "revoke_desk_display",
      "save_push_subscription",
      "set_user_active",
      "set_user_role",
      "start_membership",
      "valid_due_changes",
    ]);
  });
});
