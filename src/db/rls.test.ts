// Security requirements from section 8 of the brief, checked against the real
// migrations and policies. Every query runs through withUserContext, the same
// path production code uses.
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  attendance,
  auditLog,
  members,
  paymentVoids,
  payments,
  profiles,
} from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;
let guest: string;
let alice: string;
let bob: string;
let aliceMember: string;
let bobMember: string;
let bobPayment: string;
const membershipOf = new Map<string, string>();

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

async function startMembership(memberId: string) {
  const result = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-11-01') returning id",
    [memberId],
  );
  membershipOf.set(memberId, result.rows[0].id);
}

async function insertPaymentAsOwner(memberId: string) {
  const result = await t.client.query<{ id: string }>(
    `insert into public.payments (member_id, membership_id, first_period, amount_paise, method, paid_on, recorded_by)
     values ($1, $2, 0, 150000, 'cash', '2026-11-01', $3) returning id`,
    [memberId, membershipOf.get(memberId), owner],
  );
  return result.rows[0].id;
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
  guest = await t.createUser("guest");
  alice = await t.createUser("member", "Alice");
  bob = await t.createUser("member", "Bob");
  aliceMember = await t.createMember({ profileId: alice, name: "Alice" });
  bobMember = await t.createMember({ profileId: bob, name: "Bob" });
  await startMembership(aliceMember);
  await startMembership(bobMember);
  bobPayment = await insertPaymentAsOwner(bobMember);
  await t.client.query(
    "insert into public.attendance (member_id, method, marked_by) values ($1, 'manual', $2)",
    [bobMember, trainer],
  );
}, 60_000);

describe("a member cannot see another member's data", () => {
  it("sees only their own profile", async () => {
    const rows = await as(alice, (tx) => tx.select().from(profiles));
    expect(rows.map((row) => row.id)).toEqual([alice]);
  });

  it("sees only their own member record", async () => {
    const rows = await as(alice, (tx) => tx.select().from(members));
    expect(rows.map((row) => row.id)).toEqual([aliceMember]);
  });

  it("cannot read another member's payments", async () => {
    const rows = await as(alice, (tx) =>
      tx.select().from(payments).where(eq(payments.memberId, bobMember)),
    );
    expect(rows).toEqual([]);
  });

  it("cannot read another member's attendance", async () => {
    const rows = await as(alice, (tx) =>
      tx.select().from(attendance).where(eq(attendance.memberId, bobMember)),
    );
    expect(rows).toEqual([]);
  });

  it("can read their own payments", async () => {
    const rows = await as(bob, (tx) => tx.select().from(payments));
    expect(rows.map((row) => row.id)).toEqual([bobPayment]);
  });
});

