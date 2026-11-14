// Phase 2 rules (brief §4.2): negotiated fees, freezes, guest linking and
// settings, checked against the real migrations through withUserContext.
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  gymSettings,
  members,
  membershipFees,
  membershipFreezes,
  memberships,
  plans,
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
let alice: string;
let bob: string;
let aliceMembership: string;
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

/** Adds a member with a membership and fee the way the app does, as a manager. */
async function addMemberAsManager(
  name: string,
  feePaise: number,
  profileId?: string,
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
      feePaise,
      effectiveFrom: "2026-03-12",
      setBy: manager,
    });
    return {
      memberId: member.id,
      membershipId: membership.id,
      code: member.code,
    };
  });
  if (profileId) {
    await t.client.query(
      "update public.members set profile_id = $1 where id = $2",
      [profileId, ids.memberId],
    );
  }
  return ids;
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
  alice = await t.createUser("member", "Alice");
  bob = await t.createUser("member", "Bob");
  aliceMembership = (await addMemberAsManager("Alice", 60000, alice))
    .membershipId;
  bobMembership = (await addMemberAsManager("Bob", 50000, bob)).membershipId;
}, 60_000);

describe("adding members", () => {
  it("gives each new member a readable ID in sequence", async () => {
    const first = await addMemberAsManager("First", 60000);
    const second = await addMemberAsManager("Second", 60000);
    expect(first.code).toMatch(/^IP-\d{4}$/);
    expect(Number(second.code.slice(3))).toBe(Number(first.code.slice(3)) + 1);
  });

  it("does not let staff attach an account directly, skipping the role change", async () => {
    const guest = await t.createUser("guest");
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.insert(members).values({
          fullName: "Sneaky",
          phone: "9876543210",
          profileId: guest,
          createdBy: manager,
        }),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("allows only one open membership per member", async () => {
    const [aliceMember] = await as(manager, (tx) =>
      tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.profileId, alice)),
    );
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.insert(memberships).values({
          memberId: aliceMember.id,
          startsOn: "2026-05-01",
          createdBy: manager,
        }),
      ),
    );
    expect(message).toMatch(/memberships_one_open_per_member/);
  });

  it("is not open to trainers", async () => {
    const message = await rejectionMessage(
      as(trainer, (tx) =>
        tx
          .insert(members)
          .values({ fullName: "X", phone: "9876543210", createdBy: trainer }),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });
});

describe("agreed fees", () => {
  it("are hidden from trainers", async () => {
    expect(await as(trainer, (tx) => tx.select().from(membershipFees))).toEqual(
      [],
    );
  });

  it("are visible to a member for their own membership only", async () => {
    const rows = await as(alice, (tx) => tx.select().from(membershipFees));
    expect(rows.map((row) => row.membershipId)).toEqual([aliceMembership]);
  });

  it("can be set by a manager but not by a trainer or member", async () => {
    await as(manager, (tx) =>
      tx.insert(membershipFees).values({
        membershipId: aliceMembership,
        feePaise: 55000,
        effectiveFrom: "2026-06-12",
        setBy: manager,
      }),
    );
    for (const user of [trainer, alice]) {
      const message = await rejectionMessage(
        as(user, (tx) =>
          tx.insert(membershipFees).values({
            membershipId: aliceMembership,
            feePaise: 0,
            effectiveFrom: "2026-06-12",
            setBy: user,
          }),
        ),
      );
      expect(message).toMatch(/row-level security/);
    }
  });

  it("are never edited in place, even by the owner", async () => {
    const message = await rejectionMessage(
      as(owner, (tx) =>
        tx
          .update(membershipFees)
          .set({ feePaise: 1 })
          .where(eq(membershipFees.membershipId, bobMembership)),
      ),
    );
    expect(message).toMatch(/permission denied/);
    expect(
      await rejectionMessage(
        t.client.query(
          "delete from public.membership_fees where membership_id = $1",
          [bobMembership],
        ),
      ),
    ).toMatch(/append-only/);
  });

  it("are audited", async () => {
    const result = await t.client.query<{ n: number }>(
      "select count(*)::int as n from public.audit_log where table_name = 'membership_fees'",
    );
    expect(result.rows[0].n).toBeGreaterThan(0);
  });
});

