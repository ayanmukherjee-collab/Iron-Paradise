import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { PaymentHistory } from "@/payments/components/payment-history";
import { StandingBadge } from "@/payments/components/standing-badge";
import type { MemberPayments as MemberPaymentsData } from "@/payments/queries";

/** The payments block on a member's page: where they stand, then history. */
export function MemberPayments({
  memberId,
  data,
  canRecord,
  canVoid,
  today,
}: {
  memberId: string;
  data: MemberPaymentsData;
  canRecord: boolean;
  canVoid: boolean;
  today: string;
}) {
  const { ledger } = data;
  return (
    <div className="space-y-6">
      {ledger && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <StandingBadge standing={ledger.standing} />
          {ledger.owedPaise > 0 && (
            <p className="text-lg">
              Owes <strong>{formatPaise(ledger.owedPaise)}</strong>
            </p>
          )}
          {ledger.nextUnpaid && (
            <p className="text-smoke">
              {ledger.nextUnpaid.dueOn < today ? "Unpaid since" : "Next due"}{" "}
              {formatDate(ledger.nextUnpaid.dueOn)}
            </p>
          )}
          {ledger.creditPaise > 0 && (
            <p className="text-smoke">
              {formatPaise(ledger.creditPaise)} credit waiting for the next due
              date
            </p>
          )}
        </div>
      )}
      {canRecord && ledger && (
        <Link
          href={`/app/members/${memberId}/pay`}
          className="inline-flex min-h-12 items-center bg-ink px-6 text-sm font-bold tracking-[0.08em] text-white uppercase hover:bg-ash"
        >
          Record payment
        </Link>
      )}
      <PaymentHistory history={data.history} canVoid={canVoid} today={today} />
    </div>
  );
}
