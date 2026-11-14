/**
 * The training-arc background: a lattice of four-point stars that, as the
 * section is scrolled, morph in place into circles and then swell until they
 * merge and the card turns white.
 *
 * Every shape is a superellipse |x|^n + |y|^n = 1. A small exponent gives a
 * thin four-point star, n = 2 is a circle, so one number drives the morph.
 */

export type Point = readonly [x: number, y: number];

export const STAR_EXPONENT = 0.55;
export const CIRCLE_EXPONENT = 2;

/** Rows sit √3/2 apart with every other row shifted half a cell: a triangular lattice. */
const ROW_RATIO = Math.sqrt(3) / 2;
/** Circles of this radius (in cells) fully cover a triangular lattice (exact value is 1/√3). */
const COVER_RADIUS = 0.62;
/** Top rows start later than bottom rows, so the change rises up the card. */
const WAVE_DELAY = 0.16;
/** Whiteness completes a little before the end so the white card can be seen at rest. */
const FINISH_AT = 0.93;

const INK = "#0c0c0d";
const WHITE = "#ffffff";

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Evenly spaced points (by angle) on a unit superellipse. */
export function superellipsePoints(
  exponent: number,
  segments: number,
): Point[] {
  const power = 2 / exponent;
  const points: Point[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push([
      Math.sign(cos) * Math.abs(cos) ** power,
      Math.sign(sin) * Math.abs(sin) ** power,
    ]);
  }
  return points;
}

export type ShapeState = {
  exponent: number;
  /** Radius in cell units. */
  radius: number;
  rotation: number;
};

/**
 * What one lattice shape looks like at a given scroll progress.
 * `height01` is the shape's vertical position (0 top, 1 bottom) and `seed` a
 * stable per-shape random number used to vary star sizes and twinkle.
 */
export function shapeAt(
  progress: number,
  height01: number,
  seed: number,
  twinkle = 0,
): ShapeState {
  const finished = clamp01(progress / FINISH_AT);
  const delay = WAVE_DELAY * (1 - height01);
  const local = clamp01((finished - delay) / (1 - WAVE_DELAY));

  const morph = smoothstep(0.26, 0.56, local);
  const swell = smoothstep(0.52, 1, local) ** 1.4;

  // Some lattice points stay dark while they are stars, so the opening reads
  // as a starfield rather than a grid; they appear as the circles form.
  const lit = seed < 0.45 ? 0 : 0.6 + seed * 0.8;
  const starScale = lerp(lit, 1, morph);
  const shimmer = 1 + twinkle * 0.2 * (1 - morph);
  const resting = 0.17 * starScale * shimmer;
  const radius =
    lerp(resting, 0.2, morph) + swell * (COVER_RADIUS + 0.03 - 0.2);

  return {
    exponent: lerp(STAR_EXPONENT, CIRCLE_EXPONENT, morph),
    radius,
    rotation: morph * (Math.PI / 4),
  };
}

/** Deterministic 0 to 1 hash for a lattice cell, so stars keep their size between frames. */
function seedFor(column: number, row: number): number {
  const value = Math.sin(column * 127.1 + row * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const EXPONENT_STEPS = 48;
/** Distance in CSS pixels over which shapes shrink to nothing near the text. */
const CLEAR_FEATHER = 56;

export type Zone = { x: number; y: number; width: number; height: number };

/**
 * 0 inside the zone, rising to 1 by `feather` pixels outside it. Shapes are
 * scaled by this so the pattern fades out around text, like halftone thinning
 * into a clear patch.
 */
export function clearance(
  x: number,
  y: number,
  zone: Zone,
  feather: number,
): number {
  const dx = Math.max(zone.x - x, 0, x - (zone.x + zone.width));
  const dy = Math.max(zone.y - y, 0, y - (zone.y + zone.height));
  return smoothstep(0, feather, Math.hypot(dx, dy));
}

export class StarField {
  private readonly context: CanvasRenderingContext2D;
  private shapes: Path2D[] = [];
  private width = 0;
  private height = 0;
  private scale = 1;
  private cell = 40;
  private zone: Zone | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D is not available");
    }
    this.context = context;
    this.shapes = Array.from({ length: EXPONENT_STEPS + 1 }, (_, step) => {
      const exponent = lerp(
        STAR_EXPONENT,
        CIRCLE_EXPONENT,
        step / EXPONENT_STEPS,
      );
      const path = new Path2D();
      superellipsePoints(exponent, 40).forEach(([x, y], index) =>
        index === 0 ? path.moveTo(x, y) : path.lineTo(x, y),
      );
      path.closePath();
      return path;
    });
  }

  /** Matches the canvas to its CSS size. Cells are smaller on phones so the pattern stays fine. */
  resize(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.scale = Math.min(window.devicePixelRatio || 1, 2);
    this.width = width;
    this.height = height;
    this.cell = width < 640 ? 30 : 42;
    this.canvas.width = Math.round(width * this.scale);
    this.canvas.height = Math.round(height * this.scale);
  }

  /** Area (relative to the canvas, CSS pixels) to keep clear for text. */
  setClearZone(zone: Zone | null): void {
    this.zone = zone;
  }

  /**
   * `time` is in seconds and only matters while `twinkle` is on. `clearing`
   * (0 to 1) is how strongly shapes avoid the clear zone.
   */
  render(progress: number, time: number, twinkle: boolean, clearing = 1): void {
    const { context, width, height, cell, scale, zone } = this;
    if (width === 0 || height === 0) {
      return;
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (progress >= FINISH_AT) {
      context.fillStyle = WHITE;
      context.fillRect(0, 0, width, height);
      return;
    }
    context.fillStyle = INK;
    context.fillRect(0, 0, width, height);
    context.fillStyle = WHITE;

    const rowHeight = cell * ROW_RATIO;
    const rows = Math.ceil(height / rowHeight) + 2;
    const columns = Math.ceil(width / cell) + 2;

    for (let row = -1; row < rows; row += 1) {
      const y = row * rowHeight;
      const offset = row % 2 === 0 ? 0 : cell / 2;
      for (let column = -1; column < columns; column += 1) {
        const x = column * cell + offset;
        const seed = seedFor(column, row);
        const pulse = twinkle ? Math.sin(time * 1.7 + seed * Math.PI * 2) : 0;
        const shape = shapeAt(progress, clamp01(y / height), seed, pulse);
        const room = zone ? clearance(x, y, zone, CLEAR_FEATHER) : 1;
        const radius = shape.radius * cell * lerp(1, room, clearing);
        if (radius < 0.4) {
          continue;
        }
        const step = Math.round(
          ((shape.exponent - STAR_EXPONENT) /
            (CIRCLE_EXPONENT - STAR_EXPONENT)) *
            EXPONENT_STEPS,
        );
        const cos = Math.cos(shape.rotation) * radius * scale;
        const sin = Math.sin(shape.rotation) * radius * scale;
        context.setTransform(cos, sin, -sin, cos, x * scale, y * scale);
        context.fill(this.shapes[step]);
      }
    }
  }
}
