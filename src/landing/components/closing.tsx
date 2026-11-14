import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import {
  contact,
  finalCta,
  gym,
  hero,
  nav,
  visit,
  whatsappLink,
} from "@/content/landing";
import { ButtonLink } from "./button-link";
import { CapedFigure } from "./figures";
import { Hours } from "./sections";

export function Visit() {
  return (
    <section className="mx-auto grid max-w-6xl gap-14 px-4 pb-20 md:grid-cols-2 md:gap-16 md:px-8 md:pb-28">
      <Hours />

      <div id="visit" className="scroll-mt-6">
        <p className="eyebrow text-smoke">{visit.eyebrow}</p>
        <h2 className="mt-3 display text-[clamp(2.2rem,9vw,3.5rem)]">
          {visit.heading}
        </h2>
        <p className="mt-3 text-lg text-ash">{visit.sub}</p>

        <address className="mt-8 border-y border-ink/15 py-4 text-lg leading-snug not-italic">
          {contact.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>

        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={contact.mapsUrl} variant="dark">
            Open in Maps
          </ButtonLink>
          <ButtonLink href={contact.phoneHref} variant="outline-dark">
            Call {contact.phoneDisplay}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <footer className="relative isolate overflow-hidden rounded-t-[2rem] bg-charcoal text-white md:rounded-t-[3rem]">
      <div className="mx-auto grid max-w-6xl px-4 pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-end md:px-8 md:pt-20">
        <div className="relative z-10 pb-4 md:pb-20">
          <h2 className="max-w-[12ch] display text-[clamp(2.8rem,13vw,5.5rem)]">
            {finalCta.heading}
          </h2>
          <p className="mt-4 text-lg text-mist">{finalCta.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={whatsappLink(finalCta.whatsappMessage)}>
              WhatsApp us
            </ButtonLink>
            <ButtonLink href={hero.secondaryCta.href} variant="outline-light">
              {hero.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>

        <CapedFigure className="pointer-events-none mx-auto -mt-6 w-[min(88vw,24rem)] text-white md:mt-0 md:w-full md:max-w-[26rem]" />
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-mist md:flex-row md:items-center md:justify-between md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <LogoMark className="h-6 w-auto" />
            <span className="font-display text-lg tracking-wide uppercase">
              {gym.fullName}
            </span>
          </Link>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </a>
            ))}
            <a
              href={`https://instagram.com/${contact.instagramHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Instagram
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
