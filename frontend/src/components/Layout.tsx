import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchField } from "@/components/ui/SearchField";
import { getUi, requestSearchFocus, setUi, useUi } from "@/hooks/useDiscoverUi";
import { activeCount, useFilters } from "@/lib/filters";
import { useSearchText } from "@/hooks/useSearchText";
import { cn } from "@/lib/utils";

const nav = ({ isActive }: { isActive: boolean }) =>
  cn("flex h-9 items-center rounded-sm px-3 text-ui font-medium transition-colors", isActive ? "text-fg" : "text-muted hover:text-fg");

/** The search that docks into the header once the hero's field has scrolled away (home only). */
function DockedSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const { filters } = useFilters();
  const [text, setText] = useSearchText();
  const n = activeCount(filters);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md"
    >
      <SearchField ref={inputRef} id="dock-search" value={text} onChange={setText} className="flex-1" placeholder="Search tournaments" />
      <button
        type="button"
        onClick={() => setUi({ sheetOpen: true })}
        aria-label={n ? `Filters, ${n} active` : "Filters"}
        className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-ui font-medium lg:hidden", n ? "border-accent/40 bg-accent-soft text-fg" : "border-border-strong/70 bg-surface text-fg")}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {n > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-fg">{n}</span>}
      </button>
    </motion.div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const home = pathname === "/";
  const docked = useUi((s) => s.docked) && home;
  const dockRef = useRef<HTMLInputElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // "/" and ⌘K / Ctrl+K focus search from anywhere; off the home page they take you there first.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !t.closest("input, textarea, select, [contenteditable]");
      if (!cmdK && !slash) return;
      if (t.closest("[role=dialog]") && !cmdK) return;
      e.preventDefault();
      if (window.location.pathname !== "/") {
        navigate("/");
        requestSearchFocus();
      } else if (getUi().docked) {
        dockRef.current?.focus();
        dockRef.current?.select();
      } else requestSearchFocus();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>
      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-[var(--dur-2)]",
          scrolled || !home ? "glass-bg border-border" : "border-transparent bg-transparent"
        )}
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="mx-auto flex h-[var(--header-h)] max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="Chess Atlas home"
            onClick={(e) => { if (home) { e.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } }}
            className="-ml-1 shrink-0 rounded-sm px-1 py-1"
          >
            {docked ? (
              <>
                <span className="lg:hidden"><LogoMark /></span>
                <span className="max-lg:hidden"><Wordmark /></span>
              </>
            ) : (
              <Wordmark />
            )}
          </Link>
          <div className="flex min-w-0 flex-1 justify-center">
            <AnimatePresence>{docked && <DockedSearch inputRef={dockRef} />}</AnimatePresence>
          </div>
          <nav aria-label="Primary" className={cn("flex shrink-0 items-center gap-0.5", docked && "max-lg:hidden")}>
            <NavLink to="/" end className={(s) => cn(nav(s), "max-sm:hidden")}>Tournaments</NavLink>
            <NavLink to="/insights" className={nav}>Insights</NavLink>
            <span className="mx-1.5 h-4 w-px bg-border" aria-hidden />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-20 border-t border-border">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 text-small text-muted sm:px-6 md:grid-cols-[1fr_auto_1.3fr] lg:px-8">
          <div className="space-y-2">
            <Wordmark />
            <p className="max-w-[36ch]">An independent directory of AICF-registered chess tournaments in India.</p>
          </div>
          <nav aria-label="Footer" className="flex gap-5 md:flex-col md:gap-2">
            <Link to="/" className="hover:text-fg">Tournaments</Link>
            <Link to="/insights" className="hover:text-fg">Insights</Link>
          </nav>
          <div className="space-y-2 md:text-right">
            <p>Event data from the All India Chess Federation. Brochure details are summarised automatically; confirm with the organiser before you travel.</p>
            <p>
              Map outline: Natural Earth (public domain). Chess pieces: cburnett set by{" "}
              <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://en.wikipedia.org/wiki/User:Cburnett" target="_blank" rel="noopener noreferrer">Colin M.L. Burnett</a>
              , licensed{" "}
              <a className="underline decoration-border-strong underline-offset-2 hover:text-fg" href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html" target="_blank" rel="noopener noreferrer">GPLv2+</a>.
            </p>
          </div>
        </div>
      </footer>
      <ScrollRestoration getKey={(loc) => loc.pathname} />
    </div>
  );
}
