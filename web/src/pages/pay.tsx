// Mirrors src/app/app/members/[id]/pay/page.tsx.
import { useParams, useSearchParams } from "react-router";
import { ActionForm } from "@/components/ui/action-form";
import { BackLink } from "@/components/ui/back-link";
import { Field, inputClass } from "@/components/ui/field";
import { todayAtGym } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { PaymentFields } from "@/payments/components/payment-fields";
import { describePeriod } from "@/payments/describe";
import { recordPayment } from "../actions/payments";
import { getPaymentForm, type PaymentFormData } from "../data/payments";
import { Loaded, useLoad, useTitle } from "../data/use-load";
import { NotFound } from "./not-found";

export function RecordPaymentPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  useTitle("Record payment");
  const state = useLoad(
    async () => (/^[0-9a-f-]{36}$/i.test(id) ? getPaymentForm(id) : null),
    [id],
  );
  return (
    <Loaded state={state}>
      {(form) =>
        form ? (
          <PaymentForm form={form} period={params.get("period")} />
        ) : (
          <NotFound />
        )
      }
    </Loaded>
  );
}

function PaymentForm({
  form,
  period,
}: {
  form: PaymentFormData;
  period: string | null;
}) {
  const chosen =
    form.periods.find((p) => String(p.index) === period) ?? form.periods[0];
  const suggested = chosen ? chosen.feePaise - chosen.paidPaise : 0;

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
          className="mt-8 space-y-5"
        >
          <input type="hidden" name="memberId" value={form.member.id} />
          <input type="hidden" name="membershipId" value={form.membershipId} />
          {form.firstPayment ? (
            <>
              {/* The first payment starts the dues, from any day. */}
              <input
                type="hidden"
                name="firstPeriod"
                value={form.periods[0].index}
              />
              <Field label="Due from" hint="Blank: same as paid on.">
                <input name="duesFrom" type="date" className={inputClass} />
              </Field>
            </>
          ) : (
            <Field
              label="Pays from"
              hint="Anything above this month's fee goes to the months after it."
            >
              <select
                name="firstPeriod"
                defaultValue={chosen?.index}
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
            today={todayAtGym()}
            defaults={{
              amount: suggested > 0 ? paiseToInput(suggested) : undefined,
            }}
          />
        </ActionForm>
      )}
    </section>
  );
}
