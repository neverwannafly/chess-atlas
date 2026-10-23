import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, CalendarPlus, FileText } from "lucide-react";
import type { EventDetail } from "@/types/event";
import { Button } from "@/components/ui/button";
import { ActionButtons, ShareButton } from "@/components/event-page/actions";
import { EASE } from "@/components/event-page/motion";
import { calendarUrl } from "@/lib/api";
import { registrationOf } from "@/lib/eventDetail";
import { formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Desktop: a slim bar under the site header. Mobile: a bottom action bar within thumb reach. */
export function CondensedBar({ e, name, show }: { e: EventDetail; name: string; show: boolean }) {
  const reduce = useReducedMotion();
  const reg = registrationOf(e);
  const where = e.city ?? e.state ?? "";
  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="top"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="glass-bg fixed inset-x-0 top-[var(--toolbar-h)] z-30 hidden border-b border-border md:block"
          >
            <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:px-8">
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })} className="min-w-0 flex-1 rounded-sm text-left" title="Back to top">
                <p className="truncate text-ui font-semibold">{name}</p>
                <p className="truncate text-small text-muted">{formatDateRange(e.startDate, e.endDate, true)}{where && ` · ${where}`}</p>
              </button>
              <ActionButtons e={e} name={name} size="sm" compact className="shrink-0 flex-nowrap" />
            </div>
          </motion.div>
          <motion.div
            key="bottom"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="glass-bg fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              {reg.open && reg.link ? (
                <Button asChild size="lg" className="h-11 flex-1"><a href={reg.link} target="_blank" rel="noopener noreferrer">Register<ArrowUpRight aria-hidden /></a></Button>
              ) : e.brochureUrl ? (
                <Button asChild size="lg" className="h-11 flex-1"><a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText aria-hidden />Open brochure</a></Button>
              ) : (
                <Button asChild size="lg" variant="secondary" className="h-11 flex-1"><a href={calendarUrl(e.eventCode)} download><CalendarPlus aria-hidden />Add to calendar</a></Button>
              )}
              {reg.open && e.brochureUrl && (
                <Button asChild variant="secondary" size="icon" className="h-11 w-11"><a href={e.brochureUrl} target="_blank" rel="noopener noreferrer" aria-label="Brochure"><FileText aria-hidden /></a></Button>
              )}
              {(reg.open || e.brochureUrl) && (
                <Button asChild variant="secondary" size="icon" className="h-11 w-11"><a href={calendarUrl(e.eventCode)} download aria-label="Add to calendar"><CalendarPlus aria-hidden /></a></Button>
              )}
              <ShareButton title={name} iconOnly className="h-11 w-11" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function SectionNav({ sections, active }: { sections: { id: string; title: string }[]; active: string | null }) {
  const reduce = useReducedMotion();
  return (
    <nav aria-label="On this page">
      <p className="mb-3 text-label font-medium uppercase tracking-[0.08em] text-muted">On this page</p>
      <ul className="relative space-y-0.5">
        <span className="absolute inset-y-0 left-0 w-px bg-border" aria-hidden />
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id} className="relative">
              {on && <motion.span layoutId="spy" className="absolute inset-y-1 left-0 w-px bg-fg" transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} aria-hidden />}
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                onClick={(ev) => {
                  const el = document.getElementById(s.id);
                  if (!el) return;
                  ev.preventDefault();
                  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
                  history.replaceState(history.state, "", `#${s.id}`);
                }}
                className={cn("block py-1.5 pl-4 text-ui transition-colors duration-[var(--dur-2)]", on ? "font-medium text-fg" : "text-muted hover:text-fg")}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
