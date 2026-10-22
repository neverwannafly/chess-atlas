import { useEffect } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const nav = ({ isActive }: { isActive: boolean }) =>
  cn("flex h-9 items-center rounded-sm px-3 text-ui font-medium transition-colors", isActive ? "text-fg" : "text-muted hover:text-fg");

export function Layout() {
  const { pathname } = useLocation();
  const home = pathname === "/";
  // Pages other than Discover keep a slim sticky header; Discover hands that job to its own toolbar.
  useEffect(() => {
    if (!home) document.documentElement.style.setProperty("--toolbar-h", "56px");
  }, [home]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>
      <header className={cn("z-40 border-b", home ? "relative border-transparent" : "glass sticky top-0 border-border")}>
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Chess Atlas home" className="-ml-1 rounded-sm px-1 py-1">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-0.5">
            <NavLink to="/" end className={nav}>Tournaments</NavLink>
            <NavLink to="/stats" className={nav}>Insights</NavLink>
            <span className="mx-1.5 h-4 w-px bg-border" aria-hidden />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-24 border-t border-border">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 text-small text-muted sm:grid-cols-[1fr_1.4fr] sm:px-6 lg:px-8">
          <div className="space-y-2">
            <Wordmark />
            <p>An independent directory of AICF-registered chess tournaments in India.</p>
          </div>
          <div className="space-y-2 sm:text-right">
            <p>Event data from the All India Chess Federation. Brochure details are summarised automatically; confirm with the organiser before you travel.</p>
            <p>
              Chess pieces: cburnett set by{" "}
              <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://en.wikipedia.org/wiki/User:Cburnett" target="_blank" rel="noopener noreferrer">Colin M.L. Burnett</a>
              , licensed{" "}
              <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html" target="_blank" rel="noopener noreferrer">GPLv2+</a>
              , via lichess.org.
            </p>
          </div>
        </div>
      </footer>
      <ScrollRestoration getKey={(loc) => loc.pathname} />
    </div>
  );
}