describe("freezes", () => {
  it("can be added and ended by a manager", async () => {
    const [freeze] = await as(manager, (tx) =>
      tx
        .insert(membershipFreezes)
        .values({
          membershipId: bobMembership,
          startsOn: "2026-04-01",
          createdBy: manager,
        })
        .returning({ id: membershipFreezes.id }),
    );
    await as(manager, (tx) =>
      tx
        .update(membershipFreezes)
        .set({ endsOn: "2026-04-10" })
        .where(eq(membershipFreezes.id, freeze.id)),
    );
    const [row] = await as(trainer, (tx) =>
      tx
        .select()
        .from(membershipFreezes)
        .where(eq(membershipFreezes.id, freeze.id)),
    );
    expect(row.endsOn).toBe("2026-04-10");
  });

  it("cannot overlap another freeze on the same membership", async () => {
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.insert(membershipFreezes).values({
          membershipId: bobMembership,
          startsOn: "2026-04-05",
          endsOn: "2026-04-20",
          createdBy: manager,
        }),
      ),
    );
    expect(message).toMatch(/overlaps another freeze/);
  });

  it("cannot be added by a trainer", async () => {
    const message = await rejectionMessage(
      as(trainer, (tx) =>
        tx.insert(membershipFreezes).values({
          membershipId: aliceMembership,
          startsOn: "2026-07-01",
          createdBy: trainer,
        }),
      ),
    );
    expect(message).toMatch(/row-level security/);
  });

  it("are not visible to other members", async () => {
    expect(
      await as(alice, (tx) => tx.select().from(membershipFreezes)),
    ).toEqual([]);
  });
});

describe("linking a waiting guest", () => {
  it("makes the guest a member and retires any open claim link", async () => {
    const guest = await t.createUser("guest");
    const { memberId } = await addMemberAsManager("Walk-in", 60000);
    await as(manager, (tx) =>
      tx.execute(
        sql`select public.issue_claim_token(${memberId}, ${"t".repeat(43)})`,
      ),
    );

    await as(manager, (tx) =>
      tx.execute(
        sql`select public.link_guest_to_member(${guest}, ${memberId})`,
      ),
    );

    const [profile] = await as(guest, (tx) => tx.select().from(profiles));
    expect(profile.role).toBe("member");
    const [member] = await as(guest, (tx) => tx.select().from(members));
    expect(member.id).toBe(memberId);
    const open = await t.client.query(
      "select 1 from public.claim_tokens where member_id = $1 and used_at is null and revoked_at is null",
      [memberId],
    );
    expect(open.rows).toEqual([]);
  });

  it("refuses accounts that are not waiting guests", async () => {
    const { memberId } = await addMemberAsManager("Someone", 60000);
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.execute(
          sql`select public.link_guest_to_member(${trainer}, ${memberId})`,
        ),
      ),
    );
    expect(message).toMatch(/not a waiting guest/);
  });

  it("refuses a member record that already has an account", async () => {
    const guest = await t.createUser("guest");
    const [aliceMember] = await as(manager, (tx) =>
      tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.profileId, alice)),
    );
    const message = await rejectionMessage(
      as(manager, (tx) =>
        tx.execute(
          sql`select public.link_guest_to_member(${guest}, ${aliceMember.id})`,
        ),
      ),
    );
    expect(message).toMatch(/already has an account/);
  });

  it("is not available to trainers", async () => {
    const guest = await t.createUser("guest");
    const { memberId } = await addMemberAsManager("Other", 60000);
    const message = await rejectionMessage(
      as(trainer, (tx) =>
        tx.execute(
          sql`select public.link_guest_to_member(${guest}, ${memberId})`,
        ),
      ),
    );
    expect(message).toMatch(/Only the owner or a manager/);
  });
});

describe("plans and settings belong to the owner", () => {
  it("lets the owner add a plan and change the gone-quiet window", async () => {
    await as(owner, (tx) =>
      tx
        .insert(plans)
        .values({ name: "Monthly", durationMonths: 1, defaultFeePaise: 60000 }),
    );
    await as(owner, (tx) => tx.update(gymSettings).set({ goneQuietDays: 45 }));
    const [settings] = await as(manager, (tx) => tx.select().from(gymSettings));
    expect(settings.goneQuietDays).toBe(45);
  });

  it("does not let a manager change plans or settings", async () => {
    expect(
      await rejectionMessage(
        as(manager, (tx) =>
          tx
            .insert(plans)
            .values({ name: "Cheap", durationMonths: 1, defaultFeePaise: 1 }),
        ),
      ),
    ).toMatch(/row-level security/);

    await as(manager, (tx) => tx.update(gymSettings).set({ goneQuietDays: 7 }));
    const [settings] = await as(owner, (tx) => tx.select().from(gymSettings));
    expect(settings.goneQuietDays).toBe(45);
  });
});
