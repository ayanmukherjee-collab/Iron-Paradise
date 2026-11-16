import Link from "@/components/ui/link";
import { LogoMark } from "@/components/brand/logo-mark";
import {
  art,
  contact,
  finalCta,
  gym,
  quickActions,
  whatsappLink,
} from "@/content/landing";
import { ArtImage } from "./art-image";
import { ButtonLink, SmartLink } from "./button-link";
import { Icon, type LandingIcon } from "./icons";

export function Closing() {
  return (
    <section
      aria-labelledby="closing-title"
      className="panel-dots grid landing-panel md:grid-cols-[1fr_auto] md:items-end"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_85%_40%,#3a393d_0%,transparent_70%)]"
      />
      <div className="p-5 pb-0 md:p-10">
        <h2
          id="closing-title"
          className="max-w-[12ch] display text-[clamp(2.8rem,12vw,5.5rem)]"
        >
          {finalCta.heading}
        </h2>
        <p className="mt-3 text-lg text-mist">{finalCta.sub}</p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <ButtonLink
            href={quickActions.signIn.href}
            variant="blaze"
            className="min-h-14 px-6 text-lg"
          >
            <Icon name="user" className="size-6" strokeWidth={2} />
            {quickActions.signIn.label}
          </ButtonLink>
          <ButtonLink
            href={whatsappLink(finalCta.whatsappMessage)}
            variant="ghost"
            className="min-h-14 px-6 text-lg"
          >
            <Icon name="whatsapp" className="size-6" />
            WhatsApp
          </ButtonLink>
        </div>
      </div>
      <ArtImage
        art={art.closing}
        fade="bottom-right"
        sizes="(min-width: 768px) 360px, 80vw"
        className="mx-auto -mt-4 h-auto w-[min(80vw,20rem)] md:mt-0 md:mr-6 md:w-[22rem]"
      />
    </section>
  );
}

export function SiteFooter() {
  const links: { href: string; icon: LandingIcon; label: string }[] = [
    {
      href: `https://instagram.com/${contact.instagramHandle}`,
      icon: "instagram",
      label: "Instagram",
    },
    {
      href: contact.whatsappCommunityUrl,
      icon: "group",
      label: "WhatsApp community",
    },
    { href: contact.phoneHref, icon: "phone", label: "Call" },
  ];

  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-6 pb-10 text-sm text-smoke md:flex-row md:items-center md:justify-between">
      <Link href="/" className="flex items-center gap-2.5 text-white">
        <LogoMark className="h-7 w-auto" />
        <span className="display text-xl uppercase">{gym.fullName}</span>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <SmartLink
            key={link.label}
            href={link.href}
            aria-label={link.label}
            className="inline-flex size-11 items-center justify-center rounded-tile bg-white/[0.06] text-white ring-1 ring-white/10 transition-colors hover:bg-white hover:text-ink"
          >
            <Icon name={link.icon} className="size-5" />
          </SmartLink>
        ))}
        <span className="mx-2 h-6 w-px bg-white/10" aria-hidden />
        <Link
          href="/privacy"
          className="rounded-control px-2 py-2 hover:text-white"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="rounded-control px-2 py-2 hover:text-white"
        >
          Terms
        </Link>
      </div>
    </footer>
  );
}
