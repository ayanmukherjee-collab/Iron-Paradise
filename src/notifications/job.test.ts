// The daily reminder run (brief §4.6) against the real migrations, with
// stand-in channels that record what they were asked to send.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import type {
  Channel,
  Delivery,
  Recipient,
} from "@/notifications/channels/types";

vi.mock("server-only", () => ({}));

const { runReminders } = await import("@/notifications/job");

let t: TestDatabase;
let owner: string;
const people: Record<string, { memberId: string; membershipId: string }> = {};

// 09:00 in India on 9 May 2026: three days before the 12th.
const may9 = new Date("2026-05-09T03:30:00Z");
const may12 = new Date("2026-05-12T03:30:00Z");

interface Sent {
  channel: string;
  name: string;
  title: string;
  amountPaise: number;
}

function fakeChannel(
  name: "push" | "email",
  sent: Sent[],
  reply: (recipient: Recipient) => Delivery = () => ({ ok: true }),
): Channel {
  return {
    name,
    reaches: (recipient) =>
      name === "push"
        ? recipient.pushTargets.length > 0
        : recipient.email !== null,
    cost: (recipient) => (name === "push" ? recipient.pushTargets.length : 1),
    async send(recipient, outgoing) {
      sent.push({
        channel: name,
        name: recipient.fullName,
        title: outgoing.message.title,
        amountPaise: outgoing.reminder.amountPaise,
      });
      return reply(recipient);
    },
  };
}

async function addMember(
  name: string,
  options: {
    account?: boolean;
    consent?: boolean;
    muted?: boolean;
    feePaise?: number;
    frozenFrom?: string;
  } = {},
) {
  const profileId =
    options.account === false ? null : await t.createUser("member", name);
  const member = await t.client.query<{ id: string }>(
    `insert into public.members (full_name, phone, profile_id, reminder_consent_at, reminders_muted)
     values ($1, '9876543210', $2, $3, $4) returning id`,
    [
      name,
      profileId,
      options.consent === false ? null : new Date(),
      options.muted ?? false,
    ],
  );
  const memberId = member.rows[0].id;
  const membership = await t.client.query<{ id: string }>(
    "insert into public.memberships (member_id, starts_on) values ($1, '2026-03-12') returning id",
    [memberId],
  );
  const membershipId = membership.rows[0].id;
  await t.client.query(
    "insert into public.membership_fees (membership_id, fee_paise, effective_from, set_by) values ($1, $2, '2026-03-12', $3)",
    [membershipId, options.feePaise ?? 60000, owner],
  );
  if (options.frozenFrom) {
    await t.client.query(
      "insert into public.membership_freezes (membership_id, starts_on, created_by) values ($1, $2, $3)",
      [membershipId, options.frozenFrom, owner],
    );
  }
  // March and April paid; May's fee falls due on the 12th.
  await pay(memberId, membershipId, 120000, 0, 2);
  if (profileId) {
    await t.client.query(
      "insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)",
      [
        profileId,
        `https://fcm.googleapis.com/fcm/send/${name}`,
        "B".padEnd(87, "A"),
        "A".repeat(22),
      ],
    );
  }
  people[name] = { memberId, membershipId };
}

async function pay(
  memberId: string,
  membershipId: string,
  amountPaise: number,
  firstPeriod: number,
  months = 1,
) {
  await t.client.query(
    `insert into public.payments (member_id, membership_id, first_period, months, amount_paise, method, paid_on, recorded_by)
     values ($1, $2, $3, $4, $5, 'cash', '2026-03-12', $6)`,
    [memberId, membershipId, firstPeriod, months, amountPaise, owner],
  );
}

async function logRows() {
  const result = await t.client.query<{
    full_name: string;
    channel: string;
    stage: string;
    status: string;
    error: string | null;
  }>(
    `select m.full_name, n.channel, n.stage, n.status, n.error
     from public.notifications n join public.members m on m.id = n.member_id
     order by m.full_name, n.channel, n.stage`,
  );
  return result.rows;
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  await addMember("Alice");
  await addMember("Bob, no account", { account: false });
  await addMember("Cara, never agreed", { consent: false });
  await addMember("Dev, muted", { muted: true });
  await addMember("Esha, free", { feePaise: 0 });
  await addMember("Farid, frozen", { frozenFrom: "2026-05-01" });
  await addMember("Gita, left");
  await t.client.query(
    "update public.members set is_active = false where id = $1",
    [people["Gita, left"].memberId],
  );
}, 60_000);

beforeEach(async () => {
  await t.client.query(
    "alter table public.notifications disable trigger notifications_never_deleted",
  );
  await t.client.query("delete from public.notifications");
  await t.client.query(
    "alter table public.notifications enable trigger notifications_never_deleted",
  );
});

