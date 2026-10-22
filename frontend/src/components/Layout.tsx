import { Link, NavLink, Outlet, ScrollRestoration } from "react-router-dom";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const nav = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-md px-2 py-2 text-sm font-medium hover:bg-sunk sm:px-3", isActive ? "text-accent" : "text-muted");

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Chess Atlas home">
            <LogoMark />
            <span className="whitespace-nowrap font-display text-xl font-semibold tracking-tight">Chess Atlas</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavLink to="/" end className={nav}>Tournaments</NavLink>
            <NavLink to="/stats" className={nav}>Insights</NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-[13px] text-muted sm:flex-row sm:justify-between">
          <p>Chess Atlas — an independent directory of Indian chess tournaments.</p>
          <p>Event data from the All India Chess Federation (AICF). Verify details with the organiser before travelling.</p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
