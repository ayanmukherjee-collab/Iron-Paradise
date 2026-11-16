import { contact, finalCta, gym, visit, whatsappLink } from "@/content/landing";
import { mapLines, mapSize, type MapLine } from "../map-roads";
import { ButtonLink } from "./button-link";
import { Icon } from "./icons";
import { SectionTitle } from "./sections";

const STROKE: Record<MapLine["kind"], string> = {
  major: "stroke-white/85 [stroke-width:13]",
  minor: "stroke-white/30 [stroke-width:6]",
  lane: "stroke-white/20 [stroke-width:4]",
  rail: "stroke-white/25 [stroke-width:3] [stroke-dasharray:10_8]",
  water: "stroke-white/15 [stroke-width:8]",
};

/**
 * The streets around the gym, drawn from OpenStreetMap data at build time
 * (scripts/make-map.mjs). The gym is always the centre of the drawing, and
 * the drawing is cropped from its centre, so the pin sits at 50% / 50%.
 */
function MapPreview() {
  return (
    <svg
      viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="map-dots"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="7" cy="7" r="1.1" className="fill-white/[0.06]" />
        </pattern>
      </defs>
      <rect
        width={mapSize.width}
        height={mapSize.height}
        fill="url(#map-dots)"
      />
      {mapLines.map((line, i) => (
        <path
          key={i}
          d={line.d}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={STROKE[line.kind]}
        />
      ))}
      <circle
        cx={mapSize.width / 2}
        cy={mapSize.height / 2}
        r="46"
        className="fill-blaze/15"
      />
    </svg>
  );
}

export function Visit() {
  return (
    <section
      id="map"
      aria-labelledby="map-title"
      className="grid scroll-mt-4 gap-3 lg:grid-cols-[1.6fr_1fr]"
    >
      <div className="relative isolate min-h-[22rem] overflow-hidden landing-panel lg:min-h-[28rem]">
        <MapPreview />

        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center"
        >
          <span className="mb-1.5 rounded-tile bg-white px-3 py-1.5 text-sm font-bold whitespace-nowrap text-ink shadow-float">
            {gym.name}
          </span>
          <svg viewBox="0 0 24 30" className="h-12 w-auto drop-shadow-lg">
            <path
              d="M12 29s10-9.2 10-17A10 10 0 0 0 2 12c0 7.8 10 17 10 17z"
              className="fill-blaze stroke-ink"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="12" r="3.6" className="fill-ink" />
          </svg>
        </div>

        <a
          href={contact.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group absolute inset-0 flex items-end p-4"
        >
          <span className="inline-flex min-h-12 items-center gap-2.5 rounded-control bg-white px-4 text-[0.95rem] font-semibold text-ink shadow-float transition-transform duration-150 group-active:scale-[0.98]">
            <Icon name="pin" className="size-5" strokeWidth={2} />
            {visit.mapCta}
            <Icon name="external" className="size-4" strokeWidth={2} />
          </span>
        </a>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 bottom-3 rounded-badge bg-ink/70 px-1.5 py-0.5 text-[0.6875rem] text-mist hover:text-white"
        >
          © OpenStreetMap
        </a>
      </div>

      <div className="panel-hatch flex flex-col landing-panel p-5 md:p-7">
        <SectionTitle id="map-title" icon="pin">
          {visit.heading}
        </SectionTitle>
        <address className="mt-5 text-xl leading-snug font-medium not-italic">
          {contact.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>

        <div className="mt-6 grid gap-2.5 lg:mt-auto">
          <ButtonLink href={contact.mapsUrl} variant="light" className="w-full">
            <Icon name="pin" className="size-5" strokeWidth={2} />
            Directions
          </ButtonLink>
          <div className="grid grid-cols-2 gap-2.5">
            <ButtonLink href={contact.phoneHref} variant="ghost">
              <Icon name="phone" className="size-5" />
              Call
            </ButtonLink>
            <ButtonLink
              href={whatsappLink(finalCta.whatsappMessage)}
              variant="ghost"
            >
              <Icon name="whatsapp" className="size-5" />
              WhatsApp
            </ButtonLink>
          </div>
          <p className="mt-1 text-center text-sm text-smoke tabular-nums">
            {contact.phoneDisplay}
          </p>
        </div>
      </div>
    </section>
  );
}
