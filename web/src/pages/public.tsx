// Pages outside the signed-in app: claim link, desk display, offline.
import { useEffect } from "react";
import { useParams } from "react-router";
import { DeskScreen, type DeskCode } from "@/attendance/components/desk-screen";
import { LogoMark } from "@/components/brand/logo-mark";
import Link from "@/components/ui/link";
import { ClaimForm } from "@/members/components/claim-form";
import { useViewerState } from "../auth/viewer";
import { Refusal } from "../data/action";
import { getDeskCode } from "../data/attendance";
import { useTitle } from "../data/use-load";

/** Keeps a secret link out of Referer headers while the page is open. */
function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
}

/** Mirrors src/app/claim/[token]/page.tsx. */
export function ClaimPage() {
  const { token = "" } = useParams();
  const state = useViewerState();
  useTitle("Claim your membership");
  useNoReferrer();
  const returnTo = `/claim/${encodeURIComponent(token)}`;
  const viewer = state.status === "ready" ? state.viewer : null;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-charcoal px-4 py-16 text-center text-white">
      <LogoMark className="h-16 w-auto" />
      <h1 className="mt-8 display text-5xl">Your membership</h1>

      {state.status === "loading" ? (
        <p role="status" className="mt-4 text-lg text-mist">
          Loading…
        </p>
      ) : !viewer ? (
        <>
          <p className="mt-4 max-w-sm text-lg text-mist">
            The gym sent you this link. Sign in with Google and it will be
            connected to your membership.
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
            className="mt-8 inline-flex min-h-12 items-center bg-white px-6 text-sm font-bold tracking-[0.08em] text-ink uppercase hover:bg-mist"
          >
            Sign in to continue
          </Link>
        </>
      ) : viewer.role !== "guest" ? (
        <>
          <p className="mt-4 max-w-sm text-lg text-mist">
            This account is already set up. If the link was meant for someone
            else, pass it on.
          </p>
          <Link
            href="/app"
            className="mt-8 font-semibold underline underline-offset-4"
          >
            Go to the app
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 max-w-sm text-lg text-mist">
            Signed in as{" "}
            <strong className="break-all text-white">{viewer.email}</strong>.
            Connect this account to your gym membership?
          </p>
          <ClaimForm token={token} />
        </>
      )}
    </main>
  );
}

/** Asks the database for the next code (public.desk_code). */
async function loadDeskCode(token: string): Promise<DeskCode> {
  try {
    return await getDeskCode(token);
  } catch (error) {
    // A refusal (switched-off link) is shown on the screen; anything else
    // means the network is down, and DeskScreen retries.
    if (error instanceof Refusal) return { error: error.message };
    throw error;
  }
}

/** Mirrors src/app/desk/[token]/page.tsx. */
export function DeskPage() {
  const { token = "" } = useParams();
  useTitle("Desk check-in");
  useNoReferrer();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-charcoal px-4 py-8 text-white">
      <div className="flex items-center gap-4">
        <LogoMark className="h-12 w-auto" />
        <p className="display text-4xl">Scan to check in</p>
      </div>
      <DeskScreen
        token={token}
        origin={window.location.origin}
        loadCode={loadDeskCode}
      />
      <p className="max-w-md text-center text-lg text-mist">
        Open the Iron Paradise app, tap <strong>Check in</strong>, and point
        your camera here.
      </p>
    </main>
  );
}

/** Mirrors src/app/~offline/page.tsx. */
export function OfflinePage() {
  useTitle("Offline");
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-charcoal px-4 text-center text-white">
      <LogoMark className="h-16 w-auto" />
      <h1 className="mt-8 display text-5xl">No signal</h1>
      <p className="mt-4 max-w-sm text-lg text-mist">
        This phone is offline. Get back on Wi-Fi or mobile data and the app
        picks up where you left off.
      </p>
    </main>
  );
}
