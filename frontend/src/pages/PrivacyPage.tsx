import { Link } from "react-router-dom";
import { PageHead } from "@/components/cr/common";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { shell } from "@/lib/chessresults";

const H2 = "mt-10 text-[20px] font-semibold tracking-h2 text-fg";
const UL = "mt-3 list-disc space-y-2 pl-5";
const P = "mt-3";

export default function PrivacyPage() {
  useDocumentMeta("Privacy notice", "What personal data Chess Atlas holds, why, and how to ask for its deletion.");
  return (
    <div className={shell}>
      <PageHead title="Privacy notice">Last updated: 2026-10-31</PageHead>
      <article className="max-w-[68ch] pb-6 pt-8 text-body leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-fg">
        <p>
          Chess Atlas lists chess tournaments in India and shows results and ratings for the players in them.
          This notice explains what personal data we hold, why, where it comes from, and what you can do about it.
        </p>
        <p className="mt-6 flex gap-3 rounded-md border border-border bg-surface px-4 py-3 text-small shadow-e1">
          <span className="mt-px inline-flex h-5 shrink-0 items-center rounded-sm border border-border-strong px-1.5 text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-muted" aria-hidden>Beta</span>
          <span><strong>Beta.</strong> Chess Atlas is in beta. Some details are still being completed, and this notice will
          be updated soon.</span>
        </p>

        <h2 className={H2}>What we hold</h2>
        <ul className={UL}>
          <li><strong>Player name, federation and club</strong>, as printed in tournament results.</li>
          <li><strong>Rating</strong> as printed in a tournament (chess-results) or in FIDE's published monthly rating list.</li>
          <li><strong>FIDE id</strong>, when the tournament's starting list prints it or the FIDE list includes the player.</li>
          <li><strong>chess-results Ident-Number</strong>: the site's own number for a player, shown on the player card.</li>
          <li><strong>FIDE title and FIDE rating history</strong>, from FIDE's published monthly rating list.</li>
          <li><strong>Tournament results</strong>: standings, rounds, pairings and game results.</li>
        </ul>
        <p className={P}>We hold a <strong>year of birth</strong> for some players, from FIDE's published list or the player's chess-results card. We do <strong>not</strong> hold full dates of birth, because neither source publishes them. We use the year only to show an age category (for example U14). The year itself is not shown on this site.</p>

        <h2 className={H2}>Where it comes from</h2>
        <ul className={UL}>
          <li>Tournament data: chess-results.com (with the operator's permission). Each page links back to the source.</li>
          <li>Ratings and titles: FIDE's published monthly rating list.</li>
          <li>Archive of older tournaments: the chess-results tournament database for India.</li>
        </ul>

        <h2 className={H2}>Why we use it</h2>
        <p className={P}>
          To show Indian tournaments, their results, and players' ratings and tournament history.
          We do not sell it or share it for advertising.
        </p>

        <h2 className={H2}>How long we keep it</h2>
        <p className={P}>
          Tournament and result data is kept while the tournament is listed or archived. Ratings are kept as monthly
          history. When you ask us to delete your data, we remove it as described below.
        </p>

        <h2 className={H2}>Your rights</h2>
        <p className={P}>You can ask us to:</p>
        <ul className={UL}>
          <li><strong>Delete</strong> your data from this site.</li>
          <li><strong>Correct</strong> something that is wrong.</li>
          <li><strong>Tell you</strong> what we hold about you.</li>
        </ul>
        <p className={P}>
          Use the form at <Link to="/privacy/delete" className="font-mono text-[0.92em] text-fg underline decoration-border-strong underline-offset-2">/privacy/delete</Link>.
          Give your FIDE id, or the chess-results tournament number and your start
          number on that event. We reply to your email within 30 days.
        </p>
        <p className={P}>
          After we erase your data, your name is replaced with an anonymous record and your FIDE profile and ratings
          are removed. Later imports will not bring them back. Tournament results still show a game was played, under
          the anonymous record.
        </p>
        <p className={P}>
          Limits: chess-results.com and FIDE publish their own data. Erasing it here does not remove it from those
          sites. Ask them directly for that.
        </p>
        <p className="mt-6">
          <Button asChild variant="secondary"><Link to="/privacy/delete">Request deletion</Link></Button>
        </p>

        <h2 className={H2}>Who is responsible</h2>
        <p className={P}>
          Grievance officer details will be published here soon. Until then, send privacy questions and deletion
          requests through the <Link to="/privacy/delete" className="underline underline-offset-2">deletion form</Link>.
        </p>
        <p className={P}>
          If you are not satisfied with our reply, you can complain to the Data Protection Board of India once it is
          operational under the Digital Personal Data Protection Act, 2023.
        </p>
      </article>
    </div>
  );
}
