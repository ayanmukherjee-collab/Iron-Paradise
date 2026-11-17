// Phase 4 rules (brief §4.3): QR check-in, desk displays and the printed
// code, checked against the real migrations through withUserContext.
import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attendance,
  deskDisplays,
  gymClosures,
  gymSettings,
} from "@/db/schema";
import {
  createTestDatabase,
  roundTheClock,
  type TestDatabase,
} from "@/db/testing/test-database";
import { rowsOf, withUserContext } from "@/db/user-context";

let t: TestDatabase;
let owner: string;
let manager: string;
let trainer: string;
let alice: string;
let aliceMember: string;
let bob: string;
let guest: string;

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

/** What a desk display would show right now, offset by whole 30 s steps. */
async function rotatingCode(stepsAgo = 0): Promise<string> {
  const result = await t.client.query<{ code: string }>(
    "select private.rotating_code(private.checkin_step() - $1) as code",
    [stepsAgo],
  );
  return result.rows[0].code;
}

async function printedCode(): Promise<string> {
  const result = await t.client.query<{ printed_code: string }>(
    "select printed_code from private.checkin_codes",
  );
  return result.rows[0].printed_code;
}

function checkIn(userId: string, code: string) {
  return as(userId, async (tx) => {
    const result = await tx.execute(
      sql`select public.check_in(${code}) as status`,
    );
    return rowsOf<{ status: string }>(result)[0].status;
  });
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
}, 60_000);

beforeEach(async () => {
  await t.client.query("delete from public.attendance");
  await t.client.query("delete from public.gym_closures");
  await t.client.query("update public.gym_settings set weekly_hours = $1", [
    roundTheClock,
  ]);
  await t.client.query(
    "update public.gym_settings set printed_qr_enabled = true",
  );
  await t.client.query(
    "update public.members set is_active = true where id = $1",
    [aliceMember],
  );
});

