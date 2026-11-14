import type { ReactNode } from "react";

type HalftoneFigureProps = {
  /** Unique per page: SVG pattern and mask ids are global to the document. */
  id: string;
  width: number;
  height: number;
  /** Silhouette shapes, painted white. Fine and medium dots fill these. */
  body: ReactNode;
  /** Brightest regions (hair, a blade edge), drawn with the largest dots. */
  highlight?: ReactNode;
  /** Things behind the figure, such as a cape, drawn faint with fine dots only. */
  back?: ReactNode;
  /** Black strokes cut out of the silhouette to suggest muscle and folds. */
  cuts?: ReactNode;
  /** Where the bottom fade starts, as a fraction of the height. */
  fadeFrom?: number;
  className?: string;
};

const CELL = 6;

/**
 * Renders a silhouette as a print-style halftone. Dot size varies with height,
 * so figures read as lit from above and dissolve into the page at the bottom.
 * Dots use currentColor, so the same figure works on dark and light sections.
 */
export function HalftoneFigure({
  id,
  width,
  height,
  body,
  highlight,
  back,
  cuts,
  fadeFrom = 0.55,
  className,
}: HalftoneFigureProps) {
  const ids = {
    fine: `${id}-fine`,
    mid: `${id}-mid`,
    bold: `${id}-bold`,
    fade: `${id}-fade`,
    fadeTop: `${id}-fade-top`,
    body: `${id}-body`,
    top: `${id}-top`,
    highlight: `${id}-highlight`,
    back: `${id}-back`,
  };
  const area = { x: 0, y: 0, width, height };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <DotPattern id={ids.fine} radius={1.05} />
        <DotPattern id={ids.mid} radius={1.85} />
        <DotPattern id={ids.bold} radius={2.6} />

        <FadeGradient id={ids.fade} height={height} from={fadeFrom} to={1} />
        <FadeGradient id={ids.fadeTop} height={height} from={0.12} to={0.62} />

        <mask id={ids.back} maskUnits="userSpaceOnUse" {...area}>
          <g fill="white">{back}</g>
          <rect {...area} fill={`url(#${ids.fade})`} />
        </mask>
        <mask id={ids.body} maskUnits="userSpaceOnUse" {...area}>
          <g fill="white">{body}</g>
          <g stroke="black" fill="none" strokeLinecap="round">
            {cuts}
          </g>
          <rect {...area} fill={`url(#${ids.fade})`} />
        </mask>
        <mask id={ids.top} maskUnits="userSpaceOnUse" {...area}>
          <g fill="white">{body}</g>
          <g stroke="black" fill="none" strokeLinecap="round">
            {cuts}
          </g>
          <rect {...area} fill={`url(#${ids.fadeTop})`} />
        </mask>
        <mask id={ids.highlight} maskUnits="userSpaceOnUse" {...area}>
          <g fill="white">{highlight}</g>
          <g stroke="black" fill="none" strokeLinecap="round">
            {cuts}
          </g>
          <rect {...area} fill={`url(#${ids.fade})`} />
        </mask>
      </defs>

      {back ? (
        <rect
          {...area}
          fill={`url(#${ids.fine})`}
          mask={`url(#${ids.back})`}
          opacity={0.5}
        />
      ) : null}
      <rect
        {...area}
        fill={`url(#${ids.fine})`}
        mask={`url(#${ids.body})`}
        opacity={0.75}
      />
      <rect
        {...area}
        fill={`url(#${ids.mid})`}
        mask={`url(#${ids.top})`}
        opacity={0.85}
      />
      {highlight ? (
        <rect
          {...area}
          fill={`url(#${ids.bold})`}
          mask={`url(#${ids.highlight})`}
        />
      ) : null}
    </svg>
  );
}

function DotPattern({ id, radius }: { id: string; radius: number }) {
  return (
    <pattern
      id={id}
      width={CELL}
      height={CELL}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <circle cx={CELL / 2} cy={CELL / 2} r={radius} fill="currentColor" />
    </pattern>
  );
}

/** Black, transparent above `from` and solid by `to`; painted last in a mask it erases. */
function FadeGradient({
  id,
  height,
  from,
  to,
}: {
  id: string;
  height: number;
  from: number;
  to: number;
}) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      y1={0}
      x2={0}
      y2={height}
    >
      <stop offset={from} stopColor="black" stopOpacity={0} />
      <stop offset={to} stopColor="black" stopOpacity={1} />
    </linearGradient>
  );
}
