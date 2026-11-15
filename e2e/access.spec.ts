import { expect, test } from "@playwright/test";

test.describe("signed-out visitors", () => {
  for (const path of [
    "/app",
    "/app/team",
    "/app/members",
    "/app/members/new",
    "/app/guests",
    "/app/audit",
    "/app/settings",
    "/app/payments",
    "/app/payments/export?format=csv",
    "/app/attendance",
    "/app/attendance/setup",
    "/app/check-in",
  ]) {
    test(`are sent from ${path} to sign in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}`),
      );
      await expect(
        page.getByRole("heading", { name: "Sign in" }),
      ).toBeVisible();
    });
  }

  test("get 401 from API routes", async ({ request }) => {
    const response = await request.get("/api/anything", { maxRedirects: 0 });
    expect(response.status()).toBe(401);
  });

  test("can open the landing page with no CSP violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /Content Security Policy/i.test(message.text())
      ) {
        violations.push(message.text());
      }
    });

    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain(
      "'strict-dynamic'",
    );
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.mouse.wheel(0, 4000);
    expect(violations).toEqual([]);
  });

  test("see the Google sign-in button behind the bot check", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("button", { name: /Continue with Google/ }),
    ).toBeVisible();
  });
});

test("the app manifest is installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/app" });
  expect(
    manifest.icons.some(
      (icon: { purpose: string }) => icon.purpose === "maskable",
    ),
  ).toBe(true);
});

test("a claim link asks a signed-out visitor to sign in, revealing nothing", async ({
  page,
}) => {
  const response = await page.goto("/claim/" + "x".repeat(43));
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("link", { name: "Sign in to continue" }),
  ).toHaveAttribute("href", /\/sign-in\?next=%2Fclaim%2F/);
  await expect(page.getByText(/IP-\d{4}/)).toHaveCount(0);
});

test("a made-up desk link shows no QR and no code", async ({
  page,
  request,
}) => {
  const token = "x".repeat(43);
  const response = await request.get(`/desk/${token}/code`);
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({
    error: "This desk link is switched off. Ask the owner for a new one.",
  });

  await page.goto(`/desk/${token}`);
  await expect(page.getByText(/switched off/)).toBeVisible();
  await expect(page.getByRole("img", { name: /Check-in QR/ })).toHaveCount(0);
});