describe("member check-in", () => {
  it("accepts the code on the desk display, once per day", async () => {
    expect(await checkIn(alice, await rotatingCode())).toBe("checked_in");
    expect(await checkIn(alice, await rotatingCode())).toBe("already");

    const rows = await t.client.query<{ method: string; marked_by: string }>(
      "select method, marked_by from public.attendance where member_id = $1",
      [aliceMember],
    );
    expect(rows.rows).toEqual([{ method: "qr", marked_by: alice }]);
  });

  it("still accepts a code that rotated a moment ago, but not an older one", async () => {
    expect(await checkIn(alice, await rotatingCode(1))).toBe("checked_in");
    expect(await rejectionMessage(checkIn(bob, await rotatingCode(2)))).toBe(
      "That code has expired. Scan the QR at the desk again.",
    );
  });

  it("rejects a made-up code", async () => {
    expect(await rejectionMessage(checkIn(alice, "0123456789ab"))).toMatch(
      /expired/,
    );
  });

  it("accepts the printed code only while the owner allows it", async () => {
    const code = await printedCode();
    expect(await checkIn(alice, code)).toBe("checked_in");

    await as(owner, (tx) =>
      tx.update(gymSettings).set({ printedQrEnabled: false }),
    );
    expect(await rejectionMessage(checkIn(bob, code))).toMatch(/expired/);
  });

  it("turns away accounts with no member record", async () => {
    expect(await rejectionMessage(checkIn(guest, await rotatingCode()))).toBe(
      "This account isn't linked to a gym membership yet.",
    );
    expect(
      await rejectionMessage(checkIn(trainer, await rotatingCode())),
    ).toMatch(/isn't linked/);
  });

  it("turns away a member marked inactive", async () => {
    await t.client.query(
      "update public.members set is_active = false where id = $1",
      [aliceMember],
    );
    expect(await rejectionMessage(checkIn(alice, await rotatingCode()))).toBe(
      "Your membership is marked inactive. Talk to the front desk.",
    );
  });

  it("turns away an account the owner switched off", async () => {
    const carol = await t.createUser("member", "Carol");
    await t.createMember({ profileId: carol, name: "Carol" });
    await t.client.query(
      "update public.profiles set is_active = false where id = $1",
      [carol],
    );
    expect(
      await rejectionMessage(checkIn(carol, await rotatingCode())),
    ).toMatch(/isn't linked/);
  });

  it("cannot be faked by writing attendance directly", async () => {
    await rejectionMessage(
      as(alice, (tx) =>
        tx
          .insert(attendance)
          .values({ memberId: aliceMember, method: "manual", markedBy: alice })
          .then(() => undefined),
      ),
    );
    await rejectionMessage(
      as(trainer, (tx) =>
        tx
          .insert(attendance)
          .values({ memberId: aliceMember, method: "qr", markedBy: trainer })
          .then(() => undefined),
      ),
    );
    const rows = await t.client.query("select 1 from public.attendance");
    expect(rows.rows).toHaveLength(0);
  });
});

describe("desk displays", () => {
  const token = "d".repeat(43);

  async function deskCode(raw: string) {
    const result = await t.client.query<{ code: string; seconds_left: number }>(
      "select * from private.desk_checkin_code($1)",
      [raw],
    );
    return result.rows[0];
  }

  it("can be set up by a manager, not a trainer", async () => {
    await as(manager, (tx) =>
      tx.execute(
        sql`select public.create_desk_display('Front desk', ${token})`,
      ),
    );
    expect(
      await rejectionMessage(
        as(trainer, (tx) =>
          tx.execute(
            sql`select public.create_desk_display('Mine', ${"t".repeat(43)})`,
          ),
        ),
      ),
    ).toMatch(/owner or a manager/);
  });

  it("show a code that checks a member in", async () => {
    const shown = await deskCode(token);
    expect(shown.seconds_left).toBeGreaterThan(0);
    expect(shown.seconds_left).toBeLessThanOrEqual(30);
    expect(await checkIn(alice, shown.code)).toBe("checked_in");
  });

  it("never reveal their token hash, and members cannot list them", async () => {
    const seen = await as(owner, (tx) =>
      tx.select({ label: deskDisplays.label }).from(deskDisplays),
    );
    expect(seen).toEqual([{ label: "Front desk" }]);
    await rejectionMessage(
      as(owner, (tx) =>
        tx.select({ hash: deskDisplays.tokenHash }).from(deskDisplays),
      ),
    );
    expect(
      await as(alice, (tx) =>
        tx.select({ label: deskDisplays.label }).from(deskDisplays),
      ),
    ).toEqual([]);
  });

  it("log set-up and switch-off, but not every time a device asks for a code", async () => {
    await deskCode(token);
    await t.client.query(
      "update public.desk_displays set last_seen_at = now() - interval '1 hour'",
    );
    await deskCode(token);
    const log = await t.client.query(
      "select action from public.audit_log where table_name = 'desk_displays'",
    );
    expect(log.rows).toEqual([{ action: "insert" }]);
  });

  it("stop working once switched off", async () => {
    const [{ id }] = await as(owner, (tx) =>
      tx.select({ id: deskDisplays.id }).from(deskDisplays),
    );
    await as(manager, (tx) =>
      tx.execute(sql`select public.revoke_desk_display(${id})`),
    );
    expect(await rejectionMessage(deskCode(token))).toMatch(/switched off/);
  });

  it("refuse an unknown token", async () => {
    expect(await rejectionMessage(deskCode("x".repeat(43)))).toMatch(
      /switched off/,
    );
  });
});

describe("the printed code", () => {
  function readPrinted(userId: string) {
    return as(userId, async (tx) => {
      const result = await tx.execute(
        sql`select public.printed_checkin_code() as code`,
      );
      return rowsOf<{ code: string }>(result)[0].code;
    });
  }

  it("can be shown to the owner and managers, not trainers or members", async () => {
    expect(await readPrinted(manager)).toBe(await printedCode());
    expect(await rejectionMessage(readPrinted(trainer))).toMatch(
      /owner or a manager/,
    );
    expect(await rejectionMessage(readPrinted(alice))).toMatch(
      /owner or a manager/,
    );
  });

  it("can be replaced only by the owner, and the log never holds it", async () => {
    const before = await printedCode();
    expect(
      await rejectionMessage(
        as(manager, (tx) =>
          tx.execute(sql`select public.regenerate_printed_checkin_code()`),
        ),
      ),
    ).toMatch(/Only the owner/);

    await as(owner, (tx) =>
      tx.execute(sql`select public.regenerate_printed_checkin_code()`),
    );
    const after = await printedCode();
    expect(after).not.toBe(before);

    const log = await t.client.query<{ text: string }>(
      "select coalesce(before::text, '') || after::text as text from public.audit_log where table_name = 'checkin_codes'",
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].text).not.toContain(after);
    expect(log.rows[0].text).not.toContain(before);
  });

  it("can be switched off by the owner only", async () => {
    const setting = () =>
      as(owner, async (tx) => {
        const [row] = await tx
          .select({ on: gymSettings.printedQrEnabled })
          .from(gymSettings);
        return row.on;
      });

    // Row security makes a manager's update match no rows: no error, no change.
    await as(manager, (tx) =>
      tx.update(gymSettings).set({ printedQrEnabled: false }),
    );
    expect(await setting()).toBe(true);

    await as(owner, (tx) =>
      tx.update(gymSettings).set({ printedQrEnabled: false }),
    );
    expect(await setting()).toBe(false);
  });

  it("is unreadable to every app role, even the owner, outside the function", async () => {
    expect(
      await rejectionMessage(
        as(owner, (tx) =>
          tx.execute(sql`select printed_code from private.checkin_codes`),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("opening hours and closures", () => {
  // 2026-11-16 is a Monday, 2026-11-22 a Sunday.
  const twoBatches = [
    { open: "05:00", close: "11:00" },
    { open: "16:00", close: "22:00" },
  ];
  const usualWeek = {
    sun: [],
    mon: twoBatches,
    tue: twoBatches,
    wed: twoBatches,
    thu: twoBatches,
    fri: twoBatches,
    sat: twoBatches,
  };

  async function useHours(overrides: Record<string, unknown> = {}) {
    await t.client.query("update public.gym_settings set weekly_hours = $1", [
      { ...usualWeek, ...overrides },
    ]);
  }

  function closeOn(date: string, hours: unknown[] | null) {
    return t.client.query(
      "insert into public.gym_closures (closes_on, hours, created_by) values ($1, $2, $3)",
      [date, hours === null ? null : JSON.stringify(hours), owner],
    );
  }

  /** A check-in at a given gym-time moment, written as the database owner. */
  function checkInAt(istMoment: string) {
    return t.client.query(
      "insert into public.attendance (member_id, method, checked_in_at, gym_date) values ($1, 'manual', $2::timestamp at time zone 'Asia/Kolkata', ($2::timestamp)::date)",
      [aliceMember, istMoment],
    );
  }

  async function refusalAt(istMoment: string): Promise<string> {
    try {
      await checkInAt(istMoment);
    } catch (error) {
      return (error as Error).message;
    }
    return "accepted";
  }

  async function batchAt(istMoment: string): Promise<string | null> {
    const result = await t.client.query<{ batch: string | null }>(
      "select public.batch_at($1::timestamp at time zone 'Asia/Kolkata') as batch",
      [istMoment],
    );
    return result.rows[0].batch;
  }

  it("names the batch a moment falls in, in gym time", async () => {
    await useHours();
    expect(await batchAt("2026-11-16 05:00")).toBe("morning");
    expect(await batchAt("2026-11-16 10:59")).toBe("morning");
    expect(await batchAt("2026-11-16 11:00")).toBeNull();
    expect(await batchAt("2026-11-16 16:30")).toBe("evening");
    expect(await batchAt("2026-11-16 22:00")).toBeNull();
    expect(await batchAt("2026-11-16 02:00")).toBeNull();
  });

  it("refuses a check-in outside the day's hours, and says when it's open", async () => {
    await useHours();
    expect(await refusalAt("2026-11-16 13:00")).toBe(
      "Check-in is open 05:00–11:00 and 16:00–22:00 today.",
    );
    const rows = await t.client.query("select 1 from public.attendance");
    expect(rows.rows).toHaveLength(0);
  });

  it("refuses every check-in on a day with no hours", async () => {
    await useHours();
    expect(await refusalAt("2026-11-22 10:00")).toBe(
      "The gym is closed today.",
    );
  });

  it("accepts check-ins inside either batch", async () => {
    await useHours();
    await checkInAt("2026-11-16 06:15");
    await checkInAt("2026-11-17 19:45");
    const rows = await t.client.query("select 1 from public.attendance");
    expect(rows.rows).toHaveLength(2);
  });

  it("follows a full-day closure", async () => {
    await useHours();
    await closeOn("2026-11-18", null);
    expect(await refusalAt("2026-11-18 06:15")).toBe(
      "The gym is closed today.",
    );
  });

  it("follows a closed batch and keeps the other one open", async () => {
    await useHours();
    await closeOn("2026-11-19", [twoBatches[1]]);
    expect(await refusalAt("2026-11-19 06:15")).toBe(
      "Check-in is open 16:00–22:00 today.",
    );
    expect(await refusalAt("2026-11-19 17:00")).toBe("accepted");
  });

  it("keeps a late opening open past midnight", async () => {
    await useHours({ fri: [{ open: "18:00", close: "02:00" }] });
    expect(await batchAt("2026-11-20 23:30")).toBe("evening");
    expect(await batchAt("2026-11-21 01:30")).toBe("evening");
    expect(await batchAt("2026-11-21 02:00")).toBeNull();
  });

  it("lets only the owner change the hours", async () => {
    await useHours();
    const shut = { ...usualWeek, mon: [] };
    await as(manager, (tx) =>
      tx.update(gymSettings).set({ weeklyHours: shut }),
    );
    let [row] = await as(owner, (tx) =>
      tx.select({ hours: gymSettings.weeklyHours }).from(gymSettings),
    );
    expect(row.hours.mon).toEqual(twoBatches);

    await as(owner, (tx) => tx.update(gymSettings).set({ weeklyHours: shut }));
    [row] = await as(owner, (tx) =>
      tx.select({ hours: gymSettings.weeklyHours }).from(gymSettings),
    );
    expect(row.hours.mon).toEqual([]);
  });

  it("lets the owner and managers close the gym, and no one else", async () => {
    await as(manager, (tx) =>
      tx
        .insert(gymClosures)
        .values({ closesOn: "2026-12-25", hours: null, createdBy: manager }),
    );
    expect(
      await rejectionMessage(
        as(trainer, (tx) =>
          tx.insert(gymClosures).values({
            closesOn: "2026-12-26",
            hours: null,
            createdBy: trainer,
          }),
        ),
      ),
    ).toMatch(/row-level security/);
    // Trainers still see closures, so they know the gym is shut.
    const seen = await as(trainer, (tx) =>
      tx.select({ on: gymClosures.closesOn }).from(gymClosures),
    );
    expect(seen.map((row) => row.on)).toContain("2026-12-25");

    await as(manager, (tx) =>
      tx.delete(gymClosures).where(eq(gymClosures.closesOn, "2026-12-25")),
    );
    const left = await t.client.query(
      "select 1 from public.gym_closures where closes_on = '2026-12-25'",
    );
    expect(left.rows).toHaveLength(0);
  });

  it("refuses closure hours that aren't openings", async () => {
    expect(
      await rejectionMessage(
        as(owner, (tx) =>
          tx.execute(
            sql`insert into public.gym_closures (closes_on, hours, created_by) values ('2026-12-31', '[{"open":"9am"}]'::jsonb, ${owner})`,
          ),
        ),
      ),
    ).toMatch(/gym_closures_hours_check/);
  });
});
