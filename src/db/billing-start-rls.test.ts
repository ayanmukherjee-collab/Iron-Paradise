// Dues follow the first payment (memberships.billing_starts_on), checked
// against the real migrations through withUserContext, as the app runs.
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

function as<T>(userId: string, run: Parameters<typeof withUserContext<T>>[2]) {
  return withUserContext(t.db, userId, run);
}

/** A new member who joined on 6 Jan 2026, with their open membership. */
async function joinOnJan6() {
  const memberId = await t.createMember();
  const result = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-01-06') returning id",
    [memberId],
  );
  return { memberId, membershipId: result.rows[0].id };
}

function pay(
  member: { memberId: string; membershipId: string },
  paidOn: string,
  firstPeriod = 0,
) {
  return as(manager, async (tx) => {
    const [row] = await tx
      .insert(payments)
      .values({
        memberId: member.memberId,
        membershipId: member.membershipId,
        firstPeriod,
        amountPaise: 60000,
        method: "cash",
        paidOn,
        recordedBy: manager,
      })
      .returning({ id: payments.id });
    return row.id;
  });
}

function voidPayment(paymentId: string) {
  return as(owner, (tx) =>
    tx
      .insert(paymentVoids)
      .values({ paymentId, reason: "Wrong date", voidedBy: owner }),
  );
}

function billingStart(userId: string, membershipId: string) {
  return as(userId, async (tx) => {
    const [row] = await tx
      .select({ billingStartsOn: memberships.billingStartsOn })
      .from(memberships)
      .where(eq(memberships.id, membershipId));
    return row?.billingStartsOn ?? null;
  });
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
}, 60_000);

describe("the first payment sets the monthly due day", () => {
  it("is empty until the member first pays", async () => {
    const member = await joinOnJan6();
    expect(await billingStart(owner, member.membershipId)).toBeNull();
  });

  it("joined 6 Jan, first paid 8 Jan: dues fall on the 8th", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-08");
    expect(await billingStart(manager, member.membershipId)).toBe("2026-01-08");
  });

  it("is not moved by later payments, even late ones", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-08");
    await pay(member, "2026-02-11", 1);
    expect(await billingStart(owner, member.membershipId)).toBe("2026-01-08");
  });

  it("never falls before the joining day", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-02");
    expect(await billingStart(owner, member.membershipId)).toBe("2026-01-06");
  });

  it("moves to the corrected date when the first payment is voided", async () => {
    const member = await joinOnJan6();
    const typo = await pay(member, "2026-01-18");
    await voidPayment(typo);
    expect(await billingStart(owner, member.membershipId)).toBeNull();
    await pay(member, "2026-01-08");
    expect(await billingStart(owner, member.membershipId)).toBe("2026-01-08");
  });

  it("is visible to trainers, who see due dates but not payments", async () => {
    const member = await joinOnJan6();
    await pay(member, "2026-01-08");
    expect(await billingStart(trainer, member.membershipId)).toBe("2026-01-08");
  });

  it("cannot be set by hand, even by the owner", async () => {
    const member = await joinOnJan6();
    await expect(
      as(owner, (tx) =>
        tx
          .update(memberships)
          .set({ billingStartsOn: "2026-01-20" })
          .where(eq(memberships.id, member.membershipId)),
      ),
    ).rejects.toThrow();
  });
});
