import {
  mirrorOutline,
  smoothClosedPath,
  spikyHair,
  type Point,
} from "../silhouette";
import { HalftoneFigure } from "./halftone-figure";

/*
 * Original anime-style silhouettes drawn for this site. They borrow the genre's
 * archetypes (flame-like spiky hair, a cape, an oversized sword) but are not any
 * existing character, so the gym can use them without licensing anyone's art.
 */

type FigureProps = { className?: string };

function Limb({ d, width }: { d: string; width: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="white"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/* ---------- Riser: back view, fists at the hips, mid power-up ---------- */

const RISER_BODY_RIGHT: Point[] = [
  [214, 132],
  [222, 146],
  [246, 154],
  [272, 163],
  [298, 169],
  [322, 179],
  [339, 198],
  [347, 222],
  [355, 248],
  [362, 276],
  [364, 302],
  [358, 330],
  [347, 358],
  [333, 380],
  [339, 397],
  [331, 416],
  [311, 421],
  [298, 407],
  [300, 388],
  [311, 362],
  [319, 334],
  [319, 311],
  [311, 288],
  [300, 266],
  [292, 288],
  [282, 322],
  [267, 356],
  [255, 384],
  [254, 410],
  [260, 440],
  [270, 500],
  [280, 562],
  [214, 562],
  [206, 500],
  [200, 486],
];

const RISER_BODY = smoothClosedPath(mirrorOutline(RISER_BODY_RIGHT, 200));

const RISER_HAIR = spikyHair({
  center: [200, 100],
  valleyRadius: 46,
  rise: 0.18,
  spikes: [
    { angle: 152, length: 46 },
    { angle: 185, length: 64 },
    { angle: 218, length: 80 },
    { angle: 251, length: 94 },
    { angle: 284, length: 88 },
    { angle: 317, length: 76 },
    { angle: 350, length: 62 },
    { angle: 383, length: 42 },
  ],
  hairline: [
    [244, 132],
    [222, 140],
    [200, 143],
    [178, 140],
    [156, 132],
  ],
});

export function RiserFigure({ className }: FigureProps) {
  return (
    <HalftoneFigure
      id="riser"
      width={400}
      height={560}
      className={className}
      fadeFrom={0.48}
      highlight={<path d={RISER_HAIR} />}
      body={
        <>
          <path d={RISER_BODY} />
          <ellipse cx={200} cy={108} rx={34} ry={38} />
          <ellipse cx={166} cy={114} rx={7} ry={12} />
          <ellipse cx={234} cy={114} rx={7} ry={12} />
          <path d={RISER_HAIR} />
        </>
      }
      cuts={
        <>
          <path d="M200 150 C200 220 201 300 200 392" strokeWidth={3.5} />
          <path d="M232 194 C260 212 264 246 247 278" strokeWidth={3} />
          <path d="M168 194 C140 212 136 246 153 278" strokeWidth={3} />
          <path d="M296 264 C284 302 268 338 256 372" strokeWidth={2.5} />
          <path d="M104 264 C116 302 132 338 144 372" strokeWidth={2.5} />
          <path d="M336 222 C328 244 334 266 350 288" strokeWidth={2.5} />
          <path d="M64 222 C72 244 66 266 50 288" strokeWidth={2.5} />
          <path d="M320 312 L360 304" strokeWidth={2} />
          <path d="M80 312 L40 304" strokeWidth={2} />
          <path d="M214 304 C217 342 215 370 210 394" strokeWidth={2} />
          <path d="M186 304 C183 342 185 370 190 394" strokeWidth={2} />
          <path d="M146 410 L254 410" strokeWidth={5} />
        </>
      }
    />
  );
}

/* ---------- Caped: front view, cape caught by the wind. Unbothered. ---------- */

const CAPED_BODY_RIGHT: Point[] = [
  [214, 110],
  [220, 128],
  [240, 136],
  [266, 142],
  [282, 154],
  [289, 176],
  [292, 206],
  [296, 236],
  [298, 266],
  [296, 294],
  [303, 310],
  [301, 334],
  [288, 345],
  [275, 336],
  [274, 312],
  [276, 294],
  [276, 266],
  [272, 238],
  [264, 210],
  [258, 190],
  [256, 222],
  [250, 260],
  [252, 292],
  [257, 322],
  [259, 362],
  [255, 420],
  [250, 470],
  [248, 520],
  [254, 562],
  [208, 562],
  [206, 480],
  [204, 400],
  [200, 340],
];

const CAPED_BODY = smoothClosedPath(mirrorOutline(CAPED_BODY_RIGHT, 200));
const CAPE =
  "M166 130 C132 220 98 380 54 562 L330 562 C350 482 378 382 400 312 C362 272 292 202 236 130 Z";

export function CapedFigure({ className }: FigureProps) {
  return (
    <HalftoneFigure
      id="caped"
      width={400}
      height={560}
      className={className}
      fadeFrom={0.45}
      back={<path d={CAPE} />}
      highlight={
        <ellipse
          cx={190}
          cy={62}
          rx={15}
          ry={11}
          transform="rotate(-20 190 62)"
        />
      }
      body={
        <>
          <path d={CAPED_BODY} />
          <ellipse cx={200} cy={76} rx={30} ry={37} />
          <ellipse cx={170} cy={82} rx={5} ry={9} />
          <ellipse cx={230} cy={82} rx={5} ry={9} />
        </>
      }
      cuts={
        <>
          <path d="M162 294 Q200 300 238 294" strokeWidth={6} />
          <path d="M180 126 L200 152 L220 126" strokeWidth={3} />
          <path d="M200 346 L202 562" strokeWidth={4} />
          <path d="M258 196 C256 230 252 262 250 290" strokeWidth={3} />
          <path d="M142 196 C144 230 148 262 150 290" strokeWidth={3} />
          <path d="M276 300 L298 300" strokeWidth={3} />
          <path d="M124 300 L102 300" strokeWidth={3} />
          <path d="M208 500 L250 500" strokeWidth={3} />
          <path d="M192 500 L150 500" strokeWidth={3} />
          <path d="M172 196 Q200 212 228 196" strokeWidth={2.5} />
        </>
      }
    />
  );
}

/* ---------- Sword: a kid resting a far-too-big blade on his shoulder ---------- */

const SWORD_BODY: Point[] = [
  [198, 128],
  [214, 138],
  [236, 146],
  [246, 166],
  [244, 200],
  [238, 240],
  [236, 280],
  [240, 310],
  [252, 360],
  [262, 420],
  [270, 480],
  [278, 562],
  [240, 562],
  [232, 480],
  [220, 410],
  [204, 352],
  [196, 338],
  [186, 352],
  [172, 410],
  [160, 480],
  [152, 562],
  [114, 562],
  [122, 480],
  [132, 420],
  [144, 360],
  [150, 310],
  [152, 280],
  [148, 240],
  [144, 204],
  [142, 180],
  [136, 212],
  [131, 252],
  [131, 290],
  [137, 312],
  [129, 331],
  [112, 327],
  [106, 308],
  [109, 286],
  [111, 248],
  [116, 206],
  [122, 172],
  [131, 152],
  [148, 140],
  [170, 136],
  [176, 128],
];

const SWORD_OUTLINE = smoothClosedPath(SWORD_BODY);
const SWORD_HAIR = spikyHair({
  center: [186, 96],
  valleyRadius: 30,
  rise: 0.25,
  spikes: [
    { angle: 160, length: 22 },
    { angle: 190, length: 30 },
    { angle: 220, length: 26 },
    { angle: 248, length: 36 },
    { angle: 276, length: 28 },
    { angle: 304, length: 34 },
    { angle: 334, length: 24 },
    { angle: 364, length: 18 },
  ],
  hairline: [
    [214, 104],
    [186, 96],
    [158, 104],
  ],
});
const HEADBAND_TAIL = "M150 96 Q124 90 106 106 Q126 98 152 104 Z";
// Drawn along +x, then rotated so the blade rests on the shoulder and runs up behind it.
const SWORD_TRANSFORM = "translate(232 204) rotate(-52) scale(0.86)";
const BLADE =
  "M14 -28 L250 -32 L304 -10 L298 26 L232 30 L224 21 L208 31 L152 29 L144 19 L133 30 L14 28 Z";
const BLADE_EDGE = "M14 -28 L250 -32 L304 -10 L292 -13 L248 -21 L14 -17 Z";

export function SwordFigure({ className }: FigureProps) {
  return (
    <HalftoneFigure
      id="sword"
      width={400}
      height={560}
      className={className}
      fadeFrom={0.5}
      highlight={
        <>
          <path d={BLADE_EDGE} transform={SWORD_TRANSFORM} />
          <path d={SWORD_HAIR} />
        </>
      }
      body={
        <>
          <g transform={SWORD_TRANSFORM}>
            <path d={BLADE} />
            <rect x={0} y={-46} width={16} height={92} rx={6} />
            <rect x={-46} y={-8} width={48} height={16} rx={6} />
            <circle cx={-52} cy={0} r={10} />
          </g>
          <path d={SWORD_OUTLINE} />
          <path d={HEADBAND_TAIL} />
          <path d={SWORD_HAIR} />
          <ellipse cx={186} cy={100} rx={30} ry={34} />
          <Limb d="M240 152 Q290 180 282 232" width={30} />
          <Limb d="M282 232 Q250 236 220 224" width={26} />
          <circle cx={218} cy={222} r={16} />
        </>
      }
      cuts={
        <>
          <path d="M30 0 L232 0" strokeWidth={3} transform={SWORD_TRANSFORM} />
          <path d={BLADE} strokeWidth={3} transform={SWORD_TRANSFORM} />
          <path d="M282 232 Q250 236 230 228" strokeWidth={2.5} />
          <path d="M158 92 Q186 100 216 94" strokeWidth={5} />
          <path d="M152 298 Q196 306 238 298" strokeWidth={5} />
          <path d="M192 142 L194 294" strokeWidth={2.5} />
          <path d="M144 166 C146 220 148 260 152 296" strokeWidth={3} />
          <path d="M196 342 L198 562" strokeWidth={4} />
          <path d="M240 168 C246 200 244 230 238 260" strokeWidth={2.5} />
        </>
      }
    />
  );
}
