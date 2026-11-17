// bulletin.json is built by Postgres (public.publish_bulletin). These check
// who may build it, that it matches the shape phones parse, and that the
// hours column refuses values that would break every phone at once.
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { bulletin } from "@/bulletin/types";
import {
  createTestDatabase,
  type TestDatabase,
} from "@/db/testing/test-database";
import { rowsOf, withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;
let member: string;

beforeAll(async () => {
  t = await createTestDatabase();
  owner = await t.createUser("owner");
  manager = await t.createUser("manager");
  trainer = await t.createUser("trainer");
  member = await t.createUser("member");
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

function publishAs(userId: string) {
  return withUserContext(t.db, userId, async (tx) => {
    const result = await tx.execute(
      sql`select public.publish_bulletin() as body`,
    );
    return rowsOf<{ body: string }>(result)[0].body;
  });
}

function setHoursAs(userId: string, hours: unknown) {
  return withUserContext(t.db, userId, (tx) =>
    tx.execute(
      sql`update public.gym_settings set weekly_hours = ${JSON.stringify(hours)}::jsonb`,
    ),
  );
}

const closedAllWeek = {
  sun: [],
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
};

describe("publish_bulletin", () => {
  it("builds a file in the shape phones read", async () => {
    const parsed = bulletin.parse(JSON.parse(await publishAs(owner)));

    expect(parsed.timezone).toBe("Asia/Kolkata");
    expect(parsed.hours.sun).toEqual([]);
    expect(parsed.hours.mon).toEqual([
      { open: "05:00", close: "10:00" },
      { open: "16:00", close: "22:00" },
    ]);
    expect(parsed.crowd).toEqual({
      comfortableCapacity: 40,
      calibrationMultiplier: 1,
      fullMinutes: 45,
      goneMinutes: 120,
    });
    expect(parsed.closures).toEqual([]);
    expect(parsed.announcements).toEqual([]);
  });

  it("numbers each publish higher than the last", async () => {
    const first = bulletin.parse(JSON.parse(await publishAs(owner)));
    const second = bulletin.parse(JSON.parse(await publishAs(manager)));
    expect(second.version).toBeGreaterThan(first.version);
  });

  it("refuses trainers and members", async () => {
    expect(await rejectionMessage(publishAs(trainer))).toMatch(
      /Only the owner or a manager/,
    );
    expect(await rejectionMessage(publishAs(member))).toMatch(
      /Only the owner or a manager/,
    );
  });

  it("can't be called without signing in", async () => {
    expect(
      await rejectionMessage(
        t.db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('role', 'anon', true)`);
          await tx.execute(sql`select public.publish_bulletin()`);
        }),
      ),
    ).toMatch(/permission denied/);
  });

  it("publishes what the same transaction just saved", async () => {
    const body = await withUserContext(t.db, owner, async (tx) => {
      await tx.execute(sql`update public.gym_settings set crowd_capacity = 55`);
      const result = await tx.execute(
        sql`select public.publish_bulletin() as body`,
      );
      return rowsOf<{ body: string }>(result)[0].body;
    });
    expect(bulletin.parse(JSON.parse(body)).crowd.comfortableCapacity).toBe(55);
  });
});

describe("weekly hours", () => {
  it("accepts openings that run past midnight", async () => {
    await setHoursAs(owner, {
      ...closedAllWeek,
      fri: [{ open: "18:00", close: "02:00" }],
    });
    const parsed = bulletin.parse(JSON.parse(await publishAs(owner)));
    expect(parsed.hours.fri).toEqual([{ open: "18:00", close: "02:00" }]);
  });

  it.each([
    ["a missing day", { ...closedAllWeek, sun: undefined }],
    ["an unknown day", { ...closedAllWeek, xyz: [] }],
    [
      "a bad time",
      { ...closedAllWeek, mon: [{ open: "5am", close: "10:00" }] },
    ],
    ["24:00", { ...closedAllWeek, mon: [{ open: "05:00", close: "24:00" }] }],
    [
      "open equal to close",
      { ...closedAllWeek, mon: [{ open: "05:00", close: "05:00" }] },
    ],
    [
      "an extra field",
      { ...closedAllWeek, mon: [{ open: "05:00", close: "06:00", x: 1 }] },
    ],
    ["a day that isn't a list", { ...closedAllWeek, mon: "closed" }],
    [
      "more than four openings",
      {
        ...closedAllWeek,
        mon: Array(5).fill({ open: "05:00", close: "06:00" }),
      },
    ],
  ])("refuses %s", async (_label, hours) => {
    expect(await rejectionMessage(setHoursAs(owner, hours))).toMatch(
      /gym_settings_weekly_hours_valid/,
    );
  });

  it("can only be changed by the owner", async () => {
    const mondayMorning = [{ open: "06:00", close: "11:00" }];
    await setHoursAs(owner, { ...closedAllWeek, mon: mondayMorning });
    // The update runs but RLS lets no row through for a manager.
    await setHoursAs(manager, closedAllWeek);
    const parsed = bulletin.parse(JSON.parse(await publishAs(owner)));
    expect(parsed.hours.mon).toEqual(mondayMorning);
  });
});
