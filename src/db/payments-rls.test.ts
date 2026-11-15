// Phase 3 ledger rules (brief §4.4), checked against the real migrations
// through withUserContext, the same path the app uses.
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { memberships, paymentVoids, payments } from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;
let alice: string;
let aliceMember: string;
let aliceMembership: string;
let bobMember: string;
let bobMembership: string;

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
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-03-12') returning id",
    [memberId],
  );
  return result.rows[0].id;
}

function record(
  userId: string,
  fields: Partial<typeof payments.$inferInsert> = {},
) {
  return as(userId, async (tx) => {
    const [row] = await tx
      .insert(payments)
      .values({
        memberId: aliceMember,
        membershipId: aliceMembership,
        firstPeriod: 0,
        amountPaise: 60000,
        method: "cash",
        paidOn: "2026-03-12",
        recordedBy: userId,
        ...fields,
      })
      .returning({ id: payments.id });
    return row.id;
  });
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
  alice = await t.createUser("member", "Alice");
  aliceMember = await t.createMember({ profileId: alice, name: "Alice" });
  bobMember = await t.createMember({ name: "Bob" });
  aliceMembership = await startMembership(aliceMember);
  bobMembership = await startMembership(bobMember);
}, 60_000);

describe("a payment belongs to one of the member's own memberships", () => {
  it("rejects a payment filed against another member's membership", async () => {
    const message = await rejectionMessage(
      record(manager, { membershipId: bobMembership }),
    );
    expect(message).toMatch(/payments_membership_matches_member/);
  });

  it("rejects a negative period and an absurd amount", async () => {
    expect(
      await rejectionMessage(record(manager, { firstPeriod: -1 })),
    ).toMatch(/check constraint/);
    expect(
      await rejectionMessage(record(manager, { amountPaise: 20_000_000 })),
    ).toMatch(/payments_amount_cap/);
  });
});

describe("corrections", () => {
  it("lets only the owner record a correction", async () => {
    const original = await record(manager);
    await as(owner, (tx) =>
      tx
        .insert(paymentVoids)
        .values({ paymentId: original, reason: "Wrong", voidedBy: owner }),
    );
    const message = await rejectionMessage(
      record(manager, { replacesPaymentId: original }),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("refuses a correction while the old payment still counts", async () => {
    const original = await record(manager);
    const message = await rejectionMessage(
      record(owner, { replacesPaymentId: original }),
    );
    expect(message).toMatch(/Void the old payment/);
  });

  it("voids and replaces in one transaction for the owner", async () => {
    const original = await record(manager, { amountPaise: 6000 });
    const replacement = await as(owner, async (tx) => {
      await tx.insert(paymentVoids).values({
        paymentId: original,
        reason: "Typed ₹60 instead of ₹600",
        voidedBy: owner,
      });
      const [row] = await tx
        .insert(payments)
        .values({
          memberId: aliceMember,
          membershipId: aliceMembership,
          firstPeriod: 0,
          amountPaise: 60000,
          method: "cash",
          paidOn: "2026-03-12",
          replacesPaymentId: original,
          recordedBy: owner,
        })
        .returning({ id: payments.id });
      return row.id;
    });
    expect(replacement).toBeTruthy();
  });

  it("cannot void the same payment twice", async () => {
    const original = await record(manager);
    const voidIt = () =>
      as(owner, (tx) =>
        tx
          .insert(paymentVoids)
          .values({ paymentId: original, reason: "Twice", voidedBy: owner }),
      );
    await voidIt();
    expect(await rejectionMessage(voidIt())).toMatch(/duplicate key/);
  });
});

describe("who sees voids", () => {
  it("shows a member the voids on their own payments only", async () => {
    const bobPayment = await record(manager, {
      memberId: bobMember,
      membershipId: bobMembership,
    });
    await as(owner, (tx) =>
      tx
        .insert(paymentVoids)
        .values({ paymentId: bobPayment, reason: "Wrong", voidedBy: owner }),
    );
    const seen = await as(alice, (tx) =>
      tx
        .select()
        .from(paymentVoids)
        .where(eq(paymentVoids.paymentId, bobPayment)),
    );
    expect(seen).toEqual([]);
  });

  it("shows trainers no voids at all", async () => {
    const rows = await as(trainer, (tx) => tx.select().from(paymentVoids));
    expect(rows).toEqual([]);
  });
});

describe("due dates cannot be moved after the fact", () => {
  it("does not let a manager change a membership's start date", async () => {
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx
          .update(memberships)
          .set({ startsOn: "2026-03-01" })
          .where(eq(memberships.id, aliceMembership)),
      ),
    );
    expect(message).toMatch(/permission denied/);
  });
});
