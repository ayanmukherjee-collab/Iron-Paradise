import { ActionForm } from "@/components/ui/action-form";
import { Field, inputClass } from "@/components/ui/field";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPaise, paiseToInput } from "@/lib/money";
import { correctPayment, voidPayment } from "@/payments/actions";
import { PaymentFields } from "@/payments/components/payment-fields";
import { methodLabels } from "@/payments/describe";
import type { PaymentEntry } from "@/payments/queries";

export function PaymentHistory({
  history,
  canVoid,
  today,
}: {
  history: PaymentEntry[];
  canVoid: boolean;
  today: string;
}) {
  if (history.length === 0) {
    return <p className="text-smoke">No payments recorded yet.</p>;
  }

  return (
    <ul className="border-t-2 border-ink">
      {history.map((payment) => (
        <li key={payment.id} className="border-b-2 border-ink py-3">
          <div className={payment.void ? "text-smoke line-through" : ""}>
            <strong className="text-lg">
              {formatPaise(payment.amountPaise)}
            </strong>{" "}
            · {formatDate(payment.paidOn)} · {methodLabels[payment.method]}
            {payment.covers && <> · {coverText(payment.covers)}</>}
          </div>
          <p className="text-sm text-smoke">
            {payment.receiptNumber && <>Receipt {payment.receiptNumber} · </>}
            Recorded {formatDateTime(payment.recordedAt)}
            {payment.recordedBy && <> by {payment.recordedBy}</>}
            {payment.replacesPaymentId && <> · correction</>}
            {payment.note && <> · {payment.note}</>}
          </p>
          {payment.void && (
            <p className="text-sm">
              <strong>Voided</strong> {formatDateTime(payment.void.voidedAt)}:{" "}
              {payment.void.reason}
            </p>
          )}
          {canVoid && !payment.void && (
            <OwnerCorrections payment={payment} today={today} />
          )}
        </li>
      ))}
    </ul>
  );
}

function coverText(covers: NonNullable<PaymentEntry["covers"]>): string {
  return covers.from === covers.to
    ? `for ${formatDate(covers.from)}`
    : `for ${formatDate(covers.from)} to ${formatDate(covers.to)}`;
}

function OwnerCorrections({
  payment,
  today,
}: {
  payment: PaymentEntry;
  today: string;
}) {
  return (
    <details className="mt-2">
      <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold underline underline-offset-4">
        Void or correct
      </summary>
      <div className="mt-4 grid gap-10 lg:grid-cols-2">
        <ActionForm
          action={voidPayment}
          submitLabel="Void payment"
          variant="outline-dark"
          className="space-y-4"
        >
          <h3 className="text-lg font-bold">Void</h3>
          <p className="text-smoke">
            For an entry that should never have been made. It stays in the
            history, crossed out.
          </p>
          <input type="hidden" name="paymentId" value={payment.id} />
          <ReasonField />
        </ActionForm>
        <ActionForm
          action={correctPayment}
          submitLabel="Save correction"
          className="space-y-4"
        >
          <h3 className="text-lg font-bold">Correct</h3>
          <p className="text-smoke">
            Voids this entry and records the right one in its place.
          </p>
          <input type="hidden" name="paymentId" value={payment.id} />
          <PaymentFields
            today={today}
            defaults={{
              amount: paiseToInput(payment.amountPaise),
              method: payment.method,
              paidOn: payment.paidOn,
              receiptNumber: payment.receiptNumber,
              note: payment.note,
            }}
          />
          <ReasonField />
        </ActionForm>
      </div>
    </details>
  );
}

function ReasonField() {
  return (
    <Field label="Reason" hint="Kept in the audit log">
      <input
        name="reason"
        required
        minLength={3}
        maxLength={500}
        className={inputClass}
      />
    </Field>
  );
}
