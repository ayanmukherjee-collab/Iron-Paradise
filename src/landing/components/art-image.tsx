import type { Art } from "@/content/landing";

type ArtImageProps = {
  art: Art;
  /** The `sizes` attribute: how wide the image renders at each breakpoint. */
  sizes: string;
  /** Only the hero art should load eagerly; everything else waits for scroll. */
  priority?: boolean;
  /** "bottom-right" also softens a right edge where the source art was cropped. */
  fade?: "bottom" | "bottom-right";
  className?: string;
};

const FADES = {
  bottom: "[mask-image:linear-gradient(to_bottom,black_55%,transparent_98%)]",
  "bottom-right":
    "[mask-image:linear-gradient(to_bottom,black_55%,transparent_98%),linear-gradient(to_left,transparent,black_22%)] [mask-composite:intersect]",
};

/**
 * Character art with a bottom fade so it melts into the section instead of
 * ending on a hard edge. The files are pre-sized by `npm run art`, so a plain
 * <img> with srcset is enough and nothing depends on a paid image service.
 */
export function ArtImage({
  art,
  sizes,
  priority = false,
  fade = "bottom",
  className = "",
}: ArtImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimised static files, see above
    <img
      src={`/art/${art.file}-560.webp`}
      srcSet={`/art/${art.file}-560.webp 560w, /art/${art.file}-960.webp 960w`}
      sizes={sizes}
      width={art.width}
      height={art.height}
      alt=""
      aria-hidden
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      className={`pointer-events-none select-none ${FADES[fade]} ${className}`}
    />
  );
}
