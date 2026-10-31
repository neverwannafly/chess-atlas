// Mirrored chess-results.com and FIDE data (see /api/chessresults/* and /api/players/*).

export type CrStatus = "ongoing" | "upcoming" | "finished";

export interface CrSource {
  name: string;
  url: string;
}

export interface CrTournament {
  id: string;
  name: string;
  federation: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  timeControl: string | null;
  status: CrStatus;
  rounds: number | null;
  /** Highest round with stored pairings; null before the first pairing is published. */
  currentRound?: number | null;
  chessResultsUrl: string;
  /** Set only while the tournament is ongoing. */
  liveUrl: string | null;
  lastUpdatedAt: string | null;
  lastRefreshedAt: string | null;
  nextRefreshAt: string | null;
  discoveredVia: string;
  error: string | null;
}

export interface CrStanding {
  snr: number;
  rank: number | null;
  points: number | null;
  playerId: number;
  name: string;
  fideId: string | null;
  fed: string;
  rating: number | null;
  club: string | null;
  tiebreaks: (number | null)[];
  /** FIDE title when the player is linked to a FIDE profile. */
  title?: string | null;
}

export interface CrRoundInfo {
  round: number;
  games: number;
  played: number;
}

/** Detail adds the per-round progress as `roundList`; `rounds` stays the scheduled round count. */
export type CrTournamentDetail = CrTournament & {
  roundList: CrRoundInfo[];
  standings: CrStanding[];
};

export type CrResult = "1-0" | "0-1" | "½-½" | "+-" | "-+" | "0-0" | null;

export interface CrGame {
  match: number;
  board: number;
  result: CrResult;
  whiteSnr: number | null;
  whiteName: string | null;
  whiteFideId: string | null;
  whiteRating: number | null;
  blackSnr: number | null;
  blackName: string | null;
  blackFideId: string | null;
  blackRating: number | null;
}

export interface CrPage<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number; source?: CrSource };
}

export interface PlayerHit {
  id: number;
  name: string;
  fed: string;
  fideId: string | null;
  title: string | null;
}

export type RatingList = "standard" | "rapid" | "blitz";

export interface PlayerTournament {
  tournamentId: string;
  tournament: string;
  startDate: string | null;
  endDate: string | null;
  status: CrStatus;
  snr: number | null;
  rating: number | null;
  rank: number | null;
  points: number | null;
}

export interface FideRatingPoint {
  list: RatingList;
  period: string;
  rating: number;
  games: number | null;
}

export interface PlayerDetail extends PlayerHit {
  sex: string | null;
  inactive: boolean | null;
  fideFetchedAtMs: number | null;
  tournaments: PlayerTournament[];
  fideRatings: FideRatingPoint[];
}

export interface CrMirrorStatus {
  tournaments: number;
  ongoing: number;
  upcoming: number;
  finished: number;
  backfilled: number;
  parked: number;
  players: number;
  lastRefreshedAt: string | null;
  lastCycle: { startedAt: string | null; finishedAt: string | null; requests: number; errors: number; outcome: string } | null;
  lastArchive: { startedAt: string | null; outcome: string; detail: string | null } | null;
}
