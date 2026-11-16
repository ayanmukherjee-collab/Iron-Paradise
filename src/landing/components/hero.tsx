import Link from "@/components/ui/link";
import { LogoMark } from "@/components/brand/logo-mark";
import {
  art,
  contact,
  finalCta,
  gym,
  hero,
  nav,
  quickActions,
  whatsappLink,
} from "@/content/landing";
import { DAY_SHORT, hourLabel, type OpenStatus } from "../open-status";
import { ArtImage } from "./art-image";
import { ButtonLink, SmartLink } from "./button-link";
import { Icon, type LandingIcon } from "./icons";

export function SiteHeader() {
  return (
    <header className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-3 sm:px-4">
      <Link
        href="/"
        className="flex items-center gap-2.5"
        aria-label={`${gym.fullName} home`}
      >
        <LogoMark className="h-8 w-auto" />
        <span className="display text-2xl leading-none uppercase">
          {gym.name}
        </span>
      </Link>

      <nav
        aria-label="Sections"
        className="hidden items-center gap-1.5 md:flex"
      >
        {nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="inline-flex min-h-10 items-center gap-2 rounded-control px-3.5 text-sm font-medium text-mist transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Icon name={item.icon} className="size-[1.125rem]" />
            {item.label}
          </a>
        ))}
      </nav>

      <ButtonLink
        href={quickActions.signIn.href}
        variant="blaze"
        className="min-h-11 px-4"
      >
        <Icon name="user" className="size-5" strokeWidth={2} />
        {quickActions.signIn.label}
      </ButtonLink>
    </header>
  );
}

/**
 * Goku in front of a giant word and an orange ring: the figure is cut out,
 * so stacking order alone puts him in front. No motion, nothing on scroll.
 */
export function Hero({ status }: { status: OpenStatus }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate h-[clamp(34rem,150vw,42rem)] overflow-hidden landing-panel md:h-[clamp(36rem,62vw,44rem)]"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_34%,#4a494e_0%,#29282b_45%,#1c1b1d_80%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 screentone [mask-image:radial-gradient(45%_45%_at_50%_36%,black,transparent)] text-white/[0.09]"
      />

      <div
        aria-hidden
        className="absolute top-[7%] left-1/2 -z-10 aspect-square h-[58%] -translate-x-1/2 rounded-full neon-ring md:top-[6%] md:h-[66%]"
      />
      <p
        aria-hidden
        className="absolute inset-x-0 top-[9%] -z-10 text-center display text-[clamp(7.5rem,44vw,25rem)] leading-[0.82] uppercase md:top-[6%]"
      >
        {hero.word}
      </p>

      <ArtImage
        art={art.hero}
        priority
        sizes="(min-width: 768px) 380px, 70vw"
        fade="none"
        className="absolute bottom-0 left-1/2 h-[94%] w-auto max-w-none -translate-x-1/2 md:h-[97%]"
      />
      {/*
       * Goku stays fully solid; this wash of the panel's own colour, laid on
       * top with eased stops, is what melts him (and the ring behind him)
       * into the floor.
       */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(to_top,#1c1b1d_0%,#1c1b1d_22%,rgb(28_27_29/0.94)_34%,rgb(28_27_29/0.8)_46%,rgb(28_27_29/0.58)_58%,rgb(28_27_29/0.34)_70%,rgb(28_27_29/0.15)_82%,rgb(28_27_29/0.04)_92%,transparent_100%)]"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-5 pb-5 md:px-8 md:pb-8">
        <div>
          <StatusChip status={status} />
          <h1
            id="hero-title"
            className="mt-3 max-w-[11ch] display text-[clamp(2.6rem,11vw,4.75rem)]"
          >
            {hero.headline}
          </h1>
          <p className="mt-2 max-w-xs text-mist">{hero.sub}</p>
        </div>

        <div className="hidden flex-col gap-2 md:flex">
          <SideIcon
            href={`https://instagram.com/${contact.instagramHandle}`}
            icon="instagram"
            label="Instagram"
          />
          <SideIcon
            href={whatsappLink(finalCta.whatsappMessage)}
            icon="whatsapp"
            label="WhatsApp"
          />
          <SideIcon href={contact.phoneHref} icon="phone" label="Call" />
        </div>
      </div>
    </section>
  );
}

function SideIcon({
  href,
  icon,
  label,
}: {
  href: string;
  icon: LandingIcon;
  label: string;
}) {
  return (
    <SmartLink
      href={href}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-tile bg-white/[0.08] text-white ring-1 ring-white/10 transition-colors hover:bg-white hover:text-ink"
    >
      <Icon name={icon} className="size-5" />
    </SmartLink>
  );
}

/** "Open now · till 10 PM" or "Closed · opens 4 PM", in India time. */
export function StatusChip({ status }: { status: OpenStatus }) {
  return (
    <p className="inline-flex min-h-9 items-center gap-2 rounded-control bg-white/[0.08] px-3 text-sm font-semibold ring-1 ring-white/10">
      <span
        aria-hidden
        className={`size-2.5 rounded-full ${status.open ? "bg-blaze" : "bg-smoke"}`}
      />
      {status.open ? (
        <>
          Open now
          <span className="font-medium text-mist">
            till {hourLabel(status.row.to)}
          </span>
        </>
      ) : (
        <>
          Closed
          <span className="font-medium text-mist">
            opens {status.day === null ? "" : `${DAY_SHORT[status.day]} `}
            {hourLabel(status.next.from)}
          </span>
        </>
      )}
    </p>
  );
}

/**
 * The picture buttons: sign in (orange, biggest), call, WhatsApp, map.
 * Someone who can't read the labels can still tell them apart by icon.
 */
export function QuickActions() {
  const { signIn, call, whatsapp, map } = quickActions;
  return (
    <nav
      aria-label="Quick actions"
      className="grid grid-cols-3 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]"
    >
      <SmartLink
        href={signIn.href}
        className="blaze-texture col-span-3 flex min-h-24 items-center gap-4 rounded-card bg-blaze p-4 text-white transition-[background-color,transform] duration-150 hover:bg-blaze-deep active:scale-[0.99] md:col-span-1"
      >
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-tile bg-white/20 text-white ring-1 ring-white/25">
          <Icon name="user" className="size-8" strokeWidth={2} />
        </span>
        <span>
          <span className="block text-2xl leading-tight font-bold">
            {signIn.label}
          </span>
          <span className="block text-sm font-semibold text-white/90">
            {signIn.hint}
          </span>
        </span>
        <Icon name="arrow" className="ml-auto size-7" strokeWidth={2.25} />
      </SmartLink>

      <ActionTile href={contact.phoneHref} icon="phone" label={call.label} />
      <ActionTile
        href={whatsappLink(finalCta.whatsappMessage)}
        icon="whatsapp"
        label={whatsapp.label}
      />
      <ActionTile href={map.href} icon="pin" label={map.label} />
    </nav>
  );
}

function ActionTile({
  href,
  icon,
  label,
}: {
  href: string;
  icon: LandingIcon;
  label: string;
}) {
  return (
    <SmartLink
      href={href}
      className="flex min-h-24 flex-col items-center justify-center gap-2 landing-tile px-2 py-4 transition-colors hover:bg-ash"
    >
      <Icon name={icon} className="size-8" />
      <span className="text-sm font-semibold">{label}</span>
    </SmartLink>
  );
}
