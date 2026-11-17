// Permanent member deletion (supabase/migrations/20261123000100_delete_member.sql),
// checked against the real migrations through withUserContext, the same path
// the app uses.
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  members,
  membershipFees,
  membershipFreezes,
  memberships,
  paymentVoids,
  payments,
} from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { rowsOf, withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;

async function rejectionMessage(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error("Expected the query to be rejected, but it succeeded");
}

function as<T>(userId: string, run: Parameters<typeof withUserContext<T>>[2]) {
  return withUserContext(t.db, userId, run);
}

function deleteAs(userId: string, memberId: string, code: string) {
  return as(userId, async (tx) => {
    const result = await tx.execute(
      sql`select public.delete_member(${memberId}, ${code}) as code`,
    );
    return rowsOf<{ code: string }>(result)[0].code;
  });
}

/**
 * A member with one of everything: membership, fee, freeze, a voided payment
 * and its correction, a visit, a claim link and a reminder, all written the
 * way the app writes them so the audit log fills up too.
 */
async function seedMember(
  name: string,
  { active = false, profileId }: { active?: boolean; profileId?: string } = {},
) {
  const ids = await as(manager, async (tx) => {
    const [member] = await tx
      .insert(members)
      .values({ fullName: name, phone: "9876543210", createdBy: manager })
      .returning({ id: members.id, code: members.memberCode });
    const [membership] = await tx
      .insert(memberships)
      .values({
        memberId: member.id,
        startsOn: "2026-03-12",
        createdBy: manager,
      })
      .returning({ id: memberships.id });
    await tx.insert(membershipFees).values({
      membershipId: membership.id,
      feePaise: 60000,
      effectiveFrom: "2026-03-12",
      setBy: manager,
    });
    await tx.insert(membershipFreezes).values({
      membershipId: membership.id,
      startsOn: "2026-05-01",
      endsOn: "2026-05-10",
      createdBy: manager,
    });
    const [payment] = await tx
      .insert(payments)
      .values({
        memberId: member.id,
        membershipId: membership.id,
        firstPeriod: 0,
        amountPaise: 6000,
        method: "cash",
        paidOn: "2026-03-12",
        recordedBy: manager,
      })
      .returning({ id: payments.id });
    return {
      memberId: member.id,
      code: member.code,
      membershipId: membership.id,
      paymentId: payment.id,
    };
  });

  await as(owner, async (tx) => {
    await tx.insert(paymentVoids).values({
      paymentId: ids.paymentId,
      reason: "Wrong amount",
      voidedBy: owner,
    });
    await tx.insert(payments).values({
      memberId: ids.memberId,
      membershipId: ids.membershipId,
      firstPeriod: 0,
      amountPaise: 60000,
      method: "cash",
      paidOn: "2026-03-12",
      replacesPaymentId: ids.paymentId,
      recordedBy: owner,
    });
  });

  await as(manager, (tx) =>
    tx.execute(
      sql`select public.issue_claim_token(${ids.memberId}, ${"x".repeat(40) + ids.memberId})`,
    ),
  );
  await t.client.query(
    "insert into public.attendance (member_id, method) values ($1, 'manual')",
    [ids.memberId],
  );
  await t.client.query(
    `insert into public.notifications
       (member_id, membership_id, period, stage, channel, status, due_on, amount_paise)
     values ($1, $2, 0, 'due_soon', 'push', 'sent', '2026-04-12', 60000)`,
    [ids.memberId, ids.membershipId],
  );

  if (profileId) {
    await t.client.query(
      "update public.members set profile_id = $1 where id = $2",
      [profileId, ids.memberId],
    );
  }
  if (!active) {
    await as(manager, async (tx) => {
      await tx
        .update(members)
        .set({ isActive: false })
        .where(eq(members.id, ids.memberId));
      await tx
        .update(memberships)
        .set({ endedOn: "2026-06-01" })
        .where(eq(memberships.memberId, ids.memberId));
    });
  }
  return ids;
}

/** Rows anywhere in the database that still mention this member. */
async function traces(memberId: string, membershipId: string) {
  const counts = await t.client.query<Record<string, number>>(
    `select
       (select count(*)::int from public.members where id = $1) as members,
       (select count(*)::int from public.memberships where member_id = $1) as memberships,
       (select count(*)::int from public.membership_fees where membership_id = $2) as fees,
       (select count(*)::int from public.membership_freezes where membership_id = $2) as freezes,
       (select count(*)::int from public.payments where member_id = $1) as payments,
       (select count(*)::int from public.attendance where member_id = $1) as attendance,
       (select count(*)::int from public.claim_tokens where member_id = $1) as claim_tokens,
       (select count(*)::int from public.notifications where member_id = $1) as notifications,
       (select count(*)::int from public.audit_log
          where record_id in ($1::text, $2::text)
             or coalesce(before::text, '') like '%' || $1 || '%'
             or coalesce(after::text, '') like '%' || $1 || '%') as audit_log`,
    [memberId, membershipId],
  );
  return counts.rows[0];
}

const none = {
  members: 0,
  memberships: 0,
  fees: 0,
  freezes: 0,
  payments: 0,
  attendance: 0,
  claim_tokens: 0,
  notifications: 0,
  audit_log: 0,
};

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
}, 60_000);

