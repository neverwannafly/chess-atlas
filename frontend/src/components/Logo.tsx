/**
 * Chess Atlas mark: the owner's compass-knight artwork (public/brand/compass-knight-minimal.jpg),
 * used as-is. The JPG has a near-black square background, so it is clipped to the compass circle
 * (the ring spans ~77% of the image; the image is scaled up to crop to it). The 1024px source is
 * always downscaled, so it stays crisp at 2x for 24 to 40px.
 */
const SRC = "/brand/compass-knight-minimal.jpg";

export function LogoMark({ className = "h-7 w-7" }: { className?: string; tone?: "accent" | "current" }) {
  return (
    <span className={["relative inline-block shrink-0 overflow-hidden rounded-full bg-[#060b0e]", className].join(" ")} aria-hidden>
      <img
        src={SRC}
        alt=""
        width={56}
        height={56}
        decoding="async"
        draggable={false}
        className="absolute left-1/2 top-1/2 h-full w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-[1.3] select-none"
      />
    </span>
  );
}

export function Wordmark({
  markOnly = false,
  tone = "accent",
  className = "",
}: { markOnly?: boolean; tone?: "accent" | "current"; className?: string } = {}) {
  return (
    <span className={["flex items-center gap-2", className].join(" ")}>
      <LogoMark tone={tone} />
      {markOnly ? (
        <span className="sr-only">Chess Atlas</span>
      ) : (
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-h2">Chess Atlas</span>
      )}
    </span>
  );
}
