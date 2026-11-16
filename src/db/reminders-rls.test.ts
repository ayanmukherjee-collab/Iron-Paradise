// Phase 5 rules (brief §4.6): the reminder log and push subscriptions,
// checked against the real migrations through withUserContext.
import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notifications, pushSubscriptions } from "@/db/schema";
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
let guest: string;
let aliceMember: string;
let aliceMembership: string;

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

function whatsApp(
  sentBy: string,
  fields: Partial<typeof notifications.$inferInsert> = {},
) {
  return as(sentBy, (tx) =>
    tx.insert(notifications).values({
      memberId: aliceMember,
      membershipId: aliceMembership,
      period: 2,
      stage: "overdue",
      channel: "whatsapp",
      status: "sent",
      dueOn: "2026-05-12",
      amountPaise: 60000,
      sentBy,
      ...fields,
    }),
  );
}

const endpoint = "https://fcm.googleapis.com/fcm/send/device-1";
const p256dh = "B".padEnd(87, "A");
const auth = "A".repeat(22);

function subscribe(userId: string, at = endpoint) {
  return as(userId, (tx) =>
    tx.execute(
      sql`select public.save_push_subscription(${at}, ${p256dh}, ${auth})`,
    ),
  );
}

async function subscriptionOwners(): Promise<string[]> {
  const result = await t.client.query<{ profile_id: string }>(
    "select profile_id from public.push_subscriptions order by created_at",
  );
  return result.rows.map((row) => row.profile_id);
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
  alice = await t.createUser("member", "Alice");
  bob = await t.createUser("member", "Bob");
  guest = await t.createUser("guest");
  aliceMember = await t.createMember({ profileId: alice, name: "Alice" });
  await t.createMember({ profileId: bob, name: "Bob" });
  const result = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-03-12') returning id",
    [aliceMember],
  );
  aliceMembership = result.rows[0].id;
}, 60_000);

beforeEach(async () => {
  await t.client.query(
    "alter table public.notifications disable trigger notifications_never_deleted",
  );
  await t.client.query("delete from public.notifications");
  await t.client.query(
    "alter table public.notifications enable trigger notifications_never_deleted",
  );
  await t.client.query("delete from public.push_subscriptions");
});

describe("the reminder log", () => {
  it("lets the owner and managers log a WhatsApp they sent, and read the log", async () => {
    await whatsApp(manager);
    await whatsApp(owner, { stage: "due_today" });
    const rows = await as(owner, (tx) => tx.select().from(notifications));
    expect(rows).toHaveLength(2);
  });

  it("never logs the same reminder twice", async () => {
    await whatsApp(manager);
    expect(await rejectionMessage(whatsApp(owner))).toMatch(
      /notifications_once/,
    );
  });

  it("keeps members and trainers out", async () => {
    await whatsApp(manager);
    for (const reader of [alice, trainer, guest]) {
      expect(await as(reader, (tx) => tx.select().from(notifications))).toEqual(
        [],
      );
    }
    for (const writer of [alice, trainer]) {
      expect(
        await rejectionMessage(whatsApp(writer, { stage: "due_soon" })),
      ).toMatch(/row-level security|permission denied/);
    }
  });

  it("lets staff log only WhatsApp messages, in their own name", async () => {
    expect(
      await rejectionMessage(whatsApp(manager, { channel: "push" })),
    ).toMatch(/row-level security/);
    expect(
      await rejectionMessage(whatsApp(manager, { sentBy: owner })),
    ).toMatch(/row-level security/);
  });

  it("is append-only: no edits or deletes, even by the owner", async () => {
    await whatsApp(manager);
    expect(
      await rejectionMessage(
        as(owner, (tx) => tx.update(notifications).set({ amountPaise: 1 })),
      ),
    ).toMatch(/permission denied/);
    expect(
      await rejectionMessage(as(owner, (tx) => tx.delete(notifications))),
    ).toMatch(/permission denied/);
    expect(
      await rejectionMessage(
        t.client.query("delete from public.notifications"),
      ),
    ).toMatch(/append-only/);
  });

  it("lets the job settle its own 'sending' row once, and nothing else", async () => {
    const result = await t.client.query<{ id: string }>(
      `insert into public.notifications
         (member_id, membership_id, period, stage, channel, due_on, amount_paise)
       values ($1, $2, 2, 'due_soon', 'push', '2026-05-12', 60000) returning id`,
      [aliceMember, aliceMembership],
    );
    const id = result.rows[0].id;

    await t.client.query(
      "update public.notifications set status = 'sent' where id = $1",
      [id],
    );
    expect(
      await rejectionMessage(
        t.client.query(
          "update public.notifications set status = 'failed' where id = $1",
          [id],
        ),
      ),
    ).toMatch(/append-only/);
    expect(
      await rejectionMessage(
        t.client.query(
          "update public.notifications set amount_paise = 1 where id = $1",
          [id],
        ),
      ),
    ).toMatch(/append-only/);
  });

  it("refuses a WhatsApp log that points at another member's membership", async () => {
    const otherMember = await t.createMember({ name: "Someone else" });
    expect(
      await rejectionMessage(whatsApp(manager, { memberId: otherMember })),
    ).toMatch(/foreign key/);
  });
});

