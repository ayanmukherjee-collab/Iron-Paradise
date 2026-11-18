// Mirrors src/app/app/members/[id]/pay/page.tsx, plus quick record by plan.
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Field, inputClass } from "@/components/ui/field";
import { formatDate, todayAtGym } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { PaymentFields } from "@/payments/components/payment-fields";
import { describePeriod } from "@/payments/describe";
import { firstPaymentNextDue, planQuote } from "@/payments/plan-quote";
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
  const chosen =
    form.periods.find((p) => p.index === firstPeriod) ?? form.periods[0];
  const suggested = chosen ? chosen.feePaise - chosen.paidPaise : 0;
  const [amount, setAmount] = useState(
    suggested > 0 ? paiseToInput(suggested) : "",
  );
  const [planId, setPlanId] = useState<string | null>(null);
  const [duesFrom, setDuesFrom] = useState("");
  const [paidOn, setPaidOn] = useState(today);

  // After a save the screen loads fresh figures: start the form over from
  // them, so the amount just recorded isn't left in the box to send twice.
  const [loadedForm, setLoadedForm] = useState(form);
  if (loadedForm !== form) {
    setLoadedForm(form);
    const first = form.periods[0];
    const left = first ? first.feePaise - first.paidPaise : 0;
    setFirstPeriod(first?.index ?? 0);
    setAmount(left > 0 ? paiseToInput(left) : "");
    setPlanId(null);
    setDuesFrom("");
  }

  // Plans only make sense for a paying member; each is priced at this
  // member's own fee, for as many months as the plan runs.
  const quotes =
    form.feePaise > 0
      ? plans.flatMap((plan) => {
          const quote = planQuote(
            form.periods,
            firstPeriod,
            plan.durationMonths,
          );
          return quote ? [{ plan, quote }] : [];
        })
      : [];
  const picked = quotes.find(({ plan }) => plan.id === planId) ?? null;
  const nextDue = picked
    ? form.firstPayment
      ? firstPaymentNextDue(duesFrom || paidOn, picked.plan.durationMonths)
      : picked.quote.nextDueOn
    : null;

  const pickPlan = (id: string | null) => {
    setPlanId(id);
    const quote = quotes.find(({ plan }) => plan.id === id)?.quote;
    setAmount(
      quote
        ? paiseToInput(quote.amountPaise)
        : suggested > 0
          ? paiseToInput(suggested)
          : "",
    );
  };

  const changePeriod = (index: number) => {
    setFirstPeriod(index);
    const next = form.periods.find((p) => p.index === index);
    const plan = plans.find((p) => p.id === planId);
    const quote =
      plan && next ? planQuote(form.periods, index, plan.durationMonths) : null;
    if (quote) setAmount(paiseToInput(quote.amountPaise));
    else {
      setPlanId(null);
      const left = next ? next.feePaise - next.paidPaise : 0;
      setAmount(left > 0 ? paiseToInput(left) : "");
    }
  };

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
      ) : (
        <ActionForm
          action={recordPayment}
          submitLabel="Record payment"
          className="mt-6 space-y-5"
        >
          <input type="hidden" name="memberId" value={form.member.id} />
          <input type="hidden" name="membershipId" value={form.membershipId} />

          {quotes.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold">Quick record</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {quotes.map(({ plan, quote }) => {
                  const on = plan.id === planId;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickPlan(on ? null : plan.id)}
                      className={`flex min-h-16 min-w-0 flex-col items-start justify-center rounded-control px-4 py-2 text-left ring-1 transition-colors ${on ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:ring-ink/30"}`}
                    >
                      <span className="w-full truncate font-semibold">
                        {plan.name}
                      </span>
                      <span
                        className={`text-xs tabular-nums ${on ? "text-white/70" : "text-muted"}`}
                      >
                        {plan.durationMonths}{" "}
                        {plan.durationMonths === 1 ? "month" : "months"} ·{" "}
                        {formatPaise(quote.amountPaise)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {picked && (
                <p className="mt-2 callout text-sm" aria-live="polite">
                  Pays {picked.plan.durationMonths}{" "}
                  {picked.plan.durationMonths === 1 ? "month" : "months"}
                  {nextDue ? (
                    <>
                      . Next due <strong>{formatDate(nextDue)}</strong>
                    </>
                  ) : null}
                  .
                </p>
              )}
            </fieldset>
          )}

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
            <Field
              label="Pays from"
              hint="Anything above this month's fee goes to the months after it."
            >
              <select
                name="firstPeriod"
                value={firstPeriod}
                onChange={(event) => changePeriod(Number(event.target.value))}
                className={inputClass}
              >
                {form.periods.map((option) => (
                  <option key={option.index} value={option.index}>
                    {describePeriod(option)}
                    {option.status === "overdue" ? " · overdue" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <PaymentFields
            today={today}
            amount={amount}
            onAmountChange={(value) => {
              setAmount(value);
              setPlanId(null);
            }}
            onPaidOnChange={setPaidOn}
          />
        </ActionForm>
      )}
    </section>
  );
}
