import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import {
  art,
  contact,
  finalCta,
  gym,
  hero,
  nav,
  visit,
  whatsappLink,
} from "@/content/landing";
import { ArtImage } from "./art-image";
import { ButtonLink } from "./button-link";
import { Hours } from "./sections";

export function Visit() {
  return (
    <section className="mx-auto grid max-w-6xl gap-14 px-4 pb-20 md:grid-cols-12 md:gap-10 md:px-8 md:pb-28">
      <div className="md:col-span-6">
        <Hours />
      </div>

      <div id="visit" className="scroll-mt-6 md:col-span-5 md:col-start-8">
        <h2 className="display text-[clamp(2.2rem,9vw,3.5rem)]">
          {visit.heading}
        </h2>
        <address className="mt-6 border-t-2 border-ink pt-4 text-xl leading-snug not-italic">
          {contact.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        <p className="mt-3 text-ash">{visit.sub}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-2">
          <ButtonLink href={contact.mapsUrl} variant="dark">
            Open in Maps
          </ButtonLink>
          <ButtonLink href={contact.phoneHref} variant="text-dark">
            {contact.phoneDisplay}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <footer className="relative isolate overflow-hidden bg-charcoal text-white">
      <div
        aria-hidden
        className="h-12 screentone [mask-image:linear-gradient(to_bottom,black,transparent)] text-paper md:h-20"
      />
      <div className="mx-auto grid max-w-6xl px-4 pt-6 md:grid-cols-12 md:items-end md:px-8">
        <div className="relative z-10 pb-4 md:col-span-7 md:pb-24">
          <h2 className="max-w-[11ch] display text-[clamp(3rem,14vw,6.5rem)]">
            {finalCta.heading}
          </h2>
          <p className="mt-4 text-lg text-mist">{finalCta.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2">
            <ButtonLink href={whatsappLink(finalCta.whatsappMessage)}>
              WhatsApp us
            </ButtonLink>
            <ButtonLink href={hero.secondaryCta.href} variant="text-light">
              {hero.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>

        <ArtImage
          art={art.closing}
          fade="bottom-right"
          sizes="(min-width: 768px) 440px, 88vw"
          className="mx-auto -mt-2 h-auto w-[min(88vw,24rem)] md:col-span-5 md:mt-0 md:w-full md:max-w-[28rem]"
        />
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-mist md:flex-row md:items-center md:justify-between md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <LogoMark className="h-6 w-auto" />
            <span className="font-display text-lg tracking-wide uppercase">
              {gym.fullName}
            </span>
          </Link>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
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
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
