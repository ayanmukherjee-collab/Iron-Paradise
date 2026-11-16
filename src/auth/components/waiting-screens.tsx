// Home screens for accounts with nothing to open yet: a guest waiting to be
// linked to a membership, or an account the owner switched off. They stand
// alone, with no navigation around them (see the /app layout).
import type { ReactNode } from "react";
import { signOut } from "@/auth/sign-in-actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { NavIconSvg } from "@/components/nav/nav-icons";
import Link from "@/components/ui/link";
import { Dial, iconButton } from "@/components/ui/viz";

/**
 * The frame for screens shown with no navigation: the brand on top, a way
 * out, and the content centred in what's left.
 */
function StandaloneScreen({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-auto" />
          <span className="display text-xl leading-none">Iron Paradise</span>
        </span>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className={`${iconButton} bg-white/70 text-muted ring-1 ring-line hover:bg-white hover:text-ink`}
          >
            <NavIconSvg icon="signOut" className="size-5" />
          </button>
        </form>
      </header>
      <div className="flex flex-1 flex-col justify-center gap-3 py-8">
        {children}
      </div>
    </>
  );
}

export function AccountSwitchedOff() {
  return (
    <StandaloneScreen>
      <section className="flex flex-col items-center card-dark px-6 py-10 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-white/10">
          <NavIconSvg icon="power" className="size-9" />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Switched off
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Talk to the owner at the gym.
        </p>
      </section>
    </StandaloneScreen>
  );
}

const waitingSteps = [
  { label: "Signed in", state: "done" },
  { label: "Gym links you", state: "now" },
  { label: "You're in", state: "next" },
] as const;

export function WaitingForGym({ email }: { email: string | null }) {
  return (
    <StandaloneScreen>
      <section className="panel-dots flex flex-col items-center card-dark px-6 pt-10 pb-7 text-center">
        {/* One of three steps done, the next one under way. */}
        <span className="relative flex items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute size-28 animate-ping rounded-full bg-white/[0.06] [animation-duration:2.4s]"
          />
          <Dial
            value={1}
            max={3}
            size={128}
            stroke={8}
            tone="dark"
            label="Step 2 of 3"
          >
            <NavIconSvg icon="clock" className="size-10" />
          </Dial>
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Nearly there
        </h1>
        <p className="mt-2 text-sm text-white/60">
          The gym links this account to your membership.
        </p>

        <ol className="mt-7 grid w-full grid-cols-3 gap-2">
          {waitingSteps.map((step) => (
            <li
              key={step.label}
              aria-current={step.state === "now" ? "step" : undefined}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={`h-1.5 w-full rounded-full ${
                  step.state === "done"
                    ? "bg-white"
                    : step.state === "now"
                      ? "animate-pulse bg-white/50"
                      : "bg-white/12"
                }`}
              />
              <span
                className={`text-xs ${step.state === "next" ? "text-white/40" : "text-white/80"}`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {email && (
        <section className="flex items-center gap-4 card p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-canvas">
            <NavIconSvg icon="user" className="size-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted">Show at the desk</span>
            <strong className="block text-lg font-semibold break-all">
              {email}
            </strong>
          </span>
        </section>
      )}

      <section className="flex items-center gap-4 card p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-canvas">
          <NavIconSvg icon="link" className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-muted">Or</span>
          <strong className="block text-lg font-semibold">
            Open the WhatsApp link
          </strong>
        </span>
      </section>

      <Link href="/app" className="mt-2 btn-dark w-full">
        <NavIconSvg icon="refresh" className="size-[1.1rem]" />
        Check again
      </Link>
    </StandaloneScreen>
  );
}
