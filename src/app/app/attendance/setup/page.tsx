import type { Metadata } from "next";
import Link from "next/link";
import {
  createDeskDisplay,
  regeneratePrintedCode,
  revokeDeskDisplay,
  setPrintedQr,
} from "@/attendance/actions";
import { checkInUrl } from "@/attendance/code";
import { DeskLinkPanel } from "@/attendance/components/desk-link-panel";
import { getCheckInSetup } from "@/attendance/queries";
import { requirePermission, viewerCan } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { formatDateTime } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { QrCode } from "@/members/components/qr-code";

export const metadata: Metadata = {
  title: "Check-in QR setup",
  referrer: "no-referrer",
};

export default async function CheckInSetupPage() {
  const viewer = await requirePermission(
    "desk.manage",
    "/app/attendance/setup",
  );
  const setup = await getCheckInSetup(viewer);
  const isOwner = viewerCan(viewer, "checkin.settings");
  const printedUrl = checkInUrl(
    setup.printedCode,
    publicEnv().NEXT_PUBLIC_SITE_URL,
  );

  return (
    <div className="space-y-12">
      <section>
        <Link
          href="/app/attendance"
          className="text-sm font-semibold underline underline-offset-4"
        >
          Attendance
        </Link>
        <h1 className="mt-3 display text-5xl">Check-in QR setup</h1>
        <p className="mt-4 max-w-prose text-lg">
          Members check in by scanning a QR at the front desk with the app. A
          desk display shows a code that changes every 30 seconds, so a photo of
          it is useless from home. The printed QR never changes, so anyone with
          a photo of it can check in from anywhere.
        </p>
      </section>

      <section className="border-t-2 border-ink pt-6">
        <h2 className="display text-3xl">Printed QR</h2>
        <p className="mt-2 max-w-prose text-lg">
          {setup.printedQrEnabled
            ? "On. Print this and stick it at the desk until there is a desk display."
            : "Off. Scanning it shows an error; only desk displays check people in."}
        </p>

        {setup.printedQrEnabled && (
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <QrCode
              value={printedUrl}
              label="Printed check-in QR code"
              className="size-64 shrink-0 border-2 border-ink"
            />
            <p className="max-w-sm text-smoke">
              Print this page from your browser, or take a screenshot and print
              that. Under the code, write: &ldquo;Open the Iron Paradise app,
              tap Check in, scan here.&rdquo;
            </p>
          </div>
        )}

        {isOwner && (
          <div className="mt-6 flex flex-wrap gap-6">
            <ActionForm
              action={setPrintedQr}
              submitLabel={
                setup.printedQrEnabled
                  ? "Switch printed QR off"
                  : "Switch printed QR on"
              }
              variant="outline-dark"
            >
              <input
                type="hidden"
                name="enabled"
                value={setup.printedQrEnabled ? "false" : "true"}
              />
            </ActionForm>
            {setup.printedQrEnabled && (
              <ActionForm
                action={regeneratePrintedCode}
                submitLabel="Replace printed code"
                pendingLabel="Replacing…"
                variant="outline-dark"
              />
            )}
          </div>
        )}
        {isOwner && setup.printedQrEnabled && (
          <p className="mt-3 max-w-prose text-sm text-smoke">
            Replace the code if a photo of it is going around. The old sheet
            stops working at once.
          </p>
        )}
      </section>

      <section className="border-t-2 border-ink pt-6">
        <h2 className="display text-3xl">Desk displays</h2>
        <p className="mt-2 max-w-prose text-lg">
          A phone or tablet left at the desk with a secret link. It shows the
          rotating QR and nothing else: no member list, no staff access.
        </p>

        {setup.displays.length > 0 && (
          <ul className="mt-6 border-t-2 border-ink">
            {setup.displays.map((display) => (
              <li
                key={display.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink py-3"
              >
                <div>
                  <p className="font-semibold">{display.label}</p>
                  <p className="text-sm text-smoke">
                    {display.lastSeenAt
                      ? `Last on ${formatDateTime(display.lastSeenAt)}`
                      : "Not opened yet"}
                    {display.createdBy && ` · set up by ${display.createdBy}`}
                  </p>
                </div>
                <ActionForm
                  action={revokeDeskDisplay}
                  submitLabel="Switch off"
                  pendingLabel="Switching off…"
                  variant="outline-dark"
                  className="[&>div]:mt-0"
                >
                  <input type="hidden" name="displayId" value={display.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <DeskLinkPanel createDeskDisplay={createDeskDisplay} />
        </div>
      </section>
    </div>
  );
}
