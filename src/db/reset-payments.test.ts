// The one-off wipe of old payments (private.reset_payments) against the
// real migrations, with plans made by the same code the live run uses.
import { beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { planReset } from "@/payments/reset-plan";

let t: TestDatabase;
let owner: string;
let manager: string;

async function join(startsOn: string, feePaise = 60000) {
  const memberId = await t.createMember();
  const { rows } = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, $2) returning id",
    [memberId, startsOn],
  );
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, $2, $3, $4)",
    [rows[0].id, feePaise, startsOn, owner],
  );
  return { memberId, membershipId: rows[0].id };
}

async function pay(
  member: { memberId: string; membershipId: string },
  firstPeriod: number,
  amountPaise: number,
  paidOn: string,
) {
  const { rows } = await t.client.query<{ id: string }>(
    `insert into public.payments (member_id, membership_id, first_period, amount_paise, method, paid_on, recorded_by)
     values ($1, $2, $3, $4, 'cash', $5, $6) returning id`,
    [
      member.memberId,
      member.membershipId,
      firstPeriod,
      amountPaise,
      paidOn,
      manager,
    ],
  );
  return rows[0].id;
}

async function remind(
  member: { memberId: string; membershipId: string },
  period: number,
  dueOn: string,
  at: string,
) {
  await t.client.query(
    `insert into public.notifications
       (member_id, membership_id, period, stage, channel, status, due_on, amount_paise)
     values ($1, $2, $3, 'overdue', 'push', 'sent', $4, 60000)`,
    [member.memberId, member.membershipId, period, dueOn],
  );
  // The stamp trigger sets created_at to now; age it like a real row.
  await t.client.query(
    "alter table public.notifications disable trigger notifications_settle_once",
  );
  await t.client.query(
    "update public.notifications set created_at = $1 where membership_id = $2 and period = $3",
    [at, member.membershipId, period],
  );
  await t.client.query(
    "alter table public.notifications enable trigger notifications_settle_once",
  );
}

/** The plan the script would send, for one membership with fee ₹600. */
async function planFor(
  member: { membershipId: string },
  startsOn: string,
  paid: { firstPeriod: number; amountPaise: number }[],
) {
  const { rows } = await t.client.query<{ billing_starts_on: string }>(
    "select billing_starts_on::text from public.memberships where id = $1",
    [member.membershipId],
  );
  const plan = planReset(
    member.membershipId,
    {
      startsOn,
      billingStartsOn: rows[0].billing_starts_on ?? startsOn,
      dueChanges: [],
      endedOn: null,
      freezes: [],
      fees: [
        { feePaise: 60000, effectiveFrom: startsOn, createdAt: new Date(0) },
      ],
    },
    paid.map((p, i) => ({ ...p, createdAt: new Date(i) })),
  )!;
  return {
    membershipId: plan.membershipId,
    shift: plan.shift,
    dueChanges: plan.dueChanges,
  };
}

async function reset(snapshot: string, plans: unknown[]) {
  const { rows } = await t.client.query<{ summary: Record<string, number> }>(
    "select private.reset_payments($1::timestamptz, $2::jsonb) as summary",
    [snapshot, JSON.stringify(plans)],
  );
  return rows[0].summary;
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected the database to refuse");
}

let ahead: { memberId: string; membershipId: string };
let owing: { memberId: string; membershipId: string };
let untouched: { memberId: string; membershipId: string };

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");

  // First paid 12 Jan, three months ahead: next due 12 Apr.
  ahead = await join("2026-01-10");
  await pay(ahead, 0, 180000, "2026-01-12");
  // Paid January only: February and March owed, reminded about February.
  owing = await join("2026-01-05");
  await pay(owing, 0, 60000, "2026-01-05");
  await remind(owing, 0, "2026-01-05", "2026-01-08T03:30:00Z");
  await remind(owing, 1, "2026-02-05", "2026-02-08T03:30:00Z");
  // Never paid: nothing to restart.
  untouched = await join("2026-03-01");
}, 60_000);

describe("wiping the old payments", () => {
  it("refuses a plan that misses a membership with payments", async () => {
    const message = await refusal(
      reset(new Date().toISOString(), [
        await planFor(ahead, "2026-01-10", [
          { firstPeriod: 0, amountPaise: 180000 },
        ]),
      ]),
    );
    expect(message).toMatch(/no plan for membership/);
  });

  it("refuses when payments changed after the plan was made", async () => {
    const message = await refusal(reset("2000-01-01T00:00:00Z", []));
    expect(message).toMatch(/changed after the plan was made/);
  });

  it("can't be run by anyone in the app", async () => {
    const { rows } = await t.client.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated', 'private.reset_payments(timestamptz, jsonb)', 'execute') as allowed",
    );
    expect(rows[0].allowed).toBe(false);
  });

  it("removes every payment and restarts dues where they stood", async () => {
    const plans = [
      await planFor(ahead, "2026-01-10", [
        { firstPeriod: 0, amountPaise: 180000 },
      ]),
      await planFor(owing, "2026-01-05", [
        { firstPeriod: 0, amountPaise: 60000 },
      ]),
    ];
    expect(plans.map((p) => p.dueChanges)).toEqual([
      [{ from_period: 0, due_on: "2026-04-12" }],
      [{ from_period: 0, due_on: "2026-02-05" }],
    ]);
    const summary = await reset(new Date().toISOString(), plans);
    expect(summary).toEqual({
      payments: 2,
      voids: 0,
      memberships: 2,
      remindersDropped: 1,
    });

    const left = await t.client.query("select 1 from public.payments");
    expect(left.rows).toEqual([]);

    const schedules = await t.client.query<{
      id: string;
      due_changes: unknown;
      billing_starts_on: string | null;
    }>(
      "select id, due_changes, billing_starts_on::text from public.memberships order by starts_on",
    );
    const byId = new Map(schedules.rows.map((row) => [row.id, row]));
    expect(byId.get(ahead.membershipId)).toMatchObject({
      due_changes: [{ from_period: 0, due_on: "2026-04-12" }],
      billing_starts_on: null,
    });
    expect(byId.get(untouched.membershipId)).toMatchObject({
      due_changes: [],
      billing_starts_on: null,
    });
  });

  it("keeps the reminder about an unpaid month, renumbered, with its time", async () => {
    const { rows } = await t.client.query<{
      period: number;
      due_on: string;
      created_at: Date;
    }>(
      "select period, due_on::text, created_at from public.notifications where membership_id = $1",
      [owing.membershipId],
    );
    expect(rows).toEqual([
      {
        period: 0,
        due_on: "2026-02-05",
        created_at: new Date("2026-02-08T03:30:00Z"),
      },
    ]);
    // The stamp trigger is back on for everything else.
    const { rows: triggers } = await t.client.query<{ tgenabled: string }>(
      "select tgenabled from pg_trigger where tgname = 'notifications_stamp_created_at'",
    );
    expect(triggers[0].tgenabled).toBe("O");
  });

  it("leaves new payments by months working as usual", async () => {
    await t.client.query(
      `insert into public.payments (member_id, membership_id, first_period, months, amount_paise, method, paid_on, recorded_by)
       values ($1, $2, 0, 3, 150000, 'upi', '2026-03-01', $3)`,
      [owing.memberId, owing.membershipId, manager],
    );
    const { rows } = await t.client.query<{ months: number }>(
      "select months from public.payments where membership_id = $1",
      [owing.membershipId],
    );
    expect(rows).toEqual([{ months: 3 }]);
  });
});
