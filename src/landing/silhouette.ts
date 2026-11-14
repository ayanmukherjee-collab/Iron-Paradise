export type Point = readonly [x: number, y: number];

/**
 * Mirrors the right half of a symmetric outline across x = centerX and returns
 * the full loop. The right half should run top to bottom and end on the axis.
 */
export function mirrorOutline(
  rightHalf: readonly Point[],
  centerX: number,
): Point[] {
  const mirrored = rightHalf
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [2 * centerX - x, y] as const);
  return [...rightHalf, ...mirrored];
}

type Spike = { angle: number; length: number };

type SpikyHairOptions = {
  center: Point;
  /** Radius of the dips between spikes; keeps the hair a solid mass. */
  valleyRadius: number;
  /** Angles in degrees, SVG convention: 0 is right, -90 (or 270) is straight up. */
  spikes: readonly Spike[];
  /** 0 to 1. How far each tip is pulled toward vertical, so the hair rises. */
  rise: number;
  /** Hairline at the back of the head, from right to left, closing the shape. */
  hairline: readonly Point[];
};

/** Jagged hair silhouette: a solid volume whose edge breaks into spikes. */
export function spikyHair({
  center,
  valleyRadius,
  spikes,
  rise,
  hairline,
}: SpikyHairOptions): string {
  const [cx, cy] = center;
  const polar = (angle: number, radius: number): Point => {
    const radians = (angle * Math.PI) / 180;
    return [
      Math.round(cx + radius * Math.cos(radians)),
      Math.round(cy + radius * Math.sin(radians)),
    ];
  };

  const points: Point[] = [];
  spikes.forEach((spike, index) => {
    const previous = spikes[index - 1]?.angle ?? spike.angle - 14;
    const next = spikes[index + 1]?.angle ?? spike.angle + 14;
    if (index === 0) {
      points.push(polar((previous + spike.angle) / 2, valleyRadius));
    }
    const tipAngle = spike.angle + (270 - spike.angle) * rise;
    points.push(polar(tipAngle, valleyRadius + spike.length));
    points.push(
      polar((spike.angle + next) / 2, valleyRadius + (index % 2 ? 6 : 0)),
    );
  });

  return `M${[...points, ...hairline].map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
}

/**
 * Turns a loop of points into a smooth closed SVG path (Catmull-Rom through
 * every point). Hand-placing points is far easier than hand-writing curves,
 * and the result reads as anatomy instead of polygons.
 */
export function smoothClosedPath(points: readonly Point[]): string {
  const count = points.length;
  if (count < 3) {
    throw new Error("A closed outline needs at least three points");
  }
  const at = (index: number) => points[(index + count) % count];
  const round = (value: number) => Math.round(value * 10) / 10;

  let d = `M${at(0)[0]} ${at(0)[1]}`;
  for (let i = 0; i < count; i += 1) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1x = round(x1 + (x2 - x0) / 6);
    const c1y = round(y1 + (y2 - y0) / 6);
    const c2x = round(x2 - (x3 - x1) / 6);
    const c2y = round(y2 - (y3 - y1) / 6);
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
  }
  return `${d} Z`;
}
