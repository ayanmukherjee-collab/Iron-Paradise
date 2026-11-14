import { encode } from "uqr";

/**
 * A QR code drawn as one SVG path of square modules: crisp at any size and
 * scannable from a phone screen held up at the desk.
 */
export function QrCode({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { data, size } = encode(value, { ecc: "M", border: 2 });
  const path = data
    .flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : "")))
    .join("");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={`bg-white ${className}`}
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#0c0c0d" />
    </svg>
  );
}
