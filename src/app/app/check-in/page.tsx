import type { Metadata } from "next";
import { checkIn } from "@/attendance/actions";
import { isCheckInCode } from "@/attendance/code";
import { CheckIn } from "@/attendance/components/check-in";
import { requirePermission } from "@/auth/session";

export const metadata: Metadata = {
  title: "Check in",
  // The code is in the address; keep it out of any Referer header.
  referrer: "no-referrer",
};

export default async function CheckInPage({
  searchParams,
}: PageProps<"/app/check-in">) {
  const { c } = await searchParams;
  const code = isCheckInCode(c) ? c : null;
  await requirePermission(
    "self.checkIn",
    code ? `/app/check-in?c=${code}` : "/app/check-in",
  );

  return (
    <section className="max-w-prose">
      <h1 className="page-title">Check in</h1>
      <p className="mt-4 mb-8 text-lg">
        Scan the QR code on the front desk. Once a day is all it takes.
      </p>
      <CheckIn key={code ?? "scan"} initialCode={code} checkIn={checkIn} />
    </section>
  );
}
