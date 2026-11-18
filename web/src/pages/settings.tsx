// Mirrors src/app/app/settings/page.tsx.
import { IconAction } from "@/bulletin/components/icon-action";
import {
  dayLabel,
  rangeLabel,
  splitBatches,
  type Batches,
} from "@/bulletin/hours";
import { CrowdZones, FadeCurve } from "@/bulletin/components/crowd-charts";
import {
  DAY_KEYS,
  type CrowdSettings,
  type DayKey,
  type TimeRange,
} from "@/bulletin/types";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { formatDate, todayAtGym } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { PushToggle } from "@/notifications/components/push-toggle";
import {
  deleteClosure,
  saveClosure,
  saveCrowdSettings,
  saveDayHours,
} from "../actions/bulletin";
import { saveGoneQuietDays, savePlan } from "../actions/members";
import { useViewer, viewerCan } from "../auth/viewer";
import { getHoursSettings, type ClosureRow } from "../data/attendance";
import { nextYearClose } from "@/payments/year-close";
import {
  getClosedHistory,
  getGoneQuietDays,
  listPlans,
  type ClosedHistory,
  type Plan,
} from "../data/members";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { env } from "../lib/env";

type SettingsData = {
  plans: Plan[];
  quietDays: number;
  hours: Awaited<ReturnType<typeof getHoursSettings>> | null;
  history: ClosedHistory | null;
};

/**
 * Every staff account has Settings: notifications for everyone, closures
 * for the owner and managers, and the gym's setup for the owner. Only what
 * the viewer may change is loaded and shown.
 */
export function SettingsPage() {
  useTitle("Settings");
  const viewer = useViewer();
  const isOwner = viewerCan(viewer, "plans.edit");
  const canClose = viewerCan(viewer, "bulletin.publish");
  const state = useLoad(
    async (): Promise<SettingsData> => {
      const [plans, quietDays, hours, history] = await Promise.all([
        isOwner ? listPlans() : Promise.resolve([]),
        isOwner ? getGoneQuietDays() : Promise.resolve(30),
        canClose ? getHoursSettings() : Promise.resolve(null),
        isOwner ? getClosedHistory() : Promise.resolve(null),
      ]);
      return { plans, quietDays, hours, history };
    },
    [viewer.userId, viewer.role],
    "settings",
  );
  return <Loaded state={state}>{(data) => <SettingsView {...data} />}</Loaded>;
}

