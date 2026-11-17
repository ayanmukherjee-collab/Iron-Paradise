// crowd.json is built by Postgres in the check-in's own transaction
// (public.crowd_after_check_in). These check that it holds check-in times
// and nothing else, that it's built at most once a minute, that it needs a
// real check-in, and that no app role can see or move the throttle.
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crowdFile } from "@/bulletin/crowd";
import { attendance } from "@/db/schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { rowsOf, withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let alice: string;
let aliceMember: string;
let bob: string;
let bobMember: string;
let carolMember: string;

async function rejectionMessage(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error("Expected the query to be rejected, but it succeeded");
}

async function rotatingCode(): Promise<string> {
  const result = await t.client.query<{ code: string }>(
    "select private.rotating_code(private.checkin_step()) as code",
  );
  return result.rows[0].code;
}

/** The member QR path, as src/attendance/actions.ts runs it. */
async function memberCheckIn(userId: string) {
  const code = await rotatingCode();
  return withUserContext(t.db, userId, async (tx) => {
    const result = await tx.execute(
      sql`select s.status, public.crowd_after_check_in() as crowd from public.check_in(${code}) as s(status)`,
    );
    return rowsOf<{ status: string; crowd: string | null }>(result)[0];
  });
}

/** The staff path (markAttendance): insert, then ask in the same transaction. */
function staffMark(memberId: string) {
  return withUserContext(t.db, owner, async (tx) => {
    await tx
      .insert(attendance)
      .values({ memberId, method: "manual", markedBy: owner });
    const result = await tx.execute(
      sql`select public.crowd_after_check_in() as crowd`,
    );
    return rowsOf<{ crowd: string | null }>(result)[0].crowd;
  });
}

async function builtAt(): Promise<string> {
  const result = await t.client.query<{ built_at: string }>(
    "select built_at::text from private.crowd_publish",
  );
  return result.rows[0].built_at;
}

/** Pretends the last build was two minutes ago. */
function lastBuiltLongAgo() {
  return t.client.query(
    "update private.crowd_publish set built_at = now() - interval '2 minutes'",
  );
}

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  alice = await t.createUser("member", "Alice Appleby");
  bob = await t.createUser("member", "Bob Brown");
  aliceMember = await t.createMember({
    profileId: alice,
    name: "Alice Appleby",
  });
  bobMember = await t.createMember({ profileId: bob, name: "Bob Brown" });
  carolMember = await t.createMember({ name: "Carol Clark" });
}, 60_000);

beforeEach(async () => {
  await t.client.query("delete from public.attendance");
  await t.client.query(
    "update private.crowd_publish set built_at = '-infinity'",
  );
});

describe("crowd_after_check_in", () => {
  it("returns check-in times to the minute and nothing else", async () => {
    // An old visit (3 hours ago) is left out; a recent one is kept.
    await t.client.query(
      "insert into public.attendance (member_id, method, checked_in_at, gym_date) values ($1, 'manual', now() - interval '3 hours', '2000-01-01'), ($2, 'manual', now() - interval '30 minutes', '2000-01-02')",
      [bobMember, carolMember],
    );

    const { status, crowd } = await memberCheckIn(alice);
    expect(status).toBe("checked_in");
    expect(crowd).not.toBeNull();

    const json = JSON.parse(crowd!);
    expect(Object.keys(json).sort()).toEqual(["checkins", "generatedAt"]);
    const file = crowdFile.parse(json);
    expect(file.checkins).toHaveLength(2);
    for (const at of [file.generatedAt, ...file.checkins]) {
      expect(at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/);
    }
    // Newest first.
    expect(file.checkins[0] >= file.checkins[1]).toBe(true);

    for (const secret of [
      alice,
      aliceMember,
      bobMember,
      carolMember,
      "Alice",
      "Carol",
      "manual",
      "qr",
    ]) {
      expect(crowd).not.toContain(secret);
    }
  });

  it("builds at most once a minute", async () => {
    expect((await memberCheckIn(alice)).crowd).not.toBeNull();
    const first = await builtAt();

    // A second check-in within the minute: saved, but no rebuild.
    const bobs = await memberCheckIn(bob);
    expect(bobs.status).toBe("checked_in");
    expect(bobs.crowd).toBeNull();
    expect(await builtAt()).toBe(first);

    // A minute on, the next check-in rebuilds, with everyone so far.
    await lastBuiltLongAgo();
    const crowd = await staffMark(carolMember);
    expect(crowd).not.toBeNull();
    expect(crowdFile.parse(JSON.parse(crowd!)).checkins).toHaveLength(3);
  });

  it("does nothing without a check-in in the same transaction", async () => {
    const before = await builtAt();
    const crowd = await withUserContext(t.db, alice, async (tx) => {
      const result = await tx.execute(
        sql`select public.crowd_after_check_in() as crowd`,
      );
      return rowsOf<{ crowd: string | null }>(result)[0].crowd;
    });
    expect(crowd).toBeNull();
    expect(await builtAt()).toBe(before);
  });

  it("doesn't rebuild when the member was already in today", async () => {
    await memberCheckIn(alice);
    await lastBuiltLongAgo();
    const again = await memberCheckIn(alice);
    expect(again).toEqual({ status: "already", crowd: null });
  });

  it("gives the minute back if the check-in rolls back", async () => {
    const before = await builtAt();
    await expect(
      withUserContext(t.db, owner, async (tx) => {
        await tx
          .insert(attendance)
          .values({ memberId: carolMember, method: "manual", markedBy: owner });
        await tx.execute(sql`select public.crowd_after_check_in()`);
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");
    expect(await builtAt()).toBe(before);
    expect(await staffMark(carolMember)).not.toBeNull();
  });

  it("can't be called without signing in", async () => {
    expect(
      await rejectionMessage(
        t.db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('role', 'anon', true)`);
          await tx.execute(sql`select public.crowd_after_check_in()`);
        }),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("the throttle table", () => {
  it("is out of members' reach", async () => {
    for (const statement of [
      sql`select * from private.crowd_publish`,
      sql`update private.crowd_publish set built_at = '-infinity'`,
    ]) {
      expect(
        await rejectionMessage(
          withUserContext(t.db, alice, (tx) => tx.execute(statement)),
        ),
      ).toMatch(/permission denied/);
    }
  });

  it("is out of the owner's reach too, outside the function", async () => {
    expect(
      await rejectionMessage(
        withUserContext(t.db, owner, (tx) =>
          tx.execute(sql`select * from private.crowd_publish`),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});
