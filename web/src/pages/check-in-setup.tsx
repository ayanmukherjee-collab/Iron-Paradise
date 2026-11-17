// Mirrors src/app/app/attendance/setup/page.tsx.
import { useEffect } from "react";
import { checkInUrl } from "@/attendance/code";
import { DeskLinkPanel } from "@/attendance/components/desk-link-panel";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { formatDateTime } from "@/lib/dates";
import { QrCode } from "@/members/components/qr-code";
import {
  createDeskDisplay,
  regeneratePrintedCode,
  revokeDeskDisplay,
  setPrintedQr,
} from "../actions/attendance";
import { useViewer, viewerCan } from "../auth/viewer";
import { getCheckInSetup, type CheckInSetup } from "../data/attendance";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { env } from "../lib/env";

export function CheckInSetupPage() {
  useTitle("Check-in QR");
  useEffect(() => {
    // The printed code is on this page; keep it out of any Referer header.
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  const state = useLoad(() => getCheckInSetup(), []);
  return (
    <Loaded state={state}>{(setup) => <SetupView setup={setup} />}</Loaded>
  );
}

function SetupView({ setup }: { setup: CheckInSetup }) {
  const viewer = useViewer();
  const isOwner = viewerCan(viewer, "checkin.settings");
  const printedUrl = checkInUrl(setup.printedCode, env.siteUrl);

  return (
    <div>
      <header className="page-header">
        <BackLink href="/app/attendance" label="Attendance" className="mb-1" />
        <h1 className="page-title">Check-in QR</h1>
      </header>

      <div className="mt-2 grid items-start gap-4 lg:grid-cols-2">
        {/* Printed QR */}
        <section className="card p-5 sm:p-6">
          <CardHeader
            icon="qr"
            title="Printed QR"
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
                PDF
              </a>

              {isOwner && (
                <div className="mt-5 border-t border-line pt-5">
                  <div className="flex justify-center gap-2">
                    <ActionForm
                      action={regeneratePrintedCode}
                      submitLabel="Replace code"
                      icon="refresh"
                      variant="outline-dark"
                      className="[&>div]:mt-0 [&>div]:items-center"
                    />
                    <ActionForm
                      action={setPrintedQr}
                      submitLabel="Switch off"
                      icon="power"
                      variant="outline-dark"
                      className="[&>div]:mt-0 [&>div]:items-center"
                    >
                      <input type="hidden" name="enabled" value="false" />
                    </ActionForm>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 flex justify-center rounded-tile bg-canvas p-5">
              {isOwner && (
                <ActionForm
                  action={setPrintedQr}
                  submitLabel="Switch on"
                  className="[&>div]:mt-0 [&>div]:items-center"
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
            icon="checkIn"
            title="Desk displays"
            status={
              setup.displays.length === 0
                ? "Off"
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
                    <p className="flex items-center gap-1 truncate text-xs text-muted">
                      <NavIconSvg icon="clock" className="size-3.5 shrink-0" />
                      {display.lastSeenAt
                        ? formatDateTime(display.lastSeenAt)
                        : "—"}
                    </p>
                  </div>
                  <ActionForm
                    action={revokeDeskDisplay}
                    submitLabel={`Switch off ${display.label}`}
                    icon="power"
                    variant="outline-dark"
                    className="shrink-0 [&>div]:mt-0 [&>div]:items-end"
                  >
                    <input type="hidden" name="displayId" value={display.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-line pt-5">
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
  status,
}: {
  icon: "qr" | "checkIn";
  title: string;
  status: string;
}) {
  const on = status === "On" || status.endsWith(" on");
  return (
    <div className="flex items-center gap-3">
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
      </div>
    </div>
  );
}
