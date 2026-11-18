// Record a payment: which plan it pays for (how many months) and the money
// actually received. Nothing is filled in or worked out from a fee; the
// amount typed is what every total and chart counts.
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Field, inputClass } from "@/components/ui/field";
import { formatDate, todayAtGym } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { PaymentFields } from "@/payments/components/payment-fields";
import { firstPaymentNextDue, nextDueAfter } from "@/payments/plan-quote";
import { recordPayment } from "../actions/payments";
import { listPlans, type Plan } from "../data/members";
import { getPaymentForm, type PaymentFormData } from "../data/payments";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { NotFound } from "./not-found";

export function RecordPaymentPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  useTitle("Record payment");
  const state = useLoad(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [form, plans] = await Promise.all([
      getPaymentForm(id),
      listPlans(true),
    ]);
    return form ? { form, plans } : null;
  }, [id]);
  return (
    <Loaded state={state}>
      {(loaded) =>
        loaded ? (
          <PaymentForm {...loaded} period={params.get("period")} />
        ) : (
          <NotFound />
        )
      }
    </Loaded>
  );
}

function PaymentForm({
  form,
  plans,
  period,
}: {
  form: PaymentFormData;
  plans: Plan[];
  period: string | null;
}) {
  const today = todayAtGym();
  const initial =
    form.periods.find((p) => String(p.index) === period) ?? form.periods[0];
  const [firstPeriod, setFirstPeriod] = useState(initial?.index ?? 0);
  // Nothing is filled in: staff pick the plan and type what they received.
  const [planId, setPlanId] = useState<string | null>(null);
  const [duesFrom, setDuesFrom] = useState("");
  const [paidOn, setPaidOn] = useState(today);

  // After a save the screen loads fresh figures: start the form over, so
  // the payment just recorded isn't left in the boxes to send twice.
  const [loadedForm, setLoadedForm] = useState(form);
  const [formKey, setFormKey] = useState(0);
  if (loadedForm !== form) {
    setLoadedForm(form);
    setFirstPeriod(form.periods[0]?.index ?? 0);
    setPlanId(null);
    setDuesFrom("");
    setFormKey((key) => key + 1);
  }

  const picked = plans.find((plan) => plan.id === planId) ?? null;
  const months = picked?.durationMonths ?? 0;
  const start = form.periods.find((p) => p.index === firstPeriod);
  const nextDue = picked
    ? form.firstPayment
      ? firstPaymentNextDue(duesFrom || paidOn, months)
      : nextDueAfter(form.periods, firstPeriod, months)
    : null;

  return (
    <section className="max-w-2xl">
      <header className="page-header">
        <BackLink
          href={`/app/members/${form.member.id}`}
          label={form.member.fullName}
          className="mb-1"
        />
        <h1 className="page-title">Record payment</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-muted">{form.member.memberCode}</span>
          <span className="rounded-badge bg-canvas px-2 py-1 font-medium tabular-nums">
            {form.feePaise === 0 ? "Free" : `${formatPaise(form.feePaise)}/mo`}
          </span>
          {form.owedPaise > 0 && (
            <span className="rounded-badge bg-ink px-2 py-1 font-semibold text-white tabular-nums">
              <span className="sr-only">Owes </span>
              {formatPaise(form.owedPaise)}
            </span>
          )}
        </p>
      </header>

      {form.periods.length === 0 ? (
        <p className="mt-8 text-lg">Nothing to pay</p>
      ) : plans.length === 0 ? (
        <p className="mt-8 callout">
          Add a plan (Monthly, Quarterly…) in Settings first. A payment is
          recorded against a plan&apos;s length.
        </p>
      ) : (
        <ActionForm
          key={formKey}
          action={recordPayment}
          submitLabel="Record payment"
          className="mt-6 space-y-5"
        >
          <input type="hidden" name="memberId" value={form.member.id} />
          <input type="hidden" name="membershipId" value={form.membershipId} />
          <input type="hidden" name="months" value={months || ""} />

          <fieldset>
            <legend className="text-sm font-semibold">Pays for</legend>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {plans.map((plan) => {
                const on = plan.id === planId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlanId(on ? null : plan.id)}
                    className={`flex min-h-16 min-w-0 flex-col items-start justify-center rounded-control px-4 py-2 text-left ring-1 transition-colors ${on ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:ring-ink/30"}`}
                  >
                    <span className="w-full truncate font-semibold">
                      {plan.name}
                    </span>
                    <span
                      className={`text-xs tabular-nums ${on ? "text-white/70" : "text-muted"}`}
                    >
                      {plan.durationMonths}{" "}
                      {plan.durationMonths === 1 ? "month" : "months"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted" aria-live="polite">
              {picked ? (
                <>
                  {start && !form.firstPayment
                    ? `From ${formatDate(start.dueOn)}`
                    : "Pays"}{" "}
                  {months} {months === 1 ? "month" : "months"}
                  {nextDue ? (
                    <>
                      . Next due{" "}
                      <strong className="text-ink">
                        {formatDate(nextDue)}
                      </strong>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "Pick one."
              )}
            </p>
          </fieldset>

          {form.firstPayment ? (
            <>
              {/* The first payment starts the dues, from any day. */}
              <input
                type="hidden"
                name="firstPeriod"
                value={form.periods[0].index}
              />
              <Field label="Due from" hint="Blank: same as paid on.">
                <input
                  name="duesFrom"
                  type="date"
                  value={duesFrom}
                  onChange={(event) => setDuesFrom(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <Field label="Starting from">
              <select
                name="firstPeriod"
                value={firstPeriod}
                onChange={(event) => setFirstPeriod(Number(event.target.value))}
                className={inputClass}
              >
                {form.periods.map((option) => (
                  <option key={option.index} value={option.index}>
                    {formatDate(option.dueOn)}
                    {option.status === "overdue" ? " · overdue" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <PaymentFields today={today} onPaidOnChange={setPaidOn} />
        </ActionForm>
      )}
    </section>
  );
}
