// Phase 4 rules (brief §4.3): QR check-in, desk displays and the printed
// code, checked against the real migrations through withUserContext.
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { attendance, deskDisplays, gymSettings } from "@/db/schema";
import {
  createTestDatabase,
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
