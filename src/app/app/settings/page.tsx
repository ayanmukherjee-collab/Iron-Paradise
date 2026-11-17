import type { Metadata } from "next";
import { requirePermission } from "@/auth/session";
import {
  deleteClosure,
  publishBulletinNow,
  saveClosure,
  saveDayHours,
} from "@/bulletin/actions";
import { IconAction } from "@/bulletin/components/icon-action";
import {
  dayLabel,
  rangeLabel,
  splitBatches,
  type Batches,
} from "@/bulletin/hours";
import { getHoursSettings, type ClosureRow } from "@/bulletin/queries";
import { DAY_KEYS, type DayKey, type TimeRange } from "@/bulletin/types";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { todayAtGym } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { saveGoneQuietDays, savePlan } from "@/members/actions";
import { getGoneQuietDays, listPlans } from "@/members/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requirePermission("plans.edit", "/app/settings");
  const [plans, quietDays, hours] = await Promise.all([
    listPlans(viewer),
    getGoneQuietDays(viewer),
    getHoursSettings(viewer),
  ]);
  const today = todayAtGym();

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
      </header>

      <section>
        <h2 className="px-1 section-title">Plans</h2>

        <ul className="mt-3 list-card">
          {plans.map((plan) => (
            <li key={plan.id} className="list-row">
              <Row
                title={plan.name}
                detail={`${formatPaise(plan.defaultFeePaise)} a month · ${plan.durationMonths} ${plan.durationMonths === 1 ? "month" : "months"}`}
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
          <li className="list-row">
            <details className="group -mx-5 sm:-mx-6">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 font-medium transition-colors hover:bg-canvas/50 sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 items-center justify-center rounded-badge bg-ink text-white">
                  <NavIconSvg icon="plus" className="size-4" />
                </span>
                New plan
              </summary>
              <div className="px-5 pt-1 pb-5 sm:px-6">
                <ActionForm
                  action={savePlan}
                  submitLabel="Create plan"
                  success="Plan added."
                  className="space-y-4"
                >
                  <input type="hidden" name="planId" value="" />
                  <PlanFields name="" months={1} fee={null} />
                </ActionForm>
              </div>
            </details>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="px-1 section-title">Opening hours</h2>
        <p className="mt-1 px-1 text-sm text-muted">
          Check-ins are refused outside these. Members see them on their phones.
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
        <h2 className="px-1 section-title">Closures</h2>
        <p className="mt-1 px-1 text-sm text-muted">
          Holidays and short days. To close today, use the tiles on Home.
        </p>
        <ul className="mt-3 list-card">
          {hours.closures.map((closure) => (
            <ClosureItem key={closure.id} closure={closure} />
          ))}
          <li className="list-row">
            <details className="group -mx-5 sm:-mx-6">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 font-medium transition-colors hover:bg-canvas/50 sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 items-center justify-center rounded-badge bg-ink text-white">
                  <NavIconSvg icon="plus" className="size-4" />
                </span>
                New closure
              </summary>
              <div className="px-5 pt-1 pb-5 sm:px-6">
                <ActionForm
                  action={saveClosure}
                  submitLabel="Save closure"
                  className="space-y-4"
                >
                  <Field label="Day">
                    <input
                      name="date"
                      type="date"
                      required
                      min={today}
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
                    <input
                      name="reason"
                      maxLength={80}
                      className={inputClass}
                    />
                  </Field>
                </ActionForm>
              </div>
            </details>
          </li>
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

      <section>
        <h2 className="px-1 section-title">Members&apos; app</h2>
        <ul className="mt-3 list-card">
          <li className="list-row">
            <Row
              title="Bulletin"
              detail="Hours and notices on members' phones. Every save updates it."
            >
              <p className="mb-4 text-sm text-muted">
                Use this only if members see something out of date a few minutes
                after a save. It sends what&apos;s saved now.
              </p>
              <ActionForm
                action={publishBulletinNow}
                submitLabel="Publish now"
                pendingLabel="Publishing…"
                variant="outline-dark"
              />
            </Row>
          </li>
        </ul>
      </section>
    </div>
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
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas/50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {badge && (
              <span className="rounded-badge bg-canvas px-2 py-0.5 text-xs text-muted">
                {badge}
              </span>
            )}
          </span>
          <span className="block text-sm text-muted">{detail}</span>
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control text-muted ring-1 ring-line group-open:bg-ink group-open:text-white group-open:ring-ink">
          <NavIconSvg icon="gear" className="size-4 group-open:hidden" />
          <NavIconSvg icon="close" className="hidden size-4 group-open:block" />
          <span className="sr-only">Edit</span>
        </span>
      </summary>
      <div className="px-5 pt-1 pb-5 sm:px-6">{children}</div>
    </details>
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

function ClosureItem({ closure }: { closure: ClosureRow }) {
  const what = closure.hours
    ? `Open ${closure.hours.map(rangeLabel).join(" · ")}`
    : "Closed all day";
  return (
    <li className="flex min-h-16 items-center gap-3 list-row py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{dayLabel(closure.date)}</span>
        <span className="block text-sm text-muted">
          {[what, closure.reason].filter(Boolean).join(" · ")}
        </span>
      </span>
      <IconAction
        action={deleteClosure}
        fields={{ closureId: closure.id }}
        icon="trash"
        label="Remove this closure"
        confirm
        className="flex size-9 shrink-0 items-center justify-center rounded-control text-muted ring-1 ring-line transition-colors hover:bg-ink hover:text-white"
      />
    </li>
  );
}