describe("a trainer has no payment write access", () => {
  it("cannot create a payment", async () => {
    const message = await rejectionMessage(
      as(trainer, (tx) =>
        tx.insert(payments).values({
          memberId: aliceMember,
          membershipId: membershipOf.get(aliceMember)!,
          firstPeriod: 0,
          amountPaise: 100000,
          method: "cash",
          paidOn: "2026-11-02",
          recordedBy: trainer,
        }),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("cannot void a payment", async () => {
    const message = await rejectionMessage(
      as(trainer, (tx) =>
        tx.insert(paymentVoids).values({
          paymentId: bobPayment,
          reason: "wrong",
          voidedBy: trainer,
        }),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("cannot edit a payment", async () => {
    const message = await rejectionMessage(
      as(trainer, (tx) =>
        tx
          .update(payments)
          .set({ amountPaise: 1 })
          .where(eq(payments.id, bobPayment)),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("cannot read payment details", async () => {
    const rows = await as(trainer, (tx) => tx.select().from(payments));
    expect(rows).toEqual([]);
  });
});

describe("a manager cannot change roles or void payments", () => {
  it("cannot change a role through the role function", async () => {
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.execute(sql`select public.set_user_role(${trainer}, 'owner')`),
      ),
    );
    expect(message).toMatch(/Only the owner can change roles/);
  });

  it("cannot change a role by writing the column", async () => {
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx
          .update(profiles)
          .set({ role: "owner" })
          .where(eq(profiles.id, manager)),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });

  it("cannot void a payment", async () => {
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.insert(paymentVoids).values({
          paymentId: bobPayment,
          reason: "wrong",
          voidedBy: manager,
        }),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("can record a payment", async () => {
    const [row] = await as(manager, (tx) =>
      tx
        .insert(payments)
        .values({
          memberId: aliceMember,
          membershipId: membershipOf.get(aliceMember)!,
          firstPeriod: 0,
          amountPaise: 120000,
          method: "upi",
          paidOn: "2026-11-03",
          recordedBy: manager,
        })
        .returning({ id: payments.id }),
    );
    expect(row.id).toBeTruthy();
  });
});

describe("members and guests cannot change their own role", () => {
  for (const [label, user] of [
    ["member", () => alice],
    ["guest", () => guest],
  ] as const) {
    it(`a ${label} cannot write their role column`, async () => {
      const message = await rejectionMessage(
        as(user(), (tx) =>
          tx
            .update(profiles)
            .set({ role: "owner" })
            .where(eq(profiles.id, user())),
        ),
      );
      expect(message).toMatch(/permission denied/);
    });

    it(`a ${label} cannot call the role function`, async () => {
      const message = await rejectionMessage(
        as(user(), (tx) =>
          tx.execute(sql`select public.set_user_role(${user()}, 'owner')`),
        ),
      );
      expect(message).toMatch(/Only the owner/);
    });
  }

  it("a member can still edit their display name", async () => {
    await as(alice, (tx) =>
      tx
        .update(profiles)
        .set({ fullName: "Alice K" })
        .where(eq(profiles.id, alice)),
    );
    const [row] = await as(alice, (tx) => tx.select().from(profiles));
    expect(row.fullName).toBe("Alice K");
    expect(row.role).toBe("member");
  });
});

describe("the owner manages roles and payments", () => {
  it("can change a staff role, and the change is audited", async () => {
    const promoted = await t.createUser("trainer");
    await as(owner, (tx) =>
      tx.execute(sql`select public.set_user_role(${promoted}, 'manager')`),
    );
    const [row] = await as(owner, (tx) =>
      tx.select().from(profiles).where(eq(profiles.id, promoted)),
    );
    expect(row.role).toBe("manager");

    const entries = await as(owner, (tx) =>
      tx
        .select()
        .from(auditLog)
        .where(
          and(eq(auditLog.recordId, promoted), eq(auditLog.actorId, owner)),
        ),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].before).toMatchObject({ role: "trainer" });
    expect(entries[0].after).toMatchObject({ role: "manager" });
  });

  it("can void a payment", async () => {
    const paymentId = await insertPaymentAsOwner(aliceMember);
    await as(owner, (tx) =>
      tx
        .insert(paymentVoids)
        .values({ paymentId, reason: "Entered twice", voidedBy: owner }),
    );
    const voids = await as(owner, (tx) =>
      tx
        .select()
        .from(paymentVoids)
        .where(eq(paymentVoids.paymentId, paymentId)),
    );
    expect(voids).toHaveLength(1);
  });

  it("cannot edit or delete a payment, even as owner", async () => {
    expect(
      await rejectionMessage(
        as(owner, (tx) =>
          tx
            .update(payments)
            .set({ amountPaise: 1 })
            .where(eq(payments.id, bobPayment)),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await rejectionMessage(
        t.client.query("delete from public.payments where id = $1", [
          bobPayment,
        ]),
      ),
    ).toMatch(/append-only/);
  });
});

describe("the audit log is append-only", () => {
  it("rejects updates and deletes from a privileged connection", async () => {
    expect(
      await rejectionMessage(
        t.client.query("update public.audit_log set action = 'insert'"),
      ),
    ).toMatch(/append-only/);
    expect(
      await rejectionMessage(t.client.query("delete from public.audit_log")),
    ).toMatch(/append-only/);
    expect(
      await rejectionMessage(t.client.query("truncate public.audit_log")),
    ).toMatch(/append-only/);
  });

  it("is hidden from trainers and members", async () => {
    expect(await as(trainer, (tx) => tx.select().from(auditLog))).toEqual([]);
    expect(await as(alice, (tx) => tx.select().from(auditLog))).toEqual([]);
  });
});

describe("deactivated staff lose access immediately", () => {
  it("sees nothing once the owner deactivates them, and their sessions are gone", async () => {
    const leaving = await t.createUser("manager");
    await t.client.query("insert into auth.sessions (user_id) values ($1)", [
      leaving,
    ]);
    expect(await as(leaving, (tx) => tx.select().from(members))).not.toEqual(
      [],
    );

    await as(owner, (tx) =>
      tx.execute(sql`select public.set_user_active(${leaving}, false)`),
    );

    expect(await as(leaving, (tx) => tx.select().from(members))).toEqual([]);
    const sessions = await t.client.query(
      "select 1 from auth.sessions where user_id = $1",
      [leaving],
    );
    expect(sessions.rows).toEqual([]);
  });
});

describe("owner bootstrap", () => {
  it("cannot be called by a signed-in user to seize ownership", async () => {
    const message = await rejectionMessage(
      as(guest, (tx) =>
        tx.execute(sql`select public.bootstrap_owner('anyone@example.test')`),
      ),
    );
    expect(message).toMatch(/permission denied for function/);
  });

  it("refuses to run once an owner exists, even from the SQL editor", async () => {
    expect(
      await rejectionMessage(
        t.client.query("select public.bootstrap_owner($1)", [
          `${guest}@example.test`,
        ]),
      ),
    ).toMatch(/An owner already exists/);
  });
});

describe("claim links", () => {
  async function issueToken(memberId: string) {
    const token = crypto.randomUUID() + crypto.randomUUID();
    await as(manager, (tx) =>
      tx.execute(sql`select public.issue_claim_token(${memberId}, ${token})`),
    );
    return token;
  }

  function redeem(userId: string, token: string) {
    return as(userId, (tx) =>
      tx.execute(sql`select public.redeem_claim_token(${token})`),
    );
  }

  it("links a guest to the member record and makes them a member", async () => {
    const newcomer = await t.createUser("guest");
    const memberId = await t.createMember({ name: "Newcomer" });
    await redeem(newcomer, await issueToken(memberId));

    const [member] = await as(newcomer, (tx) => tx.select().from(members));
    expect(member.id).toBe(memberId);
    const [profile] = await as(newcomer, (tx) => tx.select().from(profiles));
    expect(profile.role).toBe("member");
  });

  it("rejects a link that was already used", async () => {
    const first = await t.createUser("guest");
    const second = await t.createUser("guest");
    const token = await issueToken(await t.createMember());
    await redeem(first, token);
    expect(await rejectionMessage(redeem(second, token))).toMatch(
      /expired or was already used/,
    );
  });

  it("rejects an expired link", async () => {
    const memberId = await t.createMember();
    const token = await issueToken(memberId);
    await t.client.query(
      "update public.claim_tokens set expires_at = now() - interval '1 minute' where member_id = $1",
      [memberId],
    );
    expect(
      await rejectionMessage(redeem(await t.createUser("guest"), token)),
    ).toMatch(/expired or was already used/);
  });

  it("rejects the old link after staff regenerate it", async () => {
    const memberId = await t.createMember();
    const oldToken = await issueToken(memberId);
    await issueToken(memberId);
    expect(
      await rejectionMessage(redeem(await t.createUser("guest"), oldToken)),
    ).toMatch(/expired or was already used/);
  });

  it("stores only a hash of the token", async () => {
    const memberId = await t.createMember();
    const token = await issueToken(memberId);
    const stored = await t.client.query<{ token_hash: Uint8Array }>(
      "select token_hash from public.claim_tokens where member_id = $1",
      [memberId],
    );
    expect(
      Buffer.from(stored.rows[0].token_hash).toString("utf8"),
    ).not.toContain(token);
    expect(stored.rows[0].token_hash).toHaveLength(32);
  });

  it("cannot be issued by a trainer", async () => {
    const memberId = await t.createMember();
    expect(
      await rejectionMessage(
        as(trainer, (tx) =>
          tx.execute(
            sql`select public.issue_claim_token(${memberId}, ${"x".repeat(40)})`,
          ),
        ),
      ),
    ).toMatch(/Only the owner or a manager/);
  });
});

describe("anonymous requests", () => {
  it("cannot read any table", async () => {
    for (const table of [
      "profiles",
      "members",
      "payments",
      "attendance",
      "audit_log",
      "claim_tokens",
    ]) {
      const message = await rejectionMessage(
        t.client.transaction(async (tx) => {
          await tx.exec("set local role anon");
          await tx.query(`select * from public.${table}`);
        }),
      );
      expect(message).toMatch(/permission denied/);
    }
  });
});
