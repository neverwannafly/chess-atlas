import { cn } from "@/lib/utils";

export function Chip({ pressed, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "h-10 cursor-pointer rounded-full border px-3.5 text-sm font-medium transition-colors",
        pressed ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:bg-sunk",
        className
      )}
      {...props}
    />
  );
}
