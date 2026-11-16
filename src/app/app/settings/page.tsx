import type { Metadata } from "next";
import { saveBatches } from "@/attendance/actions";
import { batchHours, toTimeInput } from "@/attendance/batches";
import { getBatches } from "@/attendance/queries";
import { requirePermission } from "@/auth/session";
import { NavIconSvg } from "@/components/nav/nav-icons";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { formatPaise, paiseToInput } from "@/lib/money";
import { saveGoneQuietDays, savePlan } from "@/members/actions";
import { getGoneQuietDays, listPlans } from "@/members/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requirePermission("plans.edit", "/app/settings");
  const [plans, quietDays, batches] = await Promise.all([
    listPlans(viewer),
    getGoneQuietDays(viewer),
    getBatches(viewer),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Settings</h1>

      <section>
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="section-title">Plans</h2>
            <p className="mt-0.5 text-sm text-muted">
              Fills in the usual fee when someone joins. Changing a plan never
              changes what existing members pay.
            </p>
          </div>
        </div>

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
                    label="Offer this plan to new members"
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
        <h2 className="px-1 section-title">Gym rules</h2>
        <ul className="mt-3 list-card">
          <li className="list-row">
            <Row
              title="Training batches"
              detail={`Morning ${batchHours(batches, "morning")} · Evening ${batchHours(batches, "evening")}`}
            >
              <ActionForm
                action={saveBatches}
                submitLabel="Save batches"
                className="space-y-4"
              >
                <p className="text-sm text-muted">
                  Check-ins only count during these hours. Outside them, the QR
                  scan and staff marking are both refused.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Morning opens">
                    <input
                      name="morningOpens"
                      type="time"
                      required
                      defaultValue={toTimeInput(batches.morningOpens)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Morning closes">
                    <input
                      name="morningCloses"
                      type="time"
                      required
                      defaultValue={toTimeInput(batches.morningCloses)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Evening opens">
                    <input
                      name="eveningOpens"
                      type="time"
                      required
                      defaultValue={toTimeInput(batches.eveningOpens)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Evening closes">
                    <input
                      name="eveningCloses"
                      type="time"
                      required
                      defaultValue={toTimeInput(batches.eveningCloses)}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </ActionForm>
            </Row>
          </li>
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
                <Field
                  label="Days with no visit or payment"
                  hint="Members past this show in the Gone quiet list. Nobody is marked inactive automatically."
                >
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
        <span className="shrink-0 rounded-control px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-line group-open:bg-ink group-open:text-white group-open:ring-ink">
          <span className="group-open:hidden">Edit</span>
          <span className="hidden group-open:inline">Close</span>
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