function SettingsView({ plans, quietDays, hours, history }: SettingsData) {
  const today = todayAtGym();
  const viewer = useViewer();
  const isOwner = viewerCan(viewer, "plans.edit");

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
      </header>

      {env.vapidPublicKey && (
        <section>
          <h2 className="px-1 section-title">Notifications</h2>
          <p className="mt-1 px-1 text-sm text-muted">
            On this phone. Each phone is turned on separately.
          </p>
          <div className="mt-3 flex items-center gap-3 card p-4 sm:px-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-canvas">
              <NavIconSvg icon="reminders" className="size-5" />
            </span>
            <PushToggle vapidPublicKey={env.vapidPublicKey} compact />
          </div>
        </section>
      )}

      {hours && <ClosuresSection closures={hours.closures} today={today} />}

      {isOwner && hours && (
        <>
          <section>
            <h2 className="px-1 section-title">Plans</h2>
            <p className="mt-1 px-1 text-sm text-muted">
              Shown as quick picks when recording a payment.
            </p>

            <ul className="mt-3 list-card">
              {plans.map((plan) => (
                <li key={plan.id} className="list-row">
                  <Row
                    title={plan.name}
                    detail={`${plan.durationMonths} ${plan.durationMonths === 1 ? "month" : "months"} · ${formatPaise(plan.defaultFeePaise)}/mo`}
                    badge={plan.isActive ? undefined : "Not offered"}
                  >
                    <ActionForm
                      action={savePlan}
                      submitLabel="Save plan"
                      success="Saved."
                      className="space-y-4"
                    >
                      <input type="hidden" name="planId" value={plan.id} />
                      <PlanFields
                        name={plan.name}
                        months={plan.durationMonths}
                        fee={plan.defaultFeePaise}
                      />
                      <Checkbox
                        name="isActive"
                        label="Offered"
                        defaultChecked={plan.isActive}
                      />
                    </ActionForm>
                  </Row>
                </li>
              ))}
              <AddRow label="New plan">
                <ActionForm
                  action={savePlan}
                  submitLabel="Create plan"
                  success="Plan added."
                  className="space-y-4"
                >
                  <input type="hidden" name="planId" value="" />
                  <PlanFields name="" months={1} fee={null} />
                </ActionForm>
              </AddRow>
            </ul>
          </section>

          <section>
            <h2 className="px-1 section-title">Opening hours</h2>
            <p className="mt-1 px-1 text-sm text-muted">
              Check-ins are refused outside these.
            </p>
            <ul className="mt-3 list-card">
              {WEEK.map((day) => (
                <li key={day} className="list-row">
                  <Row
                    title={DAY_NAMES[day]}
                    detail={daySummary(hours.weekly[day])}
                  >
                    <DayHoursForm
                      day={day}
                      batches={splitBatches(hours.weekly[day])}
                    />
                  </Row>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="px-1 section-title">Gym rules</h2>
            <ul className="mt-3 list-card">
              <li className="list-row">
                <Row
                  title="Gone quiet"
                  detail={`After ${quietDays} days with no visit or payment`}
                >
                  <ActionForm
                    action={saveGoneQuietDays}
                    submitLabel="Save"
                    success="Saved."
                    className="max-w-xs"
                  >
                    <Field label="Days">
                      <input
                        name="days"
                        type="number"
                        min={7}
                        max={180}
                        required
                        defaultValue={quietDays}
                        className={inputClass}
                      />
                    </Field>
                  </ActionForm>
                </Row>
              </li>
            </ul>
          </section>
        </>
      )}

      {hours && viewerCan(viewer, "checkin.settings") && (
        <section>
          <h2 className="px-1 section-title">Members&apos; app</h2>
          <ul className="mt-3 list-card">
            <li className="list-row">
              <Row title="Crowd meter" detail={crowdSummary(hours.crowd)}>
                <CrowdForm crowd={hours.crowd} />
              </Row>
            </li>
          </ul>
        </section>
      )}

      {history && <HistorySection history={history} today={today} />}
    </div>
  );
}

/**
 * Closures in one list: today's and later ones, each with a remove button,
 * and a Close gym row that opens the form in a dialog.
 */
function ClosuresSection({
  closures,
  today,
}: {
  closures: ClosureRow[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <h2 className="px-1 section-title">Closures</h2>
      <ul className="mt-3 list-card">
        {closures
          .filter((closure) => closure.date >= today)
          .map((closure) => (
            <ClosureItem key={closure.id} closure={closure} today={today} />
          ))}
        <li className="list-row">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-mx-5 flex min-h-14 w-[calc(100%+2.5rem)] items-center gap-3 px-5 text-left font-medium transition-colors hover:bg-canvas/50 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-ink text-white">
              <NavIconSvg icon="power" className="size-4" />
            </span>
            Close gym
          </button>
        </li>
      </ul>
      <Dialog open={open} onClose={() => setOpen(false)} title="Close gym">
        {/* Mounted only while open, so it starts fresh each time. */}
        {open && (
          <ActionForm
            action={saveClosure}
            submitLabel="Close gym"
            onSaved={() => setOpen(false)}
            className="space-y-4"
          >
            <Field label="Day">
              <input
                name="date"
                type="date"
                required
                min={today}
                defaultValue={today}
                className={inputClass}
              />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium">Closed for</legend>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {CLOSE_PARTS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex min-h-12 cursor-pointer items-center justify-center rounded-control bg-white text-sm font-medium ring-1 ring-line transition-colors has-checked:bg-ink has-checked:text-white has-checked:ring-ink"
                  >
                    <input
                      type="radio"
                      name="part"
                      value={value}
                      defaultChecked={value === "day"}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Reason" hint="Optional. Members see it.">
              <input name="reason" maxLength={80} className={inputClass} />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </section>
  );
}

/**
 * One setting as a list row: what it is now, with an Edit toggle that opens
 * the form underneath.
 */
function Row({
  title,
  detail,
  badge,
  children,
}: {
  title: string;
  detail: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group -mx-5 sm:-mx-6">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors select-none hover:bg-canvas/50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {badge && (
              <span className="rounded-badge bg-canvas px-2 py-0.5 text-xs text-muted">
                {badge}
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-muted">{detail}</span>
        </span>
        <NavIconSvg
          icon="chevronDown"
          className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
        />
        <span className="sr-only">Edit</span>
      </summary>
      <div className="details-body border-t border-line px-5 pt-4 pb-5 sm:px-6">
        {children}
      </div>
    </details>
  );
}

/**
 * The yearly close: when it runs, and the totals it kept from the years it
 * cleared out (see supabase/migrations/*_year_close.sql).
 */
function HistorySection({
  history,
  today,
}: {
  history: ClosedHistory;
  today: string;
}) {
  const next = nextYearClose(today);
  return (
    <section>
      <h2 className="px-1 section-title">History</h2>
      <p className="mt-1 px-1 text-sm text-muted">
        The last 12 to 24 months stay in full. Older records become yearly
        totals.
      </p>
      <ul className="mt-3 list-card">
        <li className="list-row">
          <Row title="Yearly clean-up" detail={`Next ${formatDate(next.on)}`}>
            <p className="text-sm">
              Every 1 April, everything before the previous 1 April is added up
              into totals and then deleted, so the app stays quick as the years
              pile up. Balances and due dates don&apos;t change.
            </p>
            <p className="mt-3 text-sm text-muted">
              On {formatDate(next.on)}: records before {formatDate(next.cutoff)}
              .{" "}
              {history.closedBefore
                ? `Already cleared: everything before ${formatDate(history.closedBefore)}.`
                : "Nothing cleared yet."}{" "}
              The full detail is saved first as CSV files in Supabase, under
              Storage → archives.
            </p>
          </Row>
        </li>
        {history.years.map((year) => (
          <li
            key={year.label}
            className="flex min-h-16 items-center gap-3 list-row py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{year.label}</span>
              <span className="block truncate text-sm text-muted">
                {year.checkIns.toLocaleString("en-IN")} check-ins ·{" "}
                {year.joined} joined · {year.payments} payments
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatPaise(year.collectedPaise)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The last row of a list: a + that opens the form for a new entry. */
function AddRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="list-row">
      <details className="group -mx-5 sm:-mx-6">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 font-medium transition-colors select-none hover:bg-canvas/50 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex size-7 items-center justify-center rounded-full bg-ink text-white transition-transform duration-200 group-open:rotate-45">
            <NavIconSvg icon="plus" className="size-4" />
          </span>
          {label}
        </summary>
        <div className="details-body border-t border-line px-5 pt-4 pb-5 sm:px-6">
          {children}
        </div>
      </details>
    </li>
  );
}

function PlanFields({
  name,
  months,
  fee,
}: {
  name: string;
  months: number;
  fee: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
      <Field label="Name" className="col-span-2 sm:col-span-1">
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={name}
          placeholder="Monthly"
          className={inputClass}
        />
      </Field>
      <Field label="Months">
        <input
          name="durationMonths"
          type="number"
          min={1}
          max={24}
          required
          defaultValue={months}
          className={inputClass}
        />
      </Field>
      <Field label="Fee (₹/month)">
        <input
          name="defaultFee"
          inputMode="decimal"
          required
          defaultValue={fee !== null ? paiseToInput(fee) : ""}
          placeholder="e.g. 600"
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/** Monday first, the way the gym writes its week. */
const WEEK: DayKey[] = [...DAY_KEYS.slice(1), DAY_KEYS[0]];

const DAY_NAMES: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const CLOSE_PARTS = [
  { value: "day", label: "All day" },
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
] as const;

function daySummary(openings: TimeRange[]): string {
  return openings.length ? openings.map(rangeLabel).join(" · ") : "Closed";
}

function crowdSummary(crowd: CrowdSettings): string {
  return `${crowd.comfortableCapacity} people · ×${crowd.calibrationMultiplier} · ${crowd.fullMinutes}–${crowd.goneMinutes} min`;
}

/** Members see only the level and the bar, never a number. */
function CrowdForm({ crowd }: { crowd: CrowdSettings }) {
  const number = (
    name: string,
    label: string,
    value: number,
    min: number,
    max: number,
    step = 1,
  ) => (
    <Field label={label}>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        required
        defaultValue={value}
        className={inputClass}
      />
    </Field>
  );
  return (
    <ActionForm
      action={saveCrowdSettings}
      submitLabel="Save"
      success="Saved."
      className="space-y-5"
    >
      <CrowdZones
        share={0}
        capacity={crowd.comfortableCapacity}
        label={`Quiet under ${Math.round(crowd.comfortableCapacity * 0.3)} people, busy over ${Math.round(crowd.comfortableCapacity * 0.7)}`}
      />
      <div className="grid grid-cols-2 gap-3">
        {number("capacity", "Capacity", crowd.comfortableCapacity, 1, 1000)}
        {number(
          "multiplier",
          "Multiplier",
          crowd.calibrationMultiplier,
          0.5,
          5,
          0.05,
        )}
      </div>
      <FadeCurve full={crowd.fullMinutes} gone={crowd.goneMinutes} />
      <div className="grid grid-cols-2 gap-3">
        {number("fullMinutes", "Full (min)", crowd.fullMinutes, 5, 235)}
        {number("goneMinutes", "Gone (min)", crowd.goneMinutes, 10, 240)}
      </div>
    </ActionForm>
  );
}

/** One weekday's morning and evening batch, each of which can be off. */
function DayHoursForm({ day, batches }: { day: DayKey; batches: Batches }) {
  const batch = (
    key: "morning" | "evening",
    label: string,
    fallback: TimeRange,
  ) => {
    const range = batches[key] ?? fallback;
    return (
      <fieldset className="space-y-2">
        <Checkbox
          name={`${key}On`}
          label={label}
          defaultChecked={batches[key] !== null}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens">
            <input
              name={`${key}Open`}
              type="time"
              defaultValue={range.open}
              className={inputClass}
            />
          </Field>
          <Field label="Closes">
            <input
              name={`${key}Close`}
              type="time"
              defaultValue={range.close}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>
    );
  };
  return (
    <ActionForm
      action={saveDayHours}
      submitLabel="Save hours"
      className="space-y-5"
    >
      <input type="hidden" name="day" value={day} />
      {batch("morning", "Morning batch", { open: "05:00", close: "10:00" })}
      {batch("evening", "Evening batch", { open: "16:00", close: "22:00" })}
    </ActionForm>
  );
}

function ClosureItem({
  closure,
  today,
}: {
  closure: ClosureRow;
  today: string;
}) {
  const what = closure.hours
    ? `Open ${closure.hours.map(rangeLabel).join(" · ")}`
    : "Closed all day";
  return (
    <li className="flex min-h-16 items-center gap-3 list-row py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {closure.date === today ? "Today" : dayLabel(closure.date)}
        </span>
        <span className="block text-sm text-muted">
          {[what, closure.reason].filter(Boolean).join(" · ")}
        </span>
      </span>
      <IconAction
        action={deleteClosure}
        fields={{ closureId: closure.id }}
        icon="trash"
        label={closure.date === today ? "Reopen today" : "Remove this closure"}
        confirm
        className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-ink hover:text-white"
      />
    </li>
  );
}
