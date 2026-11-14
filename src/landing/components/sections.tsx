import {
  arc,
  art,
  facilities,
  floor,
  hours,
  statement,
} from "@/content/landing";
import { ArtImage } from "./art-image";

export function Statement() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 pb-14 md:px-8 md:pt-10 md:pb-20">
      <p className="max-w-[14ch] display text-[clamp(3rem,14vw,8rem)]">
        {statement.lineOne}
      </p>
      <p className="mt-4 font-display text-[clamp(1.5rem,6.5vw,3.25rem)] leading-tight text-smoke md:ml-[38%]">
        {statement.lineTwo}
      </p>
    </section>
  );
}

export function Floor() {
  return (
    <section
      id="floor"
      className="mx-auto grid max-w-6xl scroll-mt-6 gap-6 border-t-2 border-ink px-4 pt-8 pb-16 md:mx-8 md:grid-cols-12 md:gap-10 md:px-0 md:pb-24 xl:mx-auto"
    >
      <h2 className="display text-[clamp(2.2rem,9vw,4rem)] md:col-span-7">
        {floor.heading}
      </h2>
      <div className="space-y-4 text-lg leading-relaxed text-ash md:col-span-5 md:pt-2 md:text-xl">
        {floor.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

/** Laid out as a manga page: one big art panel, then panels for each stage. */
export function TrainingArc() {
  const [first, second, third, last] = arc.steps;

  return (
    <section className="bg-ink px-2 py-2 text-white md:px-4 md:py-4">
      <div className="mx-auto grid max-w-[80rem] grid-cols-2 gap-2 md:grid-cols-12 md:gap-3">
        <div className="relative col-span-2 overflow-hidden border-2 border-white md:col-span-5 md:row-span-2">
          <ArtImage
            art={art.arc}
            sizes="(min-width: 768px) 520px, 100vw"
            className="mx-auto h-auto w-full max-w-[30rem] pt-10 md:max-w-none"
          />
          <p className="absolute top-3 left-3 max-w-[15rem] bg-white px-2.5 py-1.5 text-xs leading-snug font-semibold text-ink">
            {arc.caption}
          </p>
          <h2 className="absolute inset-x-4 bottom-4 display text-[clamp(2.6rem,12vw,4.5rem)] md:inset-x-6 md:bottom-6">
            {arc.heading}
          </h2>
        </div>

        <ArcPanel step={first} className="col-span-2 md:col-span-4" />
        <ArcPanel step={second} className="md:col-span-3" />
        <ArcPanel step={third} className="md:col-span-3" />
        <ArcPanel step={last} className="col-span-2 md:col-span-4" loud />
      </div>
    </section>
  );
}

function ArcPanel({
  step,
  className,
  loud = false,
}: {
  step: (typeof arc.steps)[number];
  className: string;
  loud?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col justify-end overflow-hidden border-2 p-4 pt-10 md:min-h-64 md:p-6 ${
        loud ? "border-white bg-white text-ink" : "border-white"
      } ${className}`}
    >
      {loud ? (
        <div
          aria-hidden
          className="absolute inset-0 screentone [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)] text-ink/15"
        />
      ) : null}
      <p className="relative display text-[clamp(2rem,9vw,3.5rem)] uppercase">
        {step.when}
      </p>
      <p
        className={`relative mt-2 max-w-sm leading-snug md:text-lg ${loud ? "text-ash" : "text-mist"}`}
      >
        {step.what}
      </p>
    </div>
  );
}

export function Facilities() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-12 md:gap-10 md:px-8 md:py-28">
      <h2 className="display text-[clamp(2.2rem,9vw,4rem)] md:sticky md:top-8 md:col-span-5 md:self-start">
        {facilities.heading}
      </h2>

      <dl className="border-t-2 border-ink md:col-span-7">
        {facilities.items.map((item) => (
          <div
            key={item.name}
            className="grid gap-1 border-b border-ink/20 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6"
          >
            <dt className="font-display text-2xl uppercase">{item.name}</dt>
            <dd className="leading-snug text-ash sm:pt-1">{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Hours() {
  return (
    <div id="hours" className="scroll-mt-6">
      <h2 className="display text-[clamp(2.2rem,9vw,3.5rem)]">
        {hours.heading}
      </h2>
      <dl className="mt-6 border-t-2 border-ink">
        {hours.rows.map((row) => (
          <div
            key={row.days}
            className="flex flex-col gap-1 border-b border-ink/20 py-4 sm:flex-row sm:justify-between"
          >
            <dt className="font-semibold">{row.days}</dt>
            <dd className="font-display text-2xl tabular-nums sm:text-right">
              {row.slots.map((slot) => (
                <span key={slot} className="block">
                  {slot}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-smoke">{hours.note}</p>
    </div>
  );
}
