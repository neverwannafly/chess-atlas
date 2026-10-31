// Dev-only chess-results / FIDE mirror (VITE_MOCK=1). Every name, ID and result here is invented.
import type {
  CrGame, CrMirrorStatus, CrPage, CrResult, CrStanding, CrStatus, CrTournament, CrTournamentDetail,
  FideRatingPoint, PlayerDetail, PlayerHit, PlayerTournament,
} from "@/types/chessresults";
import type { CrQuery } from "@/lib/chessresults";
import { ApiError } from "@/lib/api";
import { addDays, todayIST } from "@/lib/format";

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const BASE = "https://chess-results.com/";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Aarav", "Vihaan", "Ishaan", "Kavya", "Ananya", "Rohan", "Diya", "Arjun", "Meera", "Siddharth", "Tanvi", "Kabir", "Nikhil", "Saanvi", "Pranav", "Riya", "Aditya", "Neha", "Harsh", "Lakshmi", "Varun", "Pooja", "Rahul", "Sneha", "Karthik", "Divya", "Yash", "Anjali", "Manish", "Shreya"];
const LAST = ["Rao", "Iyer", "Menon", "Kulkarni", "Banerjee", "Reddy", "Nair", "Joshi", "Pillai", "Deshpande", "Chatterjee", "Gupta", "Shetty", "Naidu", "Sharma", "Patil", "Mukherjee", "Krishnan", "Bhat", "Verma"];
const TITLES = ["GM", "IM", "FM", "CM", "WGM", "WIM", "WFM"];

interface MockPlayer extends PlayerHit {
  rating: number;
  sex: "M" | "F";
  club: string | null;
}

