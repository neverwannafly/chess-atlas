/**
 * Chess Atlas mark: a board square turned 45° into a map pin, with two
 * checkered cells cut through it. Single colour; fills with currentColor.
 * Source of truth: public/brand/mark.svg (24×24 grid).
 */
const MARK_D =
  "M15.771 3.353L19.542 7.124A5.333 5.333 0 0 1 19.542 14.667L12 22.209L4.458 14.667A5.333 5.333 0 0 1 4.458 7.124L8.229 3.353A5.333 5.333 0 0 1 15.771 3.353ZM12 4.861L15.017 7.878L12 10.895L8.983 7.878ZM12 10.895L15.017 13.912L12 16.929L8.983 13.912Z";

type Tone = "accent" | "current";

export function LogoMark({ className = "h-6 w-6", tone = "accent" }: { className?: string; tone?: Tone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={[
        "shrink-0 transition-transform duration-200 ease-out motion-safe:group-hover/logo:-translate-y-px",
        tone === "accent" ? "text-accent" : "",
        className,
      ].join(" ")}
      fill="currentColor"
      aria-hidden
    >
      <path fillRule="evenodd" d={MARK_D} />
    </svg>
  );
}

export function Wordmark({
  markOnly = false,
  tone = "accent",
  className = "",
}: { markOnly?: boolean; tone?: Tone; className?: string } = {}) {
  return (
    <span className={["group/logo flex items-center gap-2", className].join(" ")}>
      <LogoMark tone={tone} />
      {markOnly ? (
        <span className="sr-only">Chess Atlas</span>
      ) : (
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-h2">Chess Atlas</span>
      )}
    </span>
  );
}
