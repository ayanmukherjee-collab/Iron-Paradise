import { arc, facilities, floor, hours, statement } from "@/content/landing";
import { SwordFigure } from "./figures";

export function Statement() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center md:px-8 md:pt-24 md:pb-16">
      <p className="display text-[clamp(2.6rem,12vw,6.5rem)]">
        {statement.lineOne}
      </p>
      <p className="mt-3 font-display text-[clamp(1.35rem,6vw,3rem)] leading-tight text-smoke">
        {statement.lineTwo}
      </p>
    </section>
  );
}

export function Floor() {
  return (
    <section
      id="floor"
      className="mx-auto grid max-w-6xl scroll-mt-6 gap-6 px-4 py-12 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
    >
      <div>
        <p className="eyebrow text-smoke">{floor.eyebrow}</p>
        <h2 className="mt-3 display text-[clamp(2.4rem,10vw,4.5rem)]">
          {floor.heading}
        </h2>
      </div>
      <div className="space-y-4 text-lg leading-relaxed text-ash md:pt-9">
        {floor.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export function TrainingArc() {
  return (
    <section className="px-2 py-6 md:px-6">
      <div className="relative isolate mx-auto max-w-[78rem] overflow-hidden rounded-[2rem] bg-ink px-4 pt-12 pb-10 text-white md:grid md:grid-cols-[0.9fr_1.1fr] md:items-end md:gap-8 md:rounded-[3rem] md:px-12 md:pt-16 md:pb-0">
        <SwordFigure className="pointer-events-none absolute top-2 -right-12 -z-10 w-[15rem] text-white opacity-50 md:relative md:top-auto md:right-auto md:order-first md:w-full md:max-w-[26rem] md:opacity-100" />

        <div className="md:pb-16">
          <p className="eyebrow text-mist">{arc.eyebrow}</p>
          <h2 className="mt-3 max-w-[12ch] display text-[clamp(2.6rem,11vw,4.75rem)]">
            {arc.heading}
          </h2>

          <ol className="mt-10 space-y-7 border-l border-white/20 pl-6">
            {arc.steps.map((step) => (
              <li key={step.when} className="relative">
                <span className="absolute top-2.5 -left-[1.95rem] size-3 rounded-full border-2 border-ink bg-white" />
                <p className="font-display text-2xl tracking-wide uppercase">
                  {step.when}
                </p>
                <p className="mt-1 max-w-md text-lg leading-snug text-mist">
                  {step.what}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function Facilities() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
      <p className="eyebrow text-smoke">{facilities.eyebrow}</p>
      <h2 className="mt-3 max-w-[16ch] display text-[clamp(2.4rem,10vw,4.5rem)]">
        {facilities.heading}
      </h2>

      <ul className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
        {facilities.items.map((item, index) => (
          <li
            key={item.name}
            className="flex gap-4 border-t border-ink/15 py-5"
          >
            <span className="font-display text-lg text-smoke tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-display text-2xl tracking-wide uppercase">
                {item.name}
              </h3>
              <p className="mt-1 leading-snug text-ash">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Hours() {
  return (
    <div id="hours" className="scroll-mt-6">
      <p className="eyebrow text-smoke">{hours.eyebrow}</p>
      <h2 className="mt-3 display text-[clamp(2.2rem,9vw,3.5rem)]">
        {hours.heading}
      </h2>
      <dl className="mt-8 divide-y divide-ink/15 border-y border-ink/15">
        {hours.rows.map((row) => (
          <div
            key={row.days}
            className="flex flex-col gap-1 py-4 sm:flex-row sm:justify-between"
          >
            <dt className="font-semibold">{row.days}</dt>
            <dd className="text-ash tabular-nums sm:text-right">
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
