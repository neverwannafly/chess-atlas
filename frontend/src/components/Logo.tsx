export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="8" fill="#ffb400" />
      <rect x="32" width="32" height="32" fill="#14173b" />
      <rect y="32" width="32" height="32" fill="#14173b" />
      <circle cx="16" cy="16" r="9" fill="#14173b" />
      <circle cx="48" cy="48" r="9" fill="#ffb400" />
      <circle cx="16" cy="16" r="3.5" fill="#ffb400" />
    </svg>
  );
}
