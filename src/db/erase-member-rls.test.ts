// Permanently deleting a member (brief §3, owner's decision of 2026-11-17),
// checked against the real migrations through withUserContext, the same path
// the app uses.
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;

async function rejectionMessage(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error("Expected the query to be rejected, but it succeeded");
}

function erase(userId: string, memberId: string, code: string) {
  return withUserContext(t.db, userId, (tx) =>
    tx.execute(sql`select public.erase_member(${memberId}, ${code})`),
  );
}

async function one<T>(text: string, params: unknown[] = []): Promise<T> {
  const result = await t.client.query<T>(text, params);
  return result.rows[0];
}

/**
 * A member with something in every table that points at them: two
 * memberships, fees, a freeze, a payment, its void and correction, a visit, a
 * claim link and a reminder. Returns every id the erase must remove.
 */
async function memberWithHistory(profileId: string | null = null) {
  const memberId = await t.createMember({ profileId: profileId ?? undefined });
  const { member_code: code } = await one<{ member_code: string }>(
    "select member_code from public.members where id = $1",
    [memberId],
  );
  const { id: oldMembership } = await one<{ id: string }>(
    "insert into public.memberships (member_id, starts_on, ended_on) values ($1, '2026-01-05', '2026-02-05') returning id",
    [memberId],
  );
  const { id: membership } = await one<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-03-12') returning id",
    [memberId],
  );
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, 60000, '2026-03-12', $2), ($3, 50000, '2026-01-05', $2)",
    [membership, owner, oldMembership],
  );
  await t.client.query(
    "insert into public.membership_freezes (membership_id, starts_on, ends_on, created_by) values ($1, '2026-04-01', '2026-04-10', $2)",
    [membership, owner],
  );
  const { id: payment } = await one<{ id: string }>(
    "insert into public.payments (member_id, membership_id, first_period, amount_paise, method, paid_on, recorded_by) values ($1, $2, 0, 6000, 'cash', '2026-03-12', $3) returning id",
    [memberId, membership, owner],
  );
  await t.client.query(
    "insert into public.payment_voids (payment_id, reason, voided_by) values ($1, 'typo in amount', $2)",
    [payment, owner],
  );
  const { id: correction } = await one<{ id: string }>(
    "insert into public.payments (member_id, membership_id, first_period, amount_paise, method, paid_on, recorded_by, replaces_payment_id) values ($1, $2, 0, 60000, 'cash', '2026-03-12', $3, $4) returning id",
    [memberId, membership, owner, payment],
  );
  await t.client.query(
    "insert into public.attendance (member_id, method, marked_by) values ($1, 'manual', $2)",
    [memberId, owner],
  );
  await t.client.query(
    "insert into public.claim_tokens (member_id, token_hash, created_by) values ($1, sha256(convert_to($2, 'UTF8')), $3)",
    [memberId, crypto.randomUUID(), owner],
  );
  await t.client.query(
    "insert into public.notifications (member_id, membership_id, period, stage, channel, status, due_on, amount_paise) values ($1, $2, 1, 'due_soon', 'push', 'sent', '2026-04-12', 60000)",
    [memberId, membership],
  );
  return {
    memberId,
    code,
    ids: [memberId, oldMembership, membership, payment, correction],
  };
}

/** Every row, in every public table, whose contents mention `id`. */
async function rowsMentioning(id: string): Promise<string[]> {
  const tables = await t.client.query<{ name: string }>(
    "select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
  );
  const found: string[] = [];
  for (const { name } of tables.rows) {
    const { count } = await one<{ count: number }>(
      `select count(*)::int as count from public."${name}" t where to_jsonb(t)::text like $1`,
      [`%${id}%`],
    );
    if (count > 0) found.push(`${name} (${count})`);
  }
  return found;
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
}, 60_000);

