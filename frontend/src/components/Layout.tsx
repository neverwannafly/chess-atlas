import { Link, NavLink, Outlet, ScrollRestoration } from "react-router-dom";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { cn } from "@/lib/utils";

const nav = ({ isActive }: { isActive: boolean }) =>
  cn("flex h-10 items-center border-b-4 px-2 text-[15px] font-semibold sm:px-3", isActive ? "border-gold text-gold" : "border-transparent text-hall-ink hover:border-hall-muted");

export function Layout() {
  useSmoothScroll();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-gold focus:px-3 focus:py-2 focus:text-hall">
        Skip to content
      </a>
      <header className="on-hall relative z-30 bg-hall text-hall-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Chess Atlas home">
            <LogoMark />
            <span className="whitespace-nowrap font-display text-xl font-extrabold leading-none sm:text-2xl">Chess Atlas</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/" end className={nav}>Tournaments</NavLink>
            <NavLink to="/stats" className={nav}>Insights</NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="on-hall mt-20 bg-hall text-hall-muted">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 text-[14px] sm:grid-cols-2">
          <p className="font-display text-2xl font-extrabold text-hall-ink">Chess Atlas</p>
          <div className="space-y-1">
            <p>An independent directory of Indian chess tournaments.</p>
            <p>Event data comes from the All India Chess Federation (AICF). Check details with the organiser before you travel.</p>
          </div>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
