import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Viewer } from "@/auth/session";

vi.mock("server-only", () => ({}));

const getViewer = vi.fn<() => Promise<Viewer | null>>();
vi.mock("@/auth/session", async () => {
  const { can } = await import("@/auth/permissions");
  return {
    getViewer: () => getViewer(),
    viewerCan: (viewer: Viewer | null, action: Parameters<typeof can>[1]) =>
      viewer !== null && viewer.isActive && can(viewer.role, action),
  };
});

const { guardedAction, databaseErrorMessage } =
  await import("@/auth/guarded-action");

const manager: Viewer = {
  userId: "u1",
  fullName: "Manager",
  email: null,
  role: "manager",
  isActive: true,
};

const run = vi.fn(async (input: { amount: number }) => input.amount * 2);
const recordPayment = guardedAction({
  permission: "payments.record",
  input: z.object({
    amount: z.coerce.number().int().positive("Amount must be positive"),
  }),
  run,
});

beforeEach(() => {
  run.mockClear();
  getViewer.mockReset();
});

describe("guardedAction", () => {
  it("rejects a signed-out caller before looking at the input", async () => {
    getViewer.mockResolvedValue(null);
    expect(await recordPayment({ amount: "not a number" })).toEqual({
      ok: false,
      error: "Your session ended. Sign in again.",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a role without the permission", async () => {
    getViewer.mockResolvedValue({ ...manager, role: "trainer" });
    expect(await recordPayment({ amount: 5 })).toMatchObject({ ok: false });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a deactivated account even with the right role", async () => {
    getViewer.mockResolvedValue({ ...manager, isActive: false });
    expect(await recordPayment({ amount: 5 })).toMatchObject({ ok: false });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects invalid input with the schema's message", async () => {
    getViewer.mockResolvedValue(manager);
    expect(await recordPayment({ amount: -3 })).toEqual({
      ok: false,
      error: "Amount must be positive",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("runs with parsed input, including FormData", async () => {
    getViewer.mockResolvedValue(manager);
    const form = new FormData();
    form.set("amount", "21");
    expect(await recordPayment(form)).toEqual({ ok: true, data: 42 });
    expect(run).toHaveBeenCalledWith({ amount: 21 }, manager);
  });
});

describe("databaseErrorMessage", () => {
  const wrapped = (code: string, message: string) => ({
    message: "Failed query",
    cause: { code, message },
  });

  it("hides raw RLS errors behind a generic line", () => {
    expect(
      databaseErrorMessage(
        wrapped("42501", "new row violates row-level security policy"),
      ),
    ).toBe("You don't have access to do that.");
  });

  it("passes through messages our SQL functions wrote for people", () => {
    expect(
      databaseErrorMessage(wrapped("42501", "Only the owner can change roles")),
    ).toBe("Only the owner can change roles");
    expect(
      databaseErrorMessage(
        wrapped("P0001", "This link has expired or was already used"),
      ),
    ).toBe("This link has expired or was already used");
  });

  it("returns null for unexpected errors so they surface as bugs", () => {
    expect(databaseErrorMessage(new Error("boom"))).toBeNull();
    expect(
      databaseErrorMessage(wrapped("08006", "connection failure")),
    ).toBeNull();
  });
});
