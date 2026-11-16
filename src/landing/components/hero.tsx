import Link from "@/components/ui/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { art, gym, hero, nav } from "@/content/landing";
import { ArtImage } from "./art-image";
import { ButtonLink } from "./button-link";

export function Hero() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-charcoal text-white">
        <SiteHeader />

        <div className="mx-auto grid min-h-[calc(88svh-4.5rem)] max-w-6xl grid-rows-[1fr_auto] px-4 md:min-h-[min(46rem,calc(100svh-5rem))] md:grid-cols-[1fr_1.05fr] md:grid-rows-1 md:items-center md:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-16 -z-10 flex justify-center md:relative md:top-0 md:col-start-1 md:row-start-1 md:h-full md:items-end">
            <div className="absolute top-[4%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_65%)] md:top-[8%] md:h-[30rem] md:w-[30rem]" />
            <ArtImage
              art={art.hero}
              priority
              sizes="(min-width: 768px) 460px, 92vw"
              className="relative h-auto w-[min(92vw,26rem)] md:h-[min(44rem,calc(100svh-6rem))] md:w-auto"
            />
          </div>

          <div className="relative row-start-2 pt-8 pb-10 md:col-start-2 md:row-start-1 md:py-16">
            <div className="absolute inset-x-[-1rem] -top-24 bottom-0 -z-10 bg-gradient-to-t from-charcoal via-charcoal/90 to-transparent md:hidden" />

            <p className="text-sm font-medium text-mist">{hero.openingLine}</p>

            <h1 className="mt-3 max-w-[9ch] animate-rise display text-[clamp(3.6rem,20vw,7.75rem)]">
              {hero.headline}
            </h1>

            <p className="mt-5 max-w-[26rem] text-lg leading-snug text-mist">
              {hero.sub}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-2">
              <ButtonLink href={hero.primaryCta.href}>
                {hero.primaryCta.label}
              </ButtonLink>
              <ButtonLink href={hero.secondaryCta.href} variant="text-light">
                {hero.secondaryCta.label}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
      <div
        aria-hidden
        className="h-12 screentone [mask-image:linear-gradient(to_bottom,black,transparent)] text-charcoal md:h-20"
      />
    </>
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
