import { Field, inputClass } from "@/components/ui/field";
import { methodLabels } from "@/payments/describe";

/** Amount, method, date, receipt and note: shared by record and correct. */
export function PaymentFields({
  today,
  defaults = {},
}: {
  today: string;
  defaults?: {
    amount?: string;
    method?: keyof typeof methodLabels;
    paidOn?: string;
    receiptNumber?: string | null;
    note?: string | null;
  };
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount received (₹)">
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={defaults.amount}
            className={inputClass}
          />
        </Field>
        <Field label="Paid on">
          <input
            name="paidOn"
            type="date"
            required
            max={today}
            defaultValue={defaults.paidOn ?? today}
            className={inputClass}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">How they paid</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(methodLabels) as (keyof typeof methodLabels)[]).map(
            (method) => (
              <label
                key={method}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-control bg-white px-5 font-medium ring-1 ring-line transition-colors hover:ring-ink/30 has-checked:bg-ink has-checked:text-white has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-ink"
              >
                <input
                  type="radio"
                  name="method"
                  value={method}
                  required
                  defaultChecked={method === (defaults.method ?? "cash")}
                  className="sr-only"
                />
                {methodLabels[method]}
              </label>
            ),
          )}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Receipt number (optional)">
          <input
            name="receiptNumber"
            maxLength={40}
            defaultValue={defaults.receiptNumber ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Note (optional)">
          <input
            name="note"
            maxLength={500}
            defaultValue={defaults.note ?? ""}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}
