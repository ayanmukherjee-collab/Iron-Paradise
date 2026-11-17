// The database functions the static app calls straight from phones
// (supabase/migrations/20261126000100_static_app.sql). They run as the
// caller, so each must refuse exactly what the old Server Actions' queries
// were refused, and do every step or none.
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { crowdFile } from "@/bulletin/crowd";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { rowsOf, withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;
let memberUser: string;

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
  memberUser = await t.createUser("member");
}, 60_000);

/** The database's own message: Drizzle wraps it as the error's cause. */
async function rejectionMessage(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error("Expected the query to be rejected, but it succeeded");
}

async function one<T>(userId: string, query: ReturnType<typeof sql>) {
  return withUserContext(t.db, userId, async (tx) => {
    return rowsOf<T>(await tx.execute(query))[0];
  });
}

function addMember(userId: string, name = "New Member") {
  return one<{ id: string }>(
    userId,
    sql`select public.add_member(${name}, '9876543210', '2026-03-12', null, 60000, true) as id`,
  );
}

async function count(query: string, params: unknown[]): Promise<number> {
  const result = await t.client.query<{ n: number }>(query, params);
  return Number(result.rows[0].n);
}

describe("add_member", () => {
  it("creates the member, their membership and the agreed fee together", async () => {
    const { id } = await addMember(manager);
    expect(
      await count(
        "select count(*) as n from public.memberships where member_id = $1 and ended_on is null",
        [id],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from public.membership_fees f join public.memberships m on m.id = f.membership_id where m.member_id = $1 and f.fee_paise = 60000",
        [id],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from public.members where id = $1 and reminder_consent_at is not null and created_by = $2",
        [id, manager],
      ),
    ).toBe(1);
  });

  it("refuses trainers and members, leaving nothing behind", async () => {
    const before = await count("select count(*) as n from public.members", []);
    await expect(addMember(trainer)).rejects.toThrow();
    await expect(addMember(memberUser)).rejects.toThrow();
    expect(await count("select count(*) as n from public.members", [])).toBe(
      before,
    );
  });
});

describe("deactivate_member and reactivate_member", () => {
  it("ends the open membership, then starts a fresh one", async () => {
    const { id } = await addMember(manager, "Comes and goes");
    await one(manager, sql`select public.deactivate_member(${id})`);
    expect(
      await count(
        "select count(*) as n from public.members where id = $1 and not is_active",
        [id],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from public.memberships where member_id = $1 and ended_on is null",
        [id],
      ),
    ).toBe(0);

    await one(
      manager,
      sql`select public.reactivate_member(${id}, '2026-06-01', null, 50000)`,
    );
    expect(
      await count(
        "select count(*) as n from public.memberships where member_id = $1 and ended_on is null and starts_on = '2026-06-01'",
        [id],
      ),
    ).toBe(1);
  });

  it("refuses a trainer", async () => {
    const { id } = await addMember(manager);
    expect(
      await rejectionMessage(
        one(trainer, sql`select public.deactivate_member(${id})`),
      ),
    ).toMatch(/permission denied|no longer exists|row-level security/);
    expect(
      await count(
        "select count(*) as n from public.members where id = $1 and is_active",
        [id],
      ),
    ).toBe(1);
  });
});

describe("record_payment and correct_payment", () => {
  async function openMembership(memberId: string) {
    const result = await t.client.query<{ id: string }>(
      "select id from public.memberships where member_id = $1 and ended_on is null",
      [memberId],
    );
    return result.rows[0].id;
  }

  function pay(
    userId: string,
    memberId: string,
    membershipId: string,
    dueChanges: unknown = null,
  ) {
    return one<{ id: string }>(
      userId,
      sql`select public.record_payment(${memberId}, ${membershipId}, 0::smallint, 60000, 'cash', '2026-03-12', null, null, ${dueChanges === null ? null : JSON.stringify(dueChanges)}::jsonb) as id`,
    );
  }

  it("records a first payment with Due from, and refuses Due from later", async () => {
    const { id: memberId } = await addMember(manager, "Payer");
    const membershipId = await openMembership(memberId);
    const changes = [{ from_period: 0, due_on: "2026-03-15" }];
    await pay(manager, memberId, membershipId, changes);

    const result = await t.client.query<{ due_changes: unknown }>(
      "select due_changes from public.memberships where id = $1",
      [membershipId],
    );
    expect(result.rows[0].due_changes).toEqual(changes);

    expect(
      await rejectionMessage(pay(manager, memberId, membershipId, changes)),
    ).toMatch(/only for the first payment/);
  });

  it("refuses a trainer", async () => {
    const { id: memberId } = await addMember(manager);
    const membershipId = await openMembership(memberId);
    await expect(pay(trainer, memberId, membershipId)).rejects.toThrow();
  });

  it("lets the owner correct a payment, voiding the old one; managers can't", async () => {
    const { id: memberId } = await addMember(manager, "Corrected");
    const membershipId = await openMembership(memberId);
    const { id: paymentId } = await pay(manager, memberId, membershipId);

    const correct = (userId: string) =>
      one<{ id: string }>(
        userId,
        sql`select public.correct_payment(${paymentId}, 'Typed the wrong amount', 50000, 'upi', '2026-03-12', null, null) as id`,
      );
    await expect(correct(manager)).rejects.toThrow();
    const { id: replacement } = await correct(owner);

    expect(
      await count(
        "select count(*) as n from public.payment_voids where payment_id = $1",
        [paymentId],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from public.payments where id = $1 and replaces_payment_id = $2 and amount_paise = 50000",
        [replacement, paymentId],
      ),
    ).toBe(1);
  });
});

