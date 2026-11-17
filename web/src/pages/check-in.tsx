import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import type { CheckInResult } from "@/attendance/types";
import { isCheckInCode } from "@/attendance/code";
import { CheckIn } from "@/attendance/components/check-in";
import { useViewer } from "../auth/viewer";
import { dataOf, runAction } from "../data/action";
import { getOwnStanding } from "../data/own-standing";
import { supabase } from "../lib/supabase";

/**
 * Member check-in, straight to the database: public.check_in checks the code
 * and records the visit (once a day), exactly as when the server called it.
 * Then the phone works out what the member owes from their own payments.
 */
export function CheckInPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
  const code = params.get("c");
  const initialCode = isCheckInCode(code) ? code : null;

  useEffect(() => {
    document.title = "Check in | Iron Paradise";
    // The code is in the address; keep it out of any Referer header.
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  const checkIn = useCallback(
    ({ code }: { code: string }) =>
      runAction(async (): Promise<CheckInResult> => {
        const status = dataOf(
          await supabase.rpc("check_in", { code }),
        ) as CheckInResult["status"];
        const standing = await getOwnStanding(viewer.userId);
        return {
          status,
          firstName: (standing.fullName ?? viewer.fullName).split(" ")[0],
          owedPaise: standing.owedPaise,
        };
      }),
    [viewer],
  );

  return (
    <section className="max-w-prose">
      <header className="page-header mb-4">
        <h1 className="page-title">Check in</h1>
      </header>
      <CheckIn
        key={initialCode ?? "scan"}
        initialCode={initialCode}
        checkIn={checkIn}
      />
    </section>
  );
}
