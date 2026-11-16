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
      <header className="page-header mb-4">
        <h1 className="page-title">Check in</h1>
      </header>
      <CheckIn key={code ?? "scan"} initialCode={code} checkIn={checkIn} />
    </section>
  );
}
