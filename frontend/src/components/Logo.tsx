/** A 2×2 board fragment: one accent square, one light square on a dark tile. */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="var(--fg)" />
      <rect x="5" y="5" width="7" height="7" rx="1.5" fill="var(--accent)" />
      <rect x="12" y="12" width="7" height="7" rx="1.5" fill="var(--bg)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="whitespace-nowrap text-[15px] font-semibold tracking-h3">Chess Atlas</span>
    </span>
  );
}
