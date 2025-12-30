import { Crown } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="h-11 shrink-0 border-b bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Chess Atlas</span>
      </div>
      <ThemeToggle />
    </header>
  );
}
