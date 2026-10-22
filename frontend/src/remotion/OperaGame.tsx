import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Morphy's Opera Game (Paris, 1858). Moves verified legal with chess.js: from, to, SAN. */
const MOVES: [string, string, string][] = [
  ["e2", "e4", "e4"], ["e7", "e5", "e5"], ["g1", "f3", "Nf3"], ["d7", "d6", "d6"], ["d2", "d4", "d4"], ["c8", "g4", "Bg4"],
  ["d4", "e5", "dxe5"], ["g4", "f3", "Bxf3"], ["d1", "f3", "Qxf3"], ["d6", "e5", "dxe5"], ["f1", "c4", "Bc4"], ["g8", "f6", "Nf6"],
  ["f3", "b3", "Qb3"], ["d8", "e7", "Qe7"], ["b1", "c3", "Nc3"], ["c7", "c6", "c6"], ["c1", "g5", "Bg5"], ["b7", "b5", "b5"],
  ["c3", "b5", "Nxb5"], ["c6", "b5", "cxb5"], ["c4", "b5", "Bxb5+"], ["b8", "d7", "Nbd7"], ["e1", "c1", "O-O-O"], ["a8", "d8", "Rd8"],
  ["d1", "d7", "Rxd7"], ["d8", "d7", "Rxd7"], ["h1", "d1", "Rd1"], ["e7", "e6", "Qe6"], ["b5", "d7", "Bxd7+"], ["f6", "d7", "Nxd7"],
  ["b3", "b8", "Qb8+"], ["d7", "b8", "Nxb8"], ["d1", "d8", "Rd8#"],
];

export const PLY = 24;
export const INTRO = 40;
const HOLD = 100;
export const OPERA_DURATION = INTRO + MOVES.length * PLY + HOLD;
export const OPERA_SIZE = { width: 720, height: 860 } as const;
/** A mid-game frame used as the static poster for reduced motion. */
export const OPERA_POSTER_FRAME = INTRO + 21 * PLY + PLY;

type Piece = { id: number; kind: string; white: boolean };
const BACK = ["R", "N", "B", "Q", "K", "B", "N", "R"];
const FILES = "abcdefgh";

function setup() {
  const pieces: Piece[] = [];
  const start: Record<number, string | null> = {};
  let id = 0;
  const add = (kind: string, white: boolean, sq: string) => {
    pieces.push({ id, kind, white });
    start[id++] = sq;
  };
  for (let f = 0; f < 8; f++) {
    add(BACK[f], true, `${FILES[f]}1`);
    add("P", true, `${FILES[f]}2`);
    add("P", false, `${FILES[f]}7`);
    add(BACK[f], false, `${FILES[f]}8`);
  }
  const states: Record<number, string | null>[] = [start];
  for (const [from, to] of MOVES) {
    const cur = { ...states[states.length - 1] };
    const at = (sq: string) => Number(Object.keys(cur).find((k) => cur[Number(k)] === sq) ?? -1);
    const victim = at(to);
    if (victim >= 0) cur[victim] = null;
    const mover = at(from);
    cur[mover] = to;
    const kind = pieces[mover].kind;
    if (kind === "K" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) {
      const rank = from[1];
      const long = to[0] < from[0];
      const rook = at(`${long ? "a" : "h"}${rank}`);
      cur[rook] = `${long ? "d" : "f"}${rank}`;
    }
    states.push(cur);
  }
  return { pieces, states };
}
const GAME = setup();

const SQ = 80;
const BX = 40;
const BY = 16;
const xy = (sq: string) => ({ x: BX + FILES.indexOf(sq[0]) * SQ, y: BY + (8 - Number(sq[1])) * SQ });

const C = { hall: "#14173b", light: "#cfcff2", dark: "#2b2f9e", gold: "#ffb400", ink: "#f4f3ff", muted: "#aeb1e6", red: "#ff7a86" };
const FONT = '"Bricolage Grotesque", "Arial Narrow", sans-serif';

