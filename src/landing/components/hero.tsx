import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { gym, hero, nav } from "@/content/landing";
import { ButtonLink } from "./button-link";
import { RiserFigure } from "./figures";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden rounded-b-[2rem] bg-charcoal text-white md:rounded-b-[3rem]">
      <SiteHeader />

      <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-6xl grid-rows-[1fr_auto] px-4 md:min-h-[min(46rem,calc(100svh-5rem))] md:grid-cols-[1fr_1.05fr] md:grid-rows-1 md:items-center md:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-16 -z-10 flex justify-center md:relative md:top-0 md:col-start-1 md:row-start-1 md:h-full md:items-end">
          <div className="absolute top-[6%] h-[22rem] w-[22rem] animate-aura rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_65%)] md:top-[10%] md:h-[30rem] md:w-[30rem]" />
          <RiserFigure className="relative w-[min(100vw,27rem)] text-white md:w-full md:max-w-[28rem]" />
        </div>

        <div className="relative row-start-2 pt-8 pb-10 md:col-start-2 md:row-start-1 md:py-16">
          <div className="absolute inset-x-[-1rem] -top-24 bottom-0 -z-10 bg-gradient-to-t from-charcoal via-charcoal/90 to-transparent md:hidden" />

          <p className="animate-rise eyebrow text-mist">{hero.kicker}</p>

          <h1 className="mt-4 animate-rise display text-[clamp(3.6rem,20vw,7.25rem)] [animation-delay:80ms]">
            <span className="sr-only">{hero.headlineSpoken}</span>
            <span aria-hidden className="flex items-baseline">
              <LogoMark className="mr-[0.03em] h-[0.93em] w-auto shrink-0" />
              <span>{hero.headlineAfterMark}</span>
            </span>
            <span aria-hidden className="block">
              {hero.headlineSecondLine}
            </span>
          </h1>

          <p className="mt-5 max-w-[26rem] animate-rise text-lg leading-snug text-mist [animation-delay:160ms]">
            {hero.sub}
          </p>

          <div className="mt-8 flex animate-rise flex-wrap items-center gap-3 [animation-delay:240ms]">
            <ButtonLink href={hero.primaryCta.href}>
              {hero.primaryCta.label}
            </ButtonLink>
            <ButtonLink href={hero.secondaryCta.href} variant="outline-light">
              {hero.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4 md:h-20 md:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5"
        aria-label={`${gym.fullName} home`}
      >
        <LogoMark className="h-8 w-auto" />
        <span className="font-display text-xl tracking-wide uppercase">
          {gym.name}
        </span>
      </Link>

      <nav
        aria-label="Sections"
        className="hidden items-center gap-7 text-sm font-medium text-mist md:flex"
      >
        {nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="transition-colors hover:text-white"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <ButtonLink
        href={hero.secondaryCta.href}
        variant="light"
        className="min-h-10 px-5 text-sm"
      >
        Sign in
      </ButtonLink>
    </header>
  );
}