describe("read functions run as the caller", () => {
  it("member_activity shows a member only their own row", async () => {
    const own = await t.createMember({ profileId: memberUser, name: "Me" });
    await t.createMember({ name: "Someone else" });
    const rows = await withUserContext(t.db, memberUser, async (tx) =>
      rowsOf<{ member_id: string }>(
        await tx.execute(sql`select * from public.member_activity()`),
      ),
    );
    expect(rows.map((row) => row.member_id)).toEqual([own]);
  });

  it("collected and counted totals are hidden from trainers", async () => {
    const collected = await one<{ total: string }>(
      trainer,
      sql`select public.collected('2000-01-01', '2100-01-01') as total`,
    );
    expect(Number(collected.total)).toBe(0);
    const totals = await withUserContext(t.db, trainer, async (tx) =>
      rowsOf(
        await tx.execute(sql`select * from public.counted_payment_totals()`),
      ),
    );
    expect(totals).toEqual([]);

    const forOwner = await one<{ total: string }>(
      owner,
      sql`select public.collected('2000-01-01', '2100-01-01') as total`,
    );
    expect(Number(forOwner.total)).toBeGreaterThan(0);
  });

  it("attendance_month counts visits per day and distinct members", async () => {
    const memberId = await t.createMember({ name: "Regular" });
    await t.client.query(
      "insert into public.attendance (member_id, method, checked_in_at, gym_date) values ($1, 'manual', '2026-05-03T04:00:00Z', '2026-05-03'), ($1, 'manual', '2026-05-04T04:00:00Z', '2026-05-04')",
      [memberId],
    );
    const { summary } = await one<{ summary: unknown }>(
      manager,
      sql`select public.attendance_month('2026-05-01', '2026-05-31') as summary`,
    );
    const parsed = typeof summary === "string" ? JSON.parse(summary) : summary;
    expect(parsed).toEqual({
      perDay: [
        { day: "2026-05-03", visits: 1 },
        { day: "2026-05-04", visits: 1 },
      ],
      members: 1,
    });
  });
});

describe("bulletin", () => {
  it("is readable by any signed-in person, not by signed-out visitors", async () => {
    const { body } = await one<{ body: unknown }>(
      memberUser,
      sql`select public.bulletin() as body`,
    );
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    expect(parsed).toMatchObject({ timezone: "Asia/Kolkata" });

    await t.client.query("set role anon");
    try {
      await expect(
        t.client.query("select public.bulletin()"),
      ).rejects.toThrow();
    } finally {
      await t.client.query("reset role");
    }
  });
});

describe("crowd", () => {
  it("gives signed-in people recent check-in times only, and nothing signed out", async () => {
    const memberId = await t.createMember({ name: "Crowd Regular" });
    await t.client.query(
      "insert into public.attendance (member_id, method, checked_in_at, gym_date) values ($1, 'manual', now() - interval '10 minutes', (now() at time zone 'Asia/Kolkata')::date), ($1, 'manual', now() - interval '3 hours', (now() at time zone 'Asia/Kolkata')::date - 1)",
      [memberId],
    );
    const { body } = await one<{ body: unknown }>(
      memberUser,
      sql`select public.crowd() as body`,
    );
    const parsed = crowdFile.parse(
      typeof body === "string" ? JSON.parse(body) : body,
    );
    expect(Object.keys(parsed).sort()).toEqual(["checkins", "generatedAt"]);
    // The 3-hour-old visit is past the two-hour window.
    expect(parsed.checkins).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain(memberId);

    await t.client.query("set role anon");
    try {
      await expect(t.client.query("select public.crowd()")).rejects.toThrow();
    } finally {
      await t.client.query("reset role");
    }
  });
});

describe("desk_code", () => {
  it("is callable signed out, and refuses an unknown token", async () => {
    await t.client.query("set role anon");
    try {
      await expect(
        t.client.query("select * from public.desk_code($1)", ["not-a-token"]),
      ).rejects.toThrow(/switched off/);
    } finally {
      await t.client.query("reset role");
    }
  });

  it("gives a working code for a live desk link", async () => {
    const token = "a".repeat(43);
    await withUserContext(t.db, owner, (tx) =>
      tx.execute(
        sql`select public.create_desk_display('Front desk', ${token})`,
      ),
    );
    await t.client.query("set role anon");
    try {
      const result = await t.client.query<{
        code: string;
        seconds_left: number;
      }>("select * from public.desk_code($1)", [token]);
      expect(result.rows[0].code).toMatch(/^[0-9a-f]{12}$/);
      expect(result.rows[0].seconds_left).toBeGreaterThan(0);
    } finally {
      await t.client.query("reset role");
    }
  });
});
