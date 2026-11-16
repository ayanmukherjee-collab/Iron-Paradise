import type { Metadata } from "next";
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
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { formatDateTime } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { QrCode } from "@/members/components/qr-code";

export const metadata: Metadata = {
  title: "Check-in QR",
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
    <div>
      <BackLink href="/app/attendance" label="Attendance" />
      <h1 className="page-title">Check-in QR</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Members open the app and scan a QR at the front desk to check in. Use a
        printed sheet, a desk display, or both.
      </p>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
        {/* Printed QR */}
        <section className="card p-5 sm:p-6">
          <CardHeader
            icon="checkIn"
            title="Printed QR"
            subtitle="One fixed code on paper. Simple, but a photo of it works from anywhere."
            status={setup.printedQrEnabled ? "On" : "Off"}
          />

          {setup.printedQrEnabled ? (
            <>
              <div className="mt-5 flex justify-center rounded-tile bg-canvas p-5 sm:p-6">
                <QrCode
                  value={printedUrl}
                  label="Printed check-in QR code"
                  className="block aspect-square w-full max-w-60 rounded-control shadow-card"
                />
              </div>

              <a
                href="/app/attendance/setup/printed-qr"
                className="mt-4 btn-dark w-full"
                download
              >
                <NavIconSvg icon="download" className="size-[1.1rem]" />
                Download PDF to print
              </a>
              <p className="mt-2 text-center text-xs text-muted">
                A4 sheet with the code and instructions for members.
              </p>

              {isOwner && (
                <div className="mt-5 border-t border-line pt-5">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionForm
                      action={regeneratePrintedCode}
                      submitLabel="Replace code"
                      pendingLabel="Replacing…"
                      variant="outline-dark"
                      className="[&_button]:w-full [&_button]:px-3 [&>div]:mt-0"
                    />
                    <ActionForm
                      action={setPrintedQr}
                      submitLabel="Switch off"
                      variant="outline-dark"
                      className="[&_button]:w-full [&_button]:px-3 [&>div]:mt-0"
                    >
                      <input type="hidden" name="enabled" value="false" />
                    </ActionForm>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    Replace the code if a photo of it is going around; the old
                    sheet stops working at once. Switch it off once a desk
                    display is set up.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 rounded-tile bg-canvas p-5 text-center">
              <p className="text-sm text-muted">
                Scanning the printed sheet shows an error. Only desk displays
                check people in.
              </p>
              {isOwner && (
                <ActionForm
                  action={setPrintedQr}
                  submitLabel="Switch printed QR on"
                  className="mt-4 [&>div]:mt-0 [&>div]:items-center"
                >
                  <input type="hidden" name="enabled" value="true" />
                </ActionForm>
              )}
            </div>
          )}
        </section>

        {/* Desk displays */}
        <section className="card p-5 sm:p-6">
          <CardHeader
            icon="attendance"
            title="Desk displays"
            subtitle="A phone or tablet at the desk showing a code that changes every 30 seconds. A photo of it is useless from home."
            status={
              setup.displays.length === 0
                ? "None yet"
                : `${setup.displays.length} on`
            }
          />

          {setup.displays.length > 0 && (
            <ul className="mt-5 list-card">
              {setup.displays.map((display) => (
                <li
                  key={display.id}
                  className="flex items-center justify-between gap-3 list-row py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{display.label}</p>
                    <p className="truncate text-xs text-muted">
                      {display.lastSeenAt
                        ? `Last on ${formatDateTime(display.lastSeenAt)}`
                        : "Not opened yet"}
                      {display.createdBy && ` · by ${display.createdBy}`}
                    </p>
                  </div>
                  <ActionForm
                    action={revokeDeskDisplay}
                    submitLabel="Switch off"
                    pendingLabel="Switching off…"
                    variant="outline-dark"
                    className="shrink-0 [&_button]:min-h-10 [&_button]:px-3 [&>div]:mt-0 [&>div]:items-end"
                  >
                    <input type="hidden" name="displayId" value={display.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-line pt-5">
            <h3 className="text-sm font-medium">Set up a device</h3>
            <p className="mt-0.5 mb-3 text-xs text-muted">
              It shows the rotating QR and nothing else: no member list, no
              staff access.
            </p>
            <DeskLinkPanel createDeskDisplay={createDeskDisplay} />
          </div>
        </section>
      </div>
    </div>
  );
}

function CardHeader({
  icon,
  title,
  subtitle,
  status,
}: {
  icon: "checkIn" | "attendance";
  title: string;
  subtitle: string;
  status: string;
}) {
  const on = status === "On" || status.endsWith(" on");
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-canvas">
        <NavIconSvg icon={icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">{title}</h2>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-badge px-2 py-1 text-xs font-medium ${on ? "bg-ink text-white" : "bg-canvas text-muted"}`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {status}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
