import type {
  CrGame, CrMirrorStatus, CrPage, CrStatus, CrTournament, CrTournamentDetail, PlayerDetail, PlayerHit,
} from "@/types/chessresults";
import { get } from "@/lib/api";

const MOCK = import.meta.env.VITE_MOCK === "1";
const mocks = () => import("@/mocks/chessresults");

export interface CrQuery {
  status?: CrStatus;
  fed?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const CR_SOURCE = { name: "chess-results.com", url: "https://chess-results.com/" };

export async function fetchCrTournaments(query: CrQuery): Promise<CrPage<CrTournament>> {
  if (MOCK) return (await mocks()).mockCrTournaments(query);
  const p = new URLSearchParams();
  if (query.status) p.set("status", query.status);
  if (query.fed) p.set("fed", query.fed);
  if (query.q) p.set("q", query.q);
  if (query.page) p.set("page", String(query.page));
  if (query.pageSize) p.set("pageSize", String(query.pageSize));
  return get<CrPage<CrTournament>>(`/api/chessresults/tournaments?${p.toString()}`);
}

export async function fetchCrTournament(id: string): Promise<CrTournamentDetail> {
  if (MOCK) return (await mocks()).mockCrTournament(id);
  const body = await get<{ data: CrTournamentDetail; meta?: { refresh?: CrTournamentDetail["refresh"] } }>(
    `/api/chessresults/tournaments/${encodeURIComponent(id)}`,
  );
  return { ...body.data, refresh: body.meta?.refresh };
}

export async function fetchCrRound(id: string, round: number): Promise<CrGame[]> {
  if (MOCK) return (await mocks()).mockCrRound(id, round);
  return (await get<{ data: CrGame[] }>(`/api/chessresults/tournaments/${encodeURIComponent(id)}/rounds/${round}`)).data;
}

export async function fetchCrStatus(): Promise<CrMirrorStatus> {
  if (MOCK) return (await mocks()).mockCrStatus();
  return (await get<{ data: CrMirrorStatus }>("/api/chessresults/status")).data;
}

export async function searchPlayers(q: string): Promise<PlayerHit[]> {
  if (MOCK) return (await mocks()).mockSearchPlayers(q);
  return (await get<{ data: PlayerHit[] }>("/api/players", new URLSearchParams({ q }))).data;
}

export async function fetchPlayer(id: string): Promise<PlayerDetail> {
  if (MOCK) return (await mocks()).mockPlayer(id);
  const body = await get<{ data: PlayerDetail; meta?: { refresh?: PlayerDetail["refresh"] } }>(`/api/players/${encodeURIComponent(id)}`);
  return { ...body.data, refresh: body.meta?.refresh };
}

export const fideProfileUrl = (fideId: string) => `https://ratings.fide.com/profile/${encodeURIComponent(fideId)}`;

// ---------------------------------------------------------------- formatting

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "4 minutes ago", "in 2 hours", "3 days ago". */
export function relativeTime(iso: string | number | null | undefined, now = Date.now()): string | null {
  if (iso == null) return null;
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const s = Math.round((t - now) / 1000);
  const a = Math.abs(s);
  if (a < 45) return s <= 0 ? "just now" : "in a few seconds";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  if (a < 86400 * 365) return rtf.format(Math.round(s / (86400 * 30)), "month");
  return rtf.format(Math.round(s / (86400 * 365)), "year");
}

export const absoluteTime = (iso: string | number) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Points with a half as "½": 4.5 → "4½", 0.5 → "½". */
export function formatPoints(p: number | null | undefined): string {
  if (p == null) return "—";
  const whole = Math.floor(p);
  const half = Math.abs(p - whole - 0.5) < 1e-6;
  if (half) return whole === 0 ? "½" : `${whole}½`;
  return Number.isInteger(p) ? String(p) : String(Math.round(p * 100) / 100);
}

export function formatTiebreak(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
}

/** Rounds started and finished, from the per-round progress array. */
export function roundProgress(rounds: { round: number; games: number; played: number }[], total: number | null) {
  const started = rounds.filter((r) => r.played > 0);
  const current = started.length ? Math.max(...started.map((r) => r.round)) : rounds.length ? 1 : null;
  // Without the scheduled total, the highest published round is only a lower bound, so `of` stays unknown.
  return { current, of: total };
}

/** "12–15 Nov 2026" style range that tolerates missing dates. */
export function crDateRange(start: string | null, end: string | null): string | null {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));
  if (!start && !end) return null;
  if (!start || !end || start === end) return f((start ?? end)!, { day: "numeric", month: "short", year: "numeric" });
  if (start.slice(0, 7) === end.slice(0, 7)) return `${+start.slice(8)}–${f(end, { day: "numeric", month: "short", year: "numeric" })}`;
  if (start.slice(0, 4) === end.slice(0, 4)) return `${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${f(start, { day: "numeric", month: "short", year: "numeric" })} – ${f(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export const statusLabel: Record<CrStatus, string> = { ongoing: "Live", upcoming: "Upcoming", finished: "Finished" };

/** chess-results stores "Last, First"; read it as "First Last". */
export function playerName(raw: string | null | undefined): string {
  if (!raw) return "Unknown player";
  const m = raw.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2]} ${m[1]}` : raw;
}

export const shell = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";
