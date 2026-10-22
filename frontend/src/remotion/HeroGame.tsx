import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Levon Aronian vs Viswanathan Anand, Tata Steel (Wijk aan Zee) 2013, round 4, 0–1.
 * Every move below was replayed and checked legal with chess.js 1.4.0: [from, to, SAN].
 */
const MOVES: [string, string, string][] = [
  ["d2", "d4", "d4"], ["d7", "d5", "d5"], ["c2", "c4", "c4"], ["c7", "c6", "c6"], ["g1", "f3", "Nf3"], ["g8", "f6", "Nf6"],
  ["b1", "c3", "Nc3"], ["e7", "e6", "e6"], ["e2", "e3", "e3"], ["b8", "d7", "Nbd7"], ["f1", "d3", "Bd3"], ["d5", "c4", "dxc4"],
  ["d3", "c4", "Bxc4"], ["b7", "b5", "b5"], ["c4", "d3", "Bd3"], ["f8", "d6", "Bd6"], ["e1", "g1", "O-O"], ["e8", "g8", "O-O"],
  ["d1", "c2", "Qc2"], ["c8", "b7", "Bb7"], ["a2", "a3", "a3"], ["a8", "c8", "Rc8"], ["f3", "g5", "Ng5"], ["c6", "c5", "c5"],
  ["g5", "h7", "Nxh7"], ["f6", "g4", "Ng4"], ["f2", "f4", "f4"], ["c5", "d4", "cxd4"], ["e3", "d4", "exd4"], ["d6", "c5", "Bc5"],
  ["d3", "e2", "Be2"], ["d7", "e5", "Nde5"], ["e2", "g4", "Bxg4"], ["c5", "d4", "Bxd4+"], ["g1", "h1", "Kh1"], ["e5", "g4", "Nxg4"],
  ["h7", "f8", "Nxf8"], ["f7", "f5", "f5"], ["f8", "g6", "Ng6"], ["d8", "f6", "Qf6"], ["h2", "h3", "h3"], ["f6", "g6", "Qxg6"],
  ["c2", "e2", "Qe2"], ["g6", "h5", "Qh5"], ["e2", "d3", "Qd3"], ["d4", "e3", "Be3"],
];

export const PLY = 30;
export const INTRO = 36;
const HOLD = 150;
const GLIDE = 16;
export const GAME_DURATION = INTRO + MOVES.length * PLY + HOLD;
export const GAME_SIZE = { width: 720, height: 800 } as const;
/** The final position, used as the still for reduced motion. */
export const GAME_POSTER_FRAME = INTRO + MOVES.length * PLY + 20;

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
    if (pieces[mover].kind === "K" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) {
      const rank = from[1];
      const long = to[0] < from[0];
      cur[at(`${long ? "a" : "h"}${rank}`)] = `${long ? "d" : "f"}${rank}`;
    }
    states.push(cur);
  }
  return { pieces, states };
}
const GAME = setup();

const SQ = 90;
const BOARD = SQ * 8;
const xy = (sq: string) => ({ x: FILES.indexOf(sq[0]) * SQ, y: (8 - Number(sq[1])) * SQ });
const isLight = (sq: string) => (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1;

export const HeroGame: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - INTRO;
  const done = t >= MOVES.length * PLY;
  const ply = t < 0 ? -1 : Math.min(MOVES.length - 1, Math.floor(t / PLY));
  const local = ply < 0 ? 0 : t - ply * PLY;
  const prog = done ? 1 : ply < 0 ? 0 : spring({ frame: local, fps, durationInFrames: GLIDE, config: { damping: 200 } });
  const before = GAME.states[ply < 0 ? 0 : done ? MOVES.length : ply];
  const after = GAME.states[ply < 0 ? 0 : done ? MOVES.length : ply + 1];
  const last = ply >= 0 ? MOVES[done ? MOVES.length - 1 : ply] : null;
  const intro = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "var(--surface)", fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif", color: "var(--fg)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: BOARD, height: BOARD }}>
        {Array.from({ length: 64 }, (_, i) => {
          const sq = `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
          const { x, y } = xy(sq);
          const light = isLight(sq);
          const hl = last && (sq === last[0] || sq === last[1]);
          const coord = { position: "absolute", fontSize: 20, fontWeight: 600, color: light ? "var(--board-dark)" : "var(--board-light)" } as const;
          return (
            <div key={sq} style={{ position: "absolute", left: x, top: y, width: SQ, height: SQ, background: light ? "var(--board-light)" : "var(--board-dark)" }}>
              {hl && <div style={{ position: "absolute", inset: 0, background: "var(--board-hl)" }} />}
              {sq[1] === "1" && <span style={{ ...coord, right: 6, bottom: 2 }}>{sq[0]}</span>}
              {sq[0] === "a" && <span style={{ ...coord, left: 6, top: 3 }}>{sq[1]}</span>}
            </div>
          );
        })}
        {GAME.pieces.map((p) => {
          const a = before[p.id];
          const b = after[p.id];
          if (!a) return null;
          const pa = xy(a);
          const pb = b ? xy(b) : pa;
          const moving = !!b && b !== a;
          const x = pa.x + (pb.x - pa.x) * (moving ? prog : 0);
          const y = pa.y + (pb.y - pa.y) * (moving ? prog : 0);
          const lift = moving ? Math.sin(prog * Math.PI) * 6 : 0;
          const captured = !b;
          const fade = captured ? interpolate(prog, [0.45, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
          const scale = captured ? 0.85 + 0.15 * fade : 1 + lift / 200;
          return (
            <img
              key={p.id}
              src={`/pieces/cburnett/${p.white ? "w" : "b"}${p.kind}.svg`}
              alt=""
              draggable={false}
              style={{
                position: "absolute", left: x, top: y - lift, width: SQ, height: SQ, opacity: fade * intro,
                transform: `scale(${scale})`, zIndex: moving ? 5 : 1,
                filter: lift > 1 ? `drop-shadow(0 ${4 + lift}px ${4 + lift}px rgb(0 0 0 / 0.25))` : "drop-shadow(0 1px 1px rgb(0 0 0 / 0.18))",
              }}
            />
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: BOARD, bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22, lineHeight: 1.25 }}>
          <div style={{ fontWeight: 500 }}>Aronian – Anand</div>
          <div style={{ color: "var(--fg-muted)", fontSize: 19 }}>Wijk aan Zee, 2013</div>
        </div>
        <div style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 26, fontWeight: 500, textAlign: "right" }}>
          {done ? (
            <span>0–1 <span style={{ color: "var(--fg-muted)", fontSize: 20, fontFamily: "Geist, ui-sans-serif, sans-serif" }}>White resigns</span></span>
          ) : last ? (
            <span>
              <span style={{ color: "var(--fg-muted)" }}>{Math.floor(ply / 2) + 1}{ply % 2 ? "…" : "."}</span> {last[2]}
            </span>
          ) : (
            <span style={{ color: "var(--fg-muted)" }}>Semi-Slav</span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
