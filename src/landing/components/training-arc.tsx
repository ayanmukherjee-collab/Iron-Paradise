"use client";

import { useEffect, useRef, useState } from "react";
import type { Art, ArcStep } from "@/content/landing";
import { clamp01, smoothstep, StarField } from "../star-field";
import { ArtImage } from "./art-image";

type TrainingArcProps = {
  caption: string;
  heading: string;
  steps: ArcStep[];
  art: Art;
};

/** How quickly the drawn progress catches up with the scroll position (per second). */
const EASE_RATE = 9;
/** Share of the scroll used by the steps; the rest lets the white card settle. */
const STEPS_SPAN = 0.9;

/** 0 is the site's ink black, 1 is white. */
function grey(amount: number): string {
  const level = Math.round(12 + amount * (255 - 12));
  return `rgb(${level} ${level} ${level})`;
}

/**
 * A pinned section: while it is on screen the page scrolls "inside" it, the
 * timeline advances, and the star card turns white. Pinning uses
 * position: sticky inside a tall section, so native scrolling, touch, keyboard
 * and screen readers keep working; nothing hijacks the wheel. Without
 * JavaScript the steps render as a plain list.
 */
export function TrainingArc({
  caption,
  heading,
  steps,
  art,
}: TrainingArcProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const card = cardRef.current;
    const content = contentRef.current;
    const canvas = canvasRef.current;
    if (!section || !card || !content || !canvas) {
      return;
    }

    const field = new StarField(canvas);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let target = 0;
    let shown = 0;
    let lastTime = performance.now();
    let frame = 0;
    let onScreen = false;

    const readScroll = () => {
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      target = travel > 0 ? clamp01(-rect.top / travel) : 0;
    };

    const paint = (now: number, twinkle: boolean) => {
      // The clear patch around the text closes near the end so the whole
      // card can turn white; the text flips to black as it does.
      const clearing = 1 - smoothstep(0.82, 0.9, shown);
      field.render(shown, now / 1000, twinkle, clearing);

      const flip = smoothstep(0.86, 0.91, shown);
      card.style.setProperty("--card-ink", grey(1 - flip));
      card.style.setProperty("--card-bg", grey(flip));
      card.style.setProperty("--arc", shown.toFixed(4));

      const step = Math.min(
        steps.length - 1,
        Math.floor(clamp01(shown / STEPS_SPAN) * steps.length),
      );
      if (step !== activeRef.current) {
        activeRef.current = step;
        setActive(step);
      }
    };

    const draw = (now: number) => {
      frame = 0;
      const seconds = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const calm = reducedMotion.matches;

      shown = calm
        ? target
        : shown + (target - shown) * (1 - Math.exp(-seconds * EASE_RATE));
      if (Math.abs(target - shown) < 0.0004) {
        shown = target;
      }

      const twinkling = !calm && shown < 0.45;
      paint(now, twinkling);

      if (onScreen && (shown !== target || twinkling)) {
        frame = requestAnimationFrame(draw);
      }
    };

    const wake = () => {
      if (!frame && onScreen) {
        lastTime = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };

    const onScroll = () => {
      readScroll();
      wake();
    };

    const resize = () => {
      field.resize();
      const cardBox = canvas.getBoundingClientRect();
      const textBox = content.getBoundingClientRect();
      field.setClearZone({
        x: textBox.left - cardBox.left,
        y: textBox.top - cardBox.top,
        width: textBox.width,
        height: textBox.height,
      });
      readScroll();
      shown = target;
      paint(performance.now(), false);
      wake();
    };

    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) {
        readScroll();
        wake();
      }
    });
    const sizing = new ResizeObserver(resize);

    setEnhanced(true);
    visibility.observe(section);
    sizing.observe(canvas);
    sizing.observe(content);
    window.addEventListener("scroll", onScroll, { passive: true });
    reducedMotion.addEventListener("change", wake);

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      sizing.disconnect();
      window.removeEventListener("scroll", onScroll);
      reducedMotion.removeEventListener("change", wake);
    };
  }, [steps.length]);

  const jumpTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    const travel = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + travel * ((index + 0.5) / steps.length) * STEPS_SPAN,
    });
  };

  const total = String(steps.length).padStart(2, "0");

  return (
    <section
      ref={sectionRef}
      aria-label={heading}
      className={enhanced ? "relative h-[420svh]" : "relative"}
    >
      <div
        className={
          enhanced
            ? "sticky top-0 h-svh p-2 md:p-4 [@media(max-height:520px)]:p-1.5"
            : "p-2 md:p-4"
        }
      >
        <div className="relative isolate grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden bg-ink p-4 text-white md:gap-8 md:p-8 lg:gap-10 lg:p-10 split:grid-cols-12 split:grid-rows-1 [@media(max-height:520px)]:gap-4 [@media(max-height:520px)]:p-4">
          {/*
            Left column: the heading scales with the column's width (capped by
            screen height) and the character fills whatever height is left,
            standing on the bottom edge and looking up toward the timeline.
            Phones drop the character: there is no room for him beside the card.
          */}
          <div className="@container flex min-h-0 flex-col split:col-span-5">
            <header>
              <h2 className="max-w-[9ch] display text-[clamp(2.4rem,10vw,4.5rem)] split:text-[clamp(3rem,min(16cqi,11svh),8rem)] [@media(max-height:520px)]:text-[2.25rem]">
                {heading}
              </h2>
              <p className="mt-3 max-w-[24rem] text-sm leading-snug text-mist md:mt-6 md:text-lg lg:text-xl">
                {caption}
              </p>
            </header>
            <ArtImage
              art={art}
              sizes="(min-width: 768px) 40vw, 1px"
              className="mt-6 -mb-8 hidden h-0 min-h-0 w-full flex-1 object-contain object-left-bottom lg:-mb-10 split:block [@media(max-height:520px)]:hidden"
            />
          </div>

          <div
            ref={cardRef}
            className="@container relative isolate flex min-h-0 flex-col justify-end overflow-hidden border border-white/20 bg-[var(--card-bg,#0c0c0d)] p-5 text-[var(--card-ink,#ffffff)] md:p-8 lg:p-10 split:col-span-7 split:col-start-6 [@media(max-height:520px)]:p-4"
          >
            <canvas
              ref={canvasRef}
              aria-hidden
              className="absolute inset-0 -z-10 size-full"
            />

            <div ref={contentRef}>
              {enhanced ? (
                <p
                  aria-hidden
                  className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] uppercase md:text-sm"
                >
                  <span>Stage</span>
                  <span className="h-px w-8 bg-current opacity-40" />
                  <span className="tabular-nums">
                    {String(active + 1).padStart(2, "0")}
                    <span className="opacity-50"> / {total}</span>
                  </span>
                </p>
              ) : null}

              <ol
                className={
                  enhanced
                    ? "mt-3 grid md:mt-4 [@media(max-height:520px)]:mt-2"
                    : "space-y-8"
                }
              >
                {steps.map((step, index) => {
                  const state =
                    index === active
                      ? "current"
                      : index < active
                        ? "past"
                        : "next";
                  return (
                    <li
                      key={step.when}
                      aria-current={
                        enhanced && state === "current" ? "step" : undefined
                      }
                      className={
                        enhanced
                          ? `[grid-area:1/1] ${state === "current" ? "" : "pointer-events-none"}`
                          : ""
                      }
                    >
                      {/* The title slides up out of a clipped line, like a panel wipe. */}
                      <p className="overflow-hidden pb-[0.04em]">
                        <span
                          className={`block display text-[clamp(3.25rem,17cqi,9rem)] uppercase [@media(max-height:520px)]:text-[3rem] ${
                            enhanced
                              ? `transition-transform duration-[650ms] ease-[cubic-bezier(0.7,0,0.2,1)] motion-reduce:transition-none ${
                                  state === "current"
                                    ? "translate-y-0"
                                    : state === "past"
                                      ? "-translate-y-[110%]"
                                      : "translate-y-[110%]"
                                }`
                              : ""
                          }`}
                        >
                          {step.when}
                        </span>
                      </p>
                      <p
                        className={`mt-3 max-w-[30ch] text-lg leading-snug md:mt-4 md:text-2xl md:leading-snug [@media(max-height:520px)]:mt-1 [@media(max-height:520px)]:text-base ${
                          enhanced
                            ? `transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
                                state === "current"
                                  ? "translate-y-0 opacity-100 delay-150"
                                  : "translate-y-2 opacity-0"
                              }`
                            : ""
                        }`}
                      >
                        {step.what}
                      </p>
                    </li>
                  );
                })}
              </ol>

              {enhanced ? (
                <Timeline steps={steps} active={active} onSelect={jumpTo} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One segment per stage. Each segment fills while its stage is on screen, so
 * the rail shows both where you are and how far into that stage. Labels are
 * buttons that jump to their stage.
 */
function Timeline({
  steps,
  active,
  onSelect,
}: {
  steps: ArcStep[];
  active: number;
  onSelect: (index: number) => void;
}) {
  // Segment i fills between the start of stage i and the start of stage i + 1.
  const rate = (steps.length / STEPS_SPAN).toFixed(4);

  return (
    <ul
      aria-label="Jump to a stage"
      className="mt-8 grid gap-1.5 md:mt-10 md:gap-2 [@media(max-height:520px)]:mt-4"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const reached = index <= active;
        return (
          <li key={step.when}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Go to ${step.when}`}
              className="group block w-full pb-1 text-left"
            >
              <span className="relative block h-1 overflow-hidden">
                <span className="absolute inset-0 bg-current opacity-20 transition-opacity group-hover:opacity-35" />
                <span
                  className="absolute inset-0 origin-left bg-current"
                  style={{
                    transform: `scaleX(clamp(0, calc(var(--arc, 0) * ${rate} - ${index}), 1))`,
                  }}
                />
              </span>
              <span
                className={`mt-3 flex flex-col gap-0.5 text-[0.6875rem] leading-tight font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-opacity duration-300 @sm:text-xs @sm:tracking-[0.14em] @2xl:flex-row @2xl:items-baseline @2xl:gap-2 @2xl:text-sm ${
                  reached ? "opacity-100" : "opacity-45 group-hover:opacity-75"
                }`}
              >
                <span className="tabular-nums opacity-60">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{step.when}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