describe("push subscriptions", () => {
  it("are saved for the signed-in member and readable only by them", async () => {
    await subscribe(alice);
    expect(await subscriptionOwners()).toEqual([alice]);

    const own = await as(alice, (tx) =>
      tx
        .select({ endpoint: pushSubscriptions.endpoint })
        .from(pushSubscriptions),
    );
    expect(own).toEqual([{ endpoint }]);
    for (const other of [bob, owner, manager]) {
      expect(
        await as(other, (tx) =>
          tx
            .select({ endpoint: pushSubscriptions.endpoint })
            .from(pushSubscriptions),
        ),
      ).toEqual([]);
    }
  });

  it("never hand the encryption keys back to the browser", async () => {
    await subscribe(alice);
    expect(
      await rejectionMessage(
        as(alice, (tx) =>
          tx.select({ key: pushSubscriptions.p256dh }).from(pushSubscriptions),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("move to whoever signs in on the same browser next", async () => {
    await subscribe(alice);
    await subscribe(bob);
    expect(await subscriptionOwners()).toEqual([bob]);
  });

  it("can only be removed by their owner", async () => {
    await subscribe(alice);
    await as(bob, (tx) => tx.delete(pushSubscriptions));
    expect(await subscriptionOwners()).toEqual([alice]);
    await as(alice, (tx) =>
      tx
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint)),
    );
    expect(await subscriptionOwners()).toEqual([]);
  });

  it("are not for guests, and can't be inserted directly", async () => {
    expect(await rejectionMessage(subscribe(guest))).toBe(
      "Only gym members can turn on reminders",
    );
    expect(
      await rejectionMessage(
        as(alice, (tx) =>
          tx
            .insert(pushSubscriptions)
            .values({ profileId: alice, endpoint, p256dh, auth }),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("reminder consent", () => {
  it("can be recorded by the owner and managers, not by the member", async () => {
    await as(manager, (tx) =>
      tx.execute(
        sql`update public.members set reminder_consent_at = now() where id = ${aliceMember}`,
      ),
    );
    const result = await t.client.query<{ set: boolean }>(
      "select reminder_consent_at is not null as set from public.members where id = $1",
      [aliceMember],
    );
    expect(result.rows[0].set).toBe(true);

    await as(alice, (tx) =>
      tx.execute(
        sql`update public.members set reminder_consent_at = null where id = ${aliceMember}`,
      ),
    );
    const after = await t.client.query<{ set: boolean }>(
      "select reminder_consent_at is not null as set from public.members where id = $1",
      [aliceMember],
    );
    expect(after.rows[0].set).toBe(true);
  });
});