const PLAYERS: MockPlayer[] = (() => {
  const r = rng(7);
  const out: MockPlayer[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < 120; i++) {
    const fi = Math.floor(r() * FIRST.length);
    const name = `${LAST[Math.floor(r() * LAST.length)]}, ${FIRST[fi]}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const rating = Math.round(1250 + Math.pow(r(), 1.6) * 1250);
    const female = ["Kavya", "Ananya", "Diya", "Meera", "Tanvi", "Saanvi", "Riya", "Neha", "Lakshmi", "Pooja", "Sneha", "Divya", "Anjali", "Shreya"].includes(FIRST[fi]);
    const title = rating > 2400 ? "GM" : rating > 2300 ? "IM" : rating > 2200 ? (female ? "WGM" : "FM") : rating > 2100 && r() > 0.5 ? (female ? "WIM" : "CM") : null;
    out.push({
      id: 1000 + out.length,
      name,
      fed: r() > 0.94 ? "SRI" : "IND",
      fideId: r() > 0.12 ? String(1234500 + out.length * 7) : null,
      title: title && TITLES.includes(title) ? title : null,
      rating,
      sex: female ? "F" : "M",
      club: r() > 0.4 ? ["Mock Chess Academy", "Sample Knights Club", "Demo Chess School", "Test Rooks Circle"][Math.floor(r() * 4)] : null,
    });
  }
  return out;
})();

type TRow = [name: string, location: string, offset: number, len: number, tc: string | null, rounds: number, size: number];
const TROWS: TRow[] = [
  ["Sample City Open FIDE Rated Classical 2026", "Pune, Maharashtra", -3, 6, "90 min + 30 sec", 9, 40],
  ["Demo Coastal Rapid Rating Open", "Kochi, Kerala", 0, 2, "15 min + 10 sec", 9, 32],
  ["Mock State Under-15 Championship", "Bhubaneswar, Odisha", -1, 4, "90 min + 30 sec", 8, 28],
  ["Test Valley Blitz Festival", "Dehradun, Uttarakhand", 0, 1, "3 min + 2 sec", 11, 30],
  ["Placeholder Winter Open", "Jaipur, Rajasthan", 4, 5, "90 min + 30 sec", 9, 36],
  ["Example District Rapid Cup", "Mysuru, Karnataka", 7, 1, "15 min + 5 sec", 7, 26],
  ["Sample Junior Classical Under-11", "Nagpur, Maharashtra", 11, 3, "60 min + 30 sec", 7, 24],
  ["Demo Corporate Blitz League", "Gurugram, Haryana", 15, 1, "3 min + 2 sec", 9, 24],
  ["Mock Grandmasters Open", "Chennai, Tamil Nadu", 22, 8, "90 min + 30 sec", 10, 48],
  ["Test Hills Rapid Open", "Shillong, Meghalaya", 30, 2, "15 min + 10 sec", 8, 24],
  ["Placeholder Women's Classical", "Kolkata, West Bengal", 38, 4, "90 min + 30 sec", 9, 24],
  ["Example Open Championship", "Hyderabad, Telangana", 46, 3, "60 min + 30 sec", 7, 32],
  ["Sample Monsoon Open", "Mangaluru, Karnataka", -6, 4, "90 min + 30 sec", 9, 36],
  ["Demo Rapid Rating Tournament", "Indore, Madhya Pradesh", -9, 2, "15 min + 10 sec", 9, 30],
  ["Mock Diwali Blitz", "Ahmedabad, Gujarat", -12, 1, "3 min + 2 sec", 11, 28],
  ["Test State Senior Championship", "Lucknow, Uttar Pradesh", -18, 4, "90 min + 30 sec", 8, 24],
  ["Placeholder Under-9 Rapid", "Thrissur, Kerala", -21, 1, "15 min + 5 sec", 7, 26],
  ["Example International Open", "Panaji, Goa", -30, 7, "90 min + 30 sec", 10, 48],
  ["Sample Festival Open A", "Visakhapatnam, Andhra Pradesh", -38, 5, "90 min + 30 sec", 9, 40],
  ["Demo Monthly Rapid", "Bengaluru, Karnataka", -44, 1, "10 min + 5 sec", 7, 24],
  ["Mock University Team Championship", "Varanasi, Uttar Pradesh", -52, 3, "60 min + 30 sec", 7, 24],
  ["Test Late Summer Classical", null as unknown as string, -64, 5, null, 9, 30],
];

interface Built {
  t: CrTournament;
  standings: CrStanding[];
  games: Map<number, CrGame[]>;
  roundsInfo: { round: number; games: number; played: number }[];
}

function expectedScore(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

function build(): Built[] {
  const today = todayIST();
  const now = Date.now();
  return TROWS.map((row, idx) => {
    const [name, loc, offset, len, tc, rounds, size] = row;
    const r = rng(100 + idx);
    const start = addDays(today, offset);
    const end = addDays(start, len - 1);
    const status: CrStatus = end < today ? "finished" : start > today ? "upcoming" : "ongoing";
    const id = String(912000 + idx * 37);
    const pool = [...PLAYERS].sort(() => r() - 0.5).slice(0, size).sort((a, b) => b.rating - a.rating);
    const team = name.includes("Team");

    // How many rounds exist on chess-results: all for finished, some for ongoing, none (or round 1 pairings) for upcoming.
    const daysIn = Math.min(len, Math.max(0, Math.round((Date.parse(today) - Date.parse(start)) / 86400000) + 1));
    const playedRounds = status === "finished" ? rounds : status === "ongoing" ? Math.max(1, Math.min(rounds - 1, Math.ceil((daysIn / len) * rounds))) : 0;

    const score = new Map<number, number>(pool.map((p) => [p.id, 0]));
    const games = new Map<number, CrGame[]>();
    const roundsInfo: Built["roundsInfo"] = [];
    const snrOf = new Map(pool.map((p, i) => [p.id, i + 1]));

    for (let rd = 1; rd <= playedRounds; rd++) {
      const partial = status === "ongoing" && rd === playedRounds;
      const order = [...pool].sort((a, b) => (score.get(b.id)! - score.get(a.id)!) || b.rating - a.rating);
      const list: CrGame[] = [];
      for (let i = 0; i + 1 < order.length; i += 2) {
        const [w, b] = rd % 2 ? [order[i], order[i + 1]] : [order[i + 1], order[i]];
        const board = i / 2 + 1;
        let result: CrResult = null;
        if (!partial || r() > 0.55) {
          const e = expectedScore(w.rating + 35, b.rating);
          const x = r();
          result = x < e * 0.8 ? "1-0" : x > 1 - (1 - e) * 0.8 ? "0-1" : "½-½";
          if (r() > 0.985) result = "+-";
          const ws = result === "1-0" || result === "+-" ? 1 : result === "½-½" ? 0.5 : 0;
          score.set(w.id, score.get(w.id)! + ws);
          score.set(b.id, score.get(b.id)! + (result === "½-½" ? 0.5 : 1 - ws));
        }
        list.push({
          match: team ? Math.floor((board - 1) / 4) + 1 : 1,
          board: team ? ((board - 1) % 4) + 1 : board,
          result,
          whiteSnr: snrOf.get(w.id)!, whiteName: w.name, whiteFideId: w.fideId, whiteRating: w.rating,
          blackSnr: snrOf.get(b.id)!, blackName: b.name, blackFideId: b.fideId, blackRating: b.rating,
        });
      }
      games.set(rd, list);
      roundsInfo.push({ round: rd, games: list.length, played: list.filter((g) => g.result).length });
    }
    if (status === "upcoming" && offset < 6) {
      // Round 1 pairings already published.
      const list: CrGame[] = [];
      const half = Math.floor(pool.length / 2);
      for (let i = 0; i < half; i++) {
        const [w, b] = i % 2 ? [pool[i + half], pool[i]] : [pool[i], pool[i + half]];
        list.push({ match: 1, board: i + 1, result: null, whiteSnr: snrOf.get(w.id)!, whiteName: w.name, whiteFideId: w.fideId, whiteRating: w.rating, blackSnr: snrOf.get(b.id)!, blackName: b.name, blackFideId: b.fideId, blackRating: b.rating });
      }
      games.set(1, list);
      roundsInfo.push({ round: 1, games: list.length, played: 0 });
    }

    const ranked = [...pool].sort((a, b) => (score.get(b.id)! - score.get(a.id)!) || b.rating - a.rating);
    const standings: CrStanding[] = ranked.map((p, i) => ({
      snr: snrOf.get(p.id)!,
      rank: playedRounds ? i + 1 : null,
      points: playedRounds ? score.get(p.id)! : null,
      playerId: p.id,
      name: p.name,
      fideId: p.fideId,
      fed: p.fed,
      rating: p.rating,
      club: p.club,
      tiebreaks: playedRounds ? [Math.round((score.get(p.id)! * 3.4 + r() * 6) * 2) / 2, Math.round((score.get(p.id)! * 4 + r() * 8) * 2) / 2, Math.round(score.get(p.id)! * (playedRounds / 2) * 10 + r() * 20) / 10] : [null, null, null],
    }));
    if (!playedRounds) standings.sort((a, b) => a.snr - b.snr);

    const refreshedAgo = status === "ongoing" ? 2 + Math.floor(r() * 9) : status === "upcoming" ? 60 + Math.floor(r() * 300) : 60 * 24 + Math.floor(r() * 600);
    const t: CrTournament = {
      id,
      name,
      federation: "IND",
      location: loc ?? null,
      startDate: start,
      endDate: end,
      timeControl: tc,
      status,
      rounds,
      chessResultsUrl: `${BASE}tnr${id}.aspx?lan=1`,
      liveUrl: status === "ongoing" ? `${BASE}tnr${id}.aspx?lan=1&art=2&rd=${playedRounds}` : null,
      lastUpdatedAt: new Date(now - (refreshedAgo + 7) * 60000).toISOString(),
      lastRefreshedAt: new Date(now - refreshedAgo * 60000).toISOString(),
      nextRefreshAt: new Date(now + (status === "ongoing" ? 5 : 360) * 60000).toISOString(),
      discoveredVia: idx % 3 ? "federation-list" : "search",
      error: null,
    };
    return { t, standings, games, roundsInfo };
  });
}

let cache: Built[] | null = null;
const all = () => (cache ??= build());

export async function mockCrTournaments(q: CrQuery): Promise<CrPage<CrTournament>> {
  await delay();
  const needle = q.q?.trim().toLowerCase();
  let rows = all().map((b) => b.t).filter((t) => {
    if (q.status && t.status !== q.status) return false;
    if (q.fed && t.federation !== q.fed) return false;
    if (needle && ![t.name, t.location].some((x) => x?.toLowerCase().includes(needle))) return false;
    return true;
  });
  // Ongoing and upcoming soonest first; finished most recent first.
  const rank = (s: CrStatus) => (s === "ongoing" ? 0 : s === "upcoming" ? 1 : 2);
  rows = rows.sort((a, b) => rank(a.status) - rank(b.status) || (a.status === "finished" ? (b.startDate ?? "").localeCompare(a.startDate ?? "") : (a.startDate ?? "").localeCompare(b.startDate ?? "")));
  const page = q.page ?? 1, pageSize = q.pageSize ?? 24;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { total: rows.length, page, pageSize, pageCount: Math.max(1, Math.ceil(rows.length / pageSize)), source: { name: "chess-results.com", url: BASE } },
  };
}

function find(id: string) {
  const b = all().find((x) => x.t.id === id);
  if (!b) throw new ApiError(404, "Tournament not mirrored");
  return b;
}

export async function mockCrTournament(id: string): Promise<CrTournamentDetail> {
  await delay(180);
  const b = find(id);
  return { ...b.t, roundList: b.roundsInfo, standings: b.standings };
}

export async function mockCrRound(id: string, round: number): Promise<CrGame[]> {
  await delay(160);
  return find(id).games.get(round) ?? [];
}

export async function mockCrStatus(): Promise<CrMirrorStatus> {
  await delay(80);
  const ts = all().map((b) => b.t);
  const count = (s: CrStatus) => ts.filter((t) => t.status === s).length;
  const last = ts.map((t) => t.lastRefreshedAt!).sort().at(-1) ?? null;
  return {
    tournaments: ts.length, ongoing: count("ongoing"), upcoming: count("upcoming"), finished: count("finished"),
    backfilled: 6, parked: 1, players: PLAYERS.length, lastRefreshedAt: last,
    lastCycle: { startedAt: last, finishedAt: last, requests: 42, errors: 0, outcome: "ok" },
    lastArchive: null,
  };
}

export async function mockSearchPlayers(q: string): Promise<PlayerHit[]> {
  await delay(150);
  const n = q.trim().toLowerCase();
  if (n.length < 2) throw new ApiError(400, "Search needs q with at least 2 characters");
  return PLAYERS.filter((p) => p.name.toLowerCase().includes(n) || p.fideId === n)
    .slice(0, 25)
    .map(({ id, name, fed, fideId, title }) => ({ id, name, fed, fideId, title }));
}

function ratingsFor(p: MockPlayer): FideRatingPoint[] {
  if (!p.fideId || p.id % 9 === 0) return [];
  const r = rng(p.id);
  const out: FideRatingPoint[] = [];
  const today = todayIST();
  const lists: [FideRatingPoint["list"], number, number][] = [["standard", 0, 1], ["rapid", -40, 0.75], ["blitz", -70, 0.5]];
  for (const [list, bias, density] of lists) {
    if (list === "blitz" && p.id % 4 === 0) continue;
    let rating = p.rating + bias - Math.round(60 + r() * 120);
    for (let m = 23; m >= 0; m--) {
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - m);
      rating += Math.round((r() - 0.38) * 22);
      if (r() > density && m !== 0) continue;
      out.push({ list, period: d.toISOString().slice(0, 7), rating, games: Math.floor(r() * 9) });
    }
  }
  return out;
}

export async function mockPlayer(id: string): Promise<PlayerDetail> {
  await delay(180);
  const p = PLAYERS.find((x) => String(x.id) === id);
  if (!p) throw new ApiError(404, "Player not found");
  const tournaments: PlayerTournament[] = [];
  for (const b of all()) {
    const s = b.standings.find((x) => x.playerId === p.id);
    if (!s) continue;
    tournaments.push({ tournamentId: b.t.id, tournament: b.t.name, startDate: b.t.startDate, endDate: b.t.endDate, status: b.t.status, snr: s.snr, rating: s.rating, rank: s.rank, points: s.points });
  }
  tournaments.sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  return {
    id: p.id, name: p.name, fed: p.fed, fideId: p.fideId, title: p.title, sex: p.sex, inactive: false,
    fideFetchedAtMs: p.fideId ? Date.now() - 3 * 86400000 : null,
    tournaments,
    fideRatings: ratingsFor(p),
  };
}