describe("erasing a member", () => {
  it("leaves their ids nowhere in the database", async () => {
    const account = await t.createUser("member", "Leaving");
    const leaving = await memberWithHistory(account);
    const staying = await memberWithHistory();
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    // The audit trail now holds copies of their rows, member id included.
    expect(await rowsMentioning(leaving.memberId)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^audit_log/)]),
    );

    await erase(owner, leaving.memberId, leaving.code);

    for (const id of leaving.ids) {
      expect(await rowsMentioning(id)).toEqual([]);
    }
    // Nobody else's history goes with them.
    for (const id of staying.ids) {
      expect(await rowsMentioning(id)).not.toEqual([]);
    }
  });

  it("records who erased someone, with counts and nothing that identifies them", async () => {
    const leaving = await memberWithHistory();
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    await erase(owner, leaving.memberId, leaving.code);

    const entry = await one<{
      actor_id: string;
      record_id: string;
      action: string;
      before: unknown;
      after: unknown;
    }>(
      "select actor_id, record_id, action, before, after from public.audit_log where table_name = 'members' order by id desc limit 1",
    );
    expect(entry).toEqual({
      actor_id: owner,
      record_id: "erased",
      action: "delete",
      before: null,
      after: { memberships: 2, payments: 2, visits: 1 },
    });
  });

  it("sends a linked member account back to waiting as a guest", async () => {
    const account = await t.createUser("member", "Linked");
    const leaving = await memberWithHistory(account);
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    await erase(owner, leaving.memberId, leaving.code.toLowerCase());

    const profile = await one<{ role: string }>(
      "select role from public.profiles where id = $1",
      [account],
    );
    expect(profile.role).toBe("guest");
  });

  it("keeps a staff account's role", async () => {
    const trainer = await t.createUser("trainer", "Trains here too");
    const leaving = await memberWithHistory(trainer);
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    await erase(owner, leaving.memberId, leaving.code);

    const profile = await one<{ role: string }>(
      "select role from public.profiles where id = $1",
      [trainer],
    );
    expect(profile.role).toBe("trainer");
  });
});

describe("what stops an erase", () => {
  it("is owner only", async () => {
    const leaving = await memberWithHistory();
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    expect(
      await rejectionMessage(erase(manager, leaving.memberId, leaving.code)),
    ).toMatch(/Only the owner/);
    expect(await rowsMentioning(leaving.memberId)).not.toEqual([]);
  });

  it("needs the member marked inactive first", async () => {
    const leaving = await memberWithHistory();
    expect(
      await rejectionMessage(erase(owner, leaving.memberId, leaving.code)),
    ).toMatch(/Mark the member inactive/);
  });

  it("needs their member ID typed exactly", async () => {
    const leaving = await memberWithHistory();
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    expect(
      await rejectionMessage(erase(owner, leaving.memberId, "IP-9999")),
    ).toMatch(new RegExp(`Type ${leaving.code} exactly`));
  });

  it("gives an app user nothing for setting the erase flag by hand", async () => {
    const leaving = await memberWithHistory();
    const message = await rejectionMessage(
      withUserContext(t.db, owner, async (tx) => {
        await tx.execute(
          sql`select set_config('app.erasing_member', ${leaving.memberId}, true)`,
        );
        await tx.execute(
          sql`delete from public.payments where member_id = ${leaving.memberId}`,
        );
      }),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("still keeps the ledger and audit log append-only for everyone else", async () => {
    const leaving = await memberWithHistory();
    for (const statement of [
      "delete from public.payments where member_id = $1",
      "delete from public.members where id = $1",
      "delete from public.audit_log where record_id = $1::text",
    ]) {
      expect(
        await rejectionMessage(t.client.query(statement, [leaving.memberId])),
      ).toMatch(/append-only/);
    }
  });

  it("does not leave the flag set for the rest of the transaction", async () => {
    const leaving = await memberWithHistory();
    const other = await memberWithHistory();
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [leaving.memberId],
    );
    const message = await rejectionMessage(
      t.client.transaction(async (tx) => {
        await tx.query("select set_config('role', 'authenticated', true)");
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: owner, role: "authenticated" }),
        ]);
        await tx.query("select public.erase_member($1, $2)", [
          leaving.memberId,
          leaving.code,
        ]);
        await tx.query("reset role");
        await tx.query("delete from public.payments where member_id = $1", [
          other.memberId,
        ]);
      }),
    );
    expect(message).toMatch(/append-only/);
  });
});
