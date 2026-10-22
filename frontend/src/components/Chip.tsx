import { cn } from "@/lib/utils";

export function Chip({ pressed, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "h-10 cursor-pointer rounded-md border-2 px-3.5 text-sm font-semibold transition-colors",
        pressed ? "border-accent bg-accent text-accent-ink" : "border-ink/15 bg-surface hover:border-accent",
        className
      )}
      {...props}
    />
  );
}
