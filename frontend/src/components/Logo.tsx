export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-accent" />
      <path
        className="fill-accent-ink"
        d="M22 50h20v-4H22zM25 44c0-7 1-10 5-14-4-1-7-4-7-8 0-5 4-9 10-9 6 0 11 4 11 11 0 5-3 7-6 9 3 3 4 7 4 11H25z"
      />
      <circle cx="34" cy="20" r="1.6" className="fill-accent" />
    </svg>
  );
}
