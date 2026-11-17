// Staff moving due dates (memberships.due_changes), checked against the real
// migrations through withUserContext, as the app runs.
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { memberships, payments, type DueChangeRow } from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { withUserContext } from "@/db/user-context";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDb: () => t.db }));

const { ledgerInTransaction, moveDueDate } = await import("@/payments/queries");

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;

// Fixed so the months owed don't depend on when the tests run.
const today = "2026-04-01";

function as<T>(userId: string, run: Parameters<typeof withUserContext<T>>[2]) {
  return withUserContext(t.db, userId, run);
}

/** A member who joined on 6 Jan 2026 at ₹600 a month. */
async function joinOnJan6() {
  const memberId = await t.createMember();
  const result = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-01-06') returning id",
    [memberId],
  );
  const membershipId = result.rows[0].id;
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, 60000, '2026-01-06', $2)",
    [membershipId, owner],
  );
  return { memberId, membershipId };
}

function pay(
  member: { memberId: string; membershipId: string },
  paidOn: string,
  firstPeriod = 0,
) {
  return as(manager, (tx) =>
    tx.insert(payments).values({
      memberId: member.memberId,
      membershipId: member.membershipId,
      firstPeriod,
      amountPaise: 60000,
      method: "cash",
      paidOn,
      recordedBy: manager,
    }),
  );
}

function storedChanges(userId: string, membershipId: string) {
  return as(userId, async (tx) => {
    const [row] = await tx
      .select({ dueChanges: memberships.dueChanges })
      .from(memberships)
      .where(eq(memberships.id, membershipId));
    return row?.dueChanges ?? null;
  });
}

function dueDates(membershipId: string) {
  return as(owner, async (tx) => {
    const { ledger } = await ledgerInTransaction(tx, membershipId, today);
    return {
      periods: ledger.periods.map((p) => `${p.index} ${p.dueOn} ${p.status}`),
      owedPaise: ledger.owedPaise,
    };
  });
}

function setRaw(membershipId: string, changes: unknown) {
  return as(owner, (tx) =>
    tx
      .update(memberships)
      .set({ dueChanges: changes as DueChangeRow[] })
      .where(eq(memberships.id, membershipId)),
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
}, 60_000);

describe("moving the next due date", () => {
  it("moves owed months to the new day and keeps paid ones", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-06");
    // January paid; February and March owed on the 6th.
    const period = await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-02-20", today),
    );
    expect(period).toBe(1);
    expect(await storedChanges(manager, member.membershipId)).toEqual([
      { from_period: 1, due_on: "2026-02-20" },
    ]);
    expect(await dueDates(member.membershipId)).toEqual({
      periods: [
        "0 2026-01-06 paid",
        "1 2026-02-20 overdue",
        "2 2026-03-20 overdue",
        "3 2026-04-20 upcoming",
      ],
      owedPaise: 120000,
    });
  });

  it("lets a member who owes move to a later day and owe less", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-06");
    await as(owner, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-04-10", today),
    );
    expect(await dueDates(member.membershipId)).toEqual({
      periods: ["0 2026-01-06 paid", "1 2026-04-10 upcoming"],
      owedPaise: 0,
    });
  });

  it("replaces an earlier move from the same month", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-06");
    await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-02-20", today),
    );
    await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-03-01", today),
    );
    expect(await storedChanges(owner, member.membershipId)).toEqual([
      { from_period: 1, due_on: "2026-03-01" },
    ]);
  });

  it("refuses a day on or before the last paid month's due date", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-06");
    await expect(
      as(manager, (tx) =>
        moveDueDate(tx, member.membershipId, "2026-01-06", today),
      ),
    ).rejects.toThrow("Pick a day after");
  });

  it("is recorded in the audit log", async () => {
    const member = await joinOnJan6();
    await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-01-15", today),
    );
    const result = await t.client.query<{ count: number }>(
      `select count(*)::int as count from public.audit_log
       where table_name = 'memberships' and record_id = $1
         and after -> 'due_changes' = '[{"from_period": 0, "due_on": "2026-01-15"}]'::jsonb`,
      [member.membershipId],
    );
    expect(result.rows[0].count).toBe(1);
  });

  it("is visible to trainers, who see due dates", async () => {
    const member = await joinOnJan6();
    await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-01-15", today),
    );
    expect(await storedChanges(trainer, member.membershipId)).toEqual([
      { from_period: 0, due_on: "2026-01-15" },
    ]);
  });

  it("cannot be changed by trainers", async () => {
    const member = await joinOnJan6();
    await as(trainer, (tx) =>
      tx
        .update(memberships)
        .set({ dueChanges: [{ from_period: 0, due_on: "2026-01-20" }] })
        .where(eq(memberships.id, member.membershipId)),
    ).catch(() => undefined);
    expect(await storedChanges(owner, member.membershipId)).toEqual([]);
  });
});

describe("the first payment can start dues on any day", () => {
  it("starts dues on the day picked, even before joining", async () => {
    const member = await joinOnJan6();
    await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2025-12-20", today, {
        firstPayment: true,
      }),
    );
    await pay(member, "2026-01-08");
    const { periods } = await dueDates(member.membershipId);
    expect(periods.slice(0, 2)).toEqual([
      "0 2025-12-20 paid",
      "1 2026-01-20 overdue",
    ]);
  });

  it("starts dues on a future day", async () => {
    const member = await joinOnJan6();
    await as(manager, (tx) =>
      moveDueDate(tx, member.membershipId, "2026-05-01", today, {
        firstPayment: true,
      }),
    );
    await pay(member, "2026-03-30");
    expect(await dueDates(member.membershipId)).toEqual({
      periods: ["0 2026-05-01 paid"],
      owedPaise: 0,
    });
  });

  it("is refused once a payment counts", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-08");
    await expect(
      as(manager, (tx) =>
        moveDueDate(tx, member.membershipId, "2026-01-01", today, {
          firstPayment: true,
        }),
      ),
    ).rejects.toThrow("only for the first payment");
  });
});

describe("the database keeps due changes in order", () => {
  it.each([
    ["not a list", { from_period: 0, due_on: "2026-01-01" }],
    [
      "a period out of order",
      [
        { from_period: 3, due_on: "2026-04-01" },
        { from_period: 2, due_on: "2026-05-01" },
      ],
    ],
    [
      "a date going backwards",
      [
        { from_period: 2, due_on: "2026-04-01" },
        { from_period: 3, due_on: "2026-03-01" },
      ],
    ],
    ["a date that does not exist", [{ from_period: 1, due_on: "2026-02-30" }]],
    ["a period past fifty years", [{ from_period: 600, due_on: "2076-01-01" }]],
    ["a fractional period", [{ from_period: 1.5, due_on: "2026-02-01" }]],
    ["an extra key", [{ from_period: 1, due_on: "2026-02-01", x: 1 }]],
    ["a missing date", [{ from_period: 1 }]],
  ])("refuses %s", async (_, changes) => {
    const member = await joinOnJan6();
    await expect(setRaw(member.membershipId, changes)).rejects.toThrow();
  });

  it("accepts later periods with later dates", async () => {
    const member = await joinOnJan6();
    const changes = [
      { from_period: 0, due_on: "2026-01-10" },
      { from_period: 4, due_on: "2026-05-20" },
    ];
    await setRaw(member.membershipId, changes);
    expect(await storedChanges(owner, member.membershipId)).toEqual(changes);
  });
});
