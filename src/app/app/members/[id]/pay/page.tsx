import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Field, inputClass } from "@/components/ui/field";
import { todayAtGym } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { recordPayment } from "@/payments/actions";
import { PaymentFields } from "@/payments/components/payment-fields";
import { describePeriod } from "@/payments/describe";
import { getPaymentForm } from "@/payments/queries";

export const metadata: Metadata = { title: "Record payment" };

export default async function RecordPaymentPage({
  params,
  searchParams,
}: PageProps<"/app/members/[id]/pay">) {
  const { id } = await params;
  const viewer = await requirePermission(
    "payments.record",
    `/app/members/${id}/pay`,
  );
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const form = await getPaymentForm(viewer, id);
  if (!form) notFound();

  const { period } = await searchParams;
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