export interface OperaProps {
  /** Real tournament counts per state, rendered in the clock strip. */
  places: { value: string; count: number }[];
  total: number;
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

export const OperaGame: React.FC<OperaProps> = ({ places, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - INTRO);
  const ply = Math.min(MOVES.length - 1, Math.floor(t / PLY));
  const local = t - ply * PLY;
  const playing = frame >= INTRO && t < MOVES.length * PLY;
  const finished = t >= MOVES.length * PLY;
  const prog = finished ? 1 : playing ? spring({ frame: local, fps, config: { damping: 18, stiffness: 140, mass: 0.7 } }) : 0;
  const before = GAME.states[finished ? MOVES.length : ply];
  const after = GAME.states[finished ? MOVES.length : ply + 1];
  const [mFrom, mTo, san] = MOVES[ply];
  const showMove = frame >= INTRO;

  // clocks: the side to move burns time
  const movesDone = finished ? MOVES.length : ply;
  const frac = finished ? 0 : local / PLY;
  const whiteUsed = Math.ceil(movesDone / 2) * 31 + (movesDone % 2 === 0 ? frac * 31 : 0);
  const blackUsed = Math.floor(movesDone / 2) * 27 + (movesDone % 2 === 1 ? frac * 27 : 0);
  const whiteToMove = movesDone % 2 === 0 && !finished;
  const blackToMove = movesDone % 2 === 1 && !finished;

  const spot = places.length ? places[Math.floor(movesDone / 4) % places.length] : null;
  const spotLocal = (t % (PLY * 4)) / (PLY * 4);
  const spotIn = interpolate(spotLocal, [0, 0.12, 0.88, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.hall, fontFamily: FONT, color: C.ink }}>
      {/* squares */}
      {Array.from({ length: 64 }, (_, i) => {
        const f = i % 8, r = Math.floor(i / 8);
        const sq = `${FILES[f]}${8 - r}`;
        const { x, y } = xy(sq);
        const lit = showMove && !finished && (sq === mFrom || sq === mTo);
        const appear = interpolate(frame, [0, 10 + (f + r) * 0.8], [0.25, 1], { extrapolateRight: "clamp" });
        return (
          <div key={sq} style={{ position: "absolute", left: x, top: y, width: SQ, height: SQ, background: (f + r) % 2 === 0 ? C.light : C.dark, opacity: appear, outline: lit ? `4px solid ${C.gold}` : "none", outlineOffset: -4 }} />
        );
      })}
      {/* coordinates */}
      {FILES.split("").map((f, i) => (
        <div key={f} style={{ position: "absolute", left: BX + i * SQ, top: BY + 8 * SQ + 6, width: SQ, textAlign: "center", fontSize: 22, color: C.muted, fontWeight: 600 }}>{f}</div>
      ))}
      {[8, 7, 6, 5, 4, 3, 2, 1].map((n, i) => (
        <div key={n} style={{ position: "absolute", left: 0, top: BY + i * SQ + 26, width: BX - 10, textAlign: "right", fontSize: 22, color: C.muted, fontWeight: 600 }}>{n}</div>
      ))}
      {/* pieces */}
      {GAME.pieces.map((p, idx) => {
        const a = before[p.id], b = after[p.id];
        if (!a) return null;
        const pa = xy(a);
        const pb = b ? xy(b) : pa;
        const moving = b !== a;
        const x = pa.x + (pb.x - pa.x) * (moving ? prog : 0);
        const y = pa.y + (pb.y - pa.y) * (moving ? prog : 0);
        const captured = !b;
        const gone = captured ? 1 - prog : 1;
        const lift = moving && b ? Math.sin(prog * Math.PI) * 10 : 0;
        const enter = spring({ frame: frame - 6 - (idx % 32) * 0.9, fps, config: { damping: 12, stiffness: 120 } });
        const d = p.kind === "P" ? 48 : 62;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute", left: x + (SQ - d) / 2, top: y + (SQ - d) / 2 - lift, width: d, height: d, borderRadius: "50%",
              background: p.white ? "#ffffff" : C.hall, color: p.white ? C.hall : C.gold,
              border: `4px solid ${p.white ? C.hall : C.gold}`, boxShadow: lift ? "0 12px 14px rgba(0,0,0,.35)" : "0 3px 0 rgba(0,0,0,.35)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: p.kind === "P" ? 0 : 32, fontWeight: 800,
              opacity: Math.max(0, gone) * Math.min(1, enter), transform: `scale(${(captured ? 0.6 + 0.4 * gone : 1) * Math.min(1, 0.4 + 0.6 * enter)})`,
              zIndex: moving ? 5 : 1,
            }}
          >
            {p.kind === "P" ? null : p.kind}
          </div>
        );
      })}

      {/* clock strip */}
      <div style={{ position: "absolute", left: BX, right: BX, top: 706, height: 134, display: "flex", gap: 16 }}>
        <Clock label="White" time={fmtClock(900 - whiteUsed)} active={whiteToMove} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: C.gold, height: 42 }}>
            {showMove ? `${Math.floor(ply / 2) + 1}${ply % 2 ? "..." : "."} ${san}` : "Round 1"}
          </div>
          <div style={{ marginTop: 6, opacity: spotIn, transform: `translateY(${(1 - spotIn) * 10}px)`, fontSize: 26, fontWeight: 600, whiteSpace: "nowrap" }}>
            {spot ? `${spot.value}: ${spot.count}` : `${total} events`}
          </div>
        </div>
        <Clock label="Black" time={fmtClock(900 - blackUsed)} active={blackToMove} />
      </div>
    </AbsoluteFill>
  );
};

const Clock: React.FC<{ label: string; time: string; active: boolean }> = ({ label, time, active }) => (
  <div style={{ width: 180, borderRadius: 14, background: active ? C.gold : "#1e2260", color: active ? C.hall : C.muted, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: `3px solid ${active ? C.gold : "#2b3070"}` }}>
    <div style={{ fontSize: 20, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 50, fontWeight: 800, fontStretch: "100%", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{time}</div>
  </div>
);