describe("the daily reminder run", () => {
  it("reminds only members it may, on every channel that reaches them", async () => {
    const sent: Sent[] = [];
    const result = await runReminders(
      t.db,
      [fakeChannel("push", sent), fakeChannel("email", sent)],
      { now: may9 },
    );

    expect(sent).toEqual([
      {
        channel: "push",
        name: "Alice",
        title: "Gym fee due soon",
        amountPaise: 60000,
      },
      {
        channel: "email",
        name: "Alice",
        title: "Gym fee due soon",
        amountPaise: 60000,
      },
    ]);
    expect(result).toMatchObject({
      today: "2026-05-09",
      due: 1,
      sent: 2,
      failed: 0,
    });
    // Ordered by the channel enum: push, then email.
    expect(await logRows()).toEqual(
      ["push", "email"].map((channel) => ({
        full_name: "Alice",
        channel,
        stage: "due_soon",
        status: "sent",
        error: null,
      })),
    );
  });

  it("never sends the same reminder twice, however often it runs", async () => {
    const sent: Sent[] = [];
    const channels = [fakeChannel("push", sent)];
    await runReminders(t.db, channels, { now: may9 });
    const again = await runReminders(t.db, channels, { now: may9 });
    // The next morning is still "due soon", and still the same reminder.
    await runReminders(t.db, channels, {
      now: new Date("2026-05-10T03:30:00Z"),
    });

    expect(sent).toHaveLength(1);
    expect(again).toMatchObject({ sent: 0, alreadySent: 1 });
  });

  it("sends the next stage on the due date", async () => {
    const sent: Sent[] = [];
    await runReminders(t.db, [fakeChannel("push", sent)], { now: may9 });
    await runReminders(t.db, [fakeChannel("push", sent)], { now: may12 });
    expect(sent.map((s) => s.title)).toEqual([
      "Gym fee due soon",
      "Gym fee due today",
    ]);
  });

  it("logs a failure with its reason", async () => {
    const result = await runReminders(
      t.db,
      [
        fakeChannel("email", [], () => ({
          ok: false,
          error: "422 invalid from",
        })),
      ],
      { now: may9 },
    );
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(await logRows()).toEqual([
      {
        full_name: "Alice",
        channel: "email",
        stage: "due_soon",
        status: "failed",
        error: "422 invalid from",
      },
    ]);
  });

  it("forgets browsers the push service says are gone", async () => {
    await runReminders(
      t.db,
      [
        fakeChannel("push", [], (recipient) => ({
          ok: false,
          error: "410 Gone",
          expiredEndpoints: recipient.pushTargets.map(
            (target) => target.endpoint,
          ),
        })),
      ],
      { now: may9 },
    );
    const left = await t.client.query(
      "select 1 from public.push_subscriptions where endpoint like '%/Alice'",
    );
    expect(left.rows).toEqual([]);
  });

  it("leaves what doesn't fit in this run's request budget for the next", async () => {
    const sent: Sent[] = [];
    const result = await runReminders(t.db, [fakeChannel("email", sent)], {
      now: may9,
      budget: 0,
    });
    expect(result).toMatchObject({ sent: 0, deferred: 1 });
    expect(await logRows()).toEqual([]);
  });

  it("reminds old overdue fees from the bell, logged as the staff member, only once", async () => {
    const sent: Sent[] = [];
    // Email: an earlier test made the push service forget Alice's phone.
    const channels = [fakeChannel("email", sent)];
    // Ten days late: past the daily run's overdue window.
    const may22 = new Date("2026-05-22T03:30:00Z");
    expect(await runReminders(t.db, channels, { now: may22 })).toMatchObject({
      due: 0,
    });

    const result = await runReminders(t.db, channels, {
      now: may22,
      mode: "staff",
      sentBy: owner,
    });
    const again = await runReminders(t.db, channels, {
      now: may22,
      mode: "staff",
      sentBy: owner,
    });

    expect(sent.map((s) => [s.name, s.title])).toEqual([
      ["Alice", "Gym fee overdue"],
    ]);
    expect(result).toMatchObject({ due: 1, sent: 1 });
    expect(again).toMatchObject({ sent: 0, alreadySent: 1 });
    const rows = await t.client.query<{ sent_by: string }>(
      "select sent_by from public.notifications",
    );
    expect(rows.rows).toEqual([{ sent_by: owner }]);
  });

  it("stops once the fee is paid", async () => {
    const alice = people.Alice;
    await pay(alice.memberId, alice.membershipId, 60000, 2);
    const sent: Sent[] = [];
    await runReminders(t.db, [fakeChannel("email", sent)], { now: may12 });
    expect(sent).toEqual([]);
  });
});