describe("who may delete", () => {
  it("refuses managers and trainers", async () => {
    const target = await seedMember("Refused");
    for (const user of [manager, trainer]) {
      expect(
        await rejectionMessage(deleteAs(user, target.memberId, target.code)),
      ).toMatch(/Only the owner/);
    }
    expect((await traces(target.memberId, target.membershipId)).members).toBe(
      1,
    );
  });

  it("refuses a member who is still active", async () => {
    const target = await seedMember("Still here", { active: true });
    expect(
      await rejectionMessage(deleteAs(owner, target.memberId, target.code)),
    ).toMatch(/Mark the member inactive/);
  });

  it("refuses without the right member ID typed in", async () => {
    const target = await seedMember("Wrong code");
    for (const code of ["", "IP-9999", target.memberId]) {
      expect(
        await rejectionMessage(deleteAs(owner, target.memberId, code)),
      ).toMatch(/Type the member ID/);
    }
  });
});

describe("deleting a member", () => {
  it("removes every row about them, audit entries included", async () => {
    const memberUser = await t.createUser("member", "Linked");
    const target = await seedMember("Gone", { profileId: memberUser });
    const bystander = await seedMember("Stays");
    const before = await traces(target.memberId, target.membershipId);
    expect(before.payments).toBe(2);
    expect(before.audit_log).toBeGreaterThan(0);

    // Lower case and spaces are fine: people type what they see.
    const code = await deleteAs(
      owner,
      target.memberId,
      ` ${target.code.toLowerCase()} `,
    );
    expect(code).toBe(target.code);

    expect(await traces(target.memberId, target.membershipId)).toEqual(none);
    const kept = await traces(bystander.memberId, bystander.membershipId);
    expect(kept.members).toBe(1);
    expect(kept.payments).toBe(2);
    expect(kept.audit_log).toBeGreaterThan(0);
  });

  it("leaves one audit line naming who deleted which member ID, and nothing else", async () => {
    const target = await seedMember("Tombstone");
    await deleteAs(owner, target.memberId, target.code);
    const result = await t.client.query<{
      actor_id: string;
      record_id: string;
      before: unknown;
      after: unknown;
    }>(
      "select actor_id, record_id, before, after from public.audit_log where table_name = 'members' and action = 'delete' and record_id = $1",
      [target.code],
    );
    expect(result.rows).toEqual([
      {
        actor_id: owner,
        record_id: target.code,
        before: { member_code: target.code },
        after: null,
      },
    ]);
  });

  it("sends a linked member account back to waiting as a guest", async () => {
    const memberUser = await t.createUser("member", "Back to guest");
    const target = await seedMember("Linked again", { profileId: memberUser });
    await deleteAs(owner, target.memberId, target.code);
    const profile = await t.client.query<{ role: string }>(
      "select role from public.profiles where id = $1",
      [memberUser],
    );
    expect(profile.rows[0].role).toBe("guest");
  });
});

describe("the append-only guards stay on", () => {
  it("still rejects direct deletes after a member was deleted", async () => {
    const victim = await seedMember("Victim");
    const purged = await seedMember("Purged properly");
    await deleteAs(owner, purged.memberId, purged.code);

    expect(
      await rejectionMessage(
        t.client.query("delete from public.payments where member_id = $1", [
          victim.memberId,
        ]),
      ),
    ).toMatch(/append-only/);
    expect(
      await rejectionMessage(
        t.client.query("delete from public.members where id = $1", [
          victim.memberId,
        ]),
      ),
    ).toMatch(/append-only/);
    expect(
      await rejectionMessage(t.client.query("delete from public.audit_log")),
    ).toMatch(/append-only/);
    expect(
      await rejectionMessage(t.client.query("truncate public.audit_log")),
    ).toMatch(/append-only/);

    const flags = await t.client.query("select 1 from private.member_purges");
    expect(flags.rows).toEqual([]);
  });

  it("does not let the deletion continue past the function in the same transaction", async () => {
    const victim = await seedMember("Same transaction");
    const purged = await seedMember("Purged first");
    expect(
      await rejectionMessage(
        t.db.transaction(async (tx) => {
          await tx.execute(
            sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: owner, role: "authenticated" })}, true)`,
          );
          await tx.execute(
            sql`select public.delete_member(${purged.memberId}, ${purged.code})`,
          );
          await tx.execute(
            sql`delete from public.payments where member_id = ${victim.memberId}`,
          );
        }),
      ),
    ).toMatch(/append-only/);
  });

  it("does not let an app user raise the deletion flag themselves", async () => {
    expect(
      await rejectionMessage(
        as(owner, (tx) =>
          tx.execute(
            sql`insert into private.member_purges (txid) values (txid_current())`,
          ),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});
