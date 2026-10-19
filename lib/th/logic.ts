// Event puzzle rules, shared by the game components (to show a solved board) and the dev mock (to check it).
// These are the conventions written in the shared notes (web_puzzle_conventions.md). The API is the real judge.

// ── Torn photo (slide puzzle) ───────────────────────────────────────────────────────────────────────────────────────
// tiles[pos] = piece at board position pos; piece size*size-1 is the blank. A move = the board position slid into the blank.
export function photoBlank(tiles: number[]) {
  return tiles.indexOf(tiles.length - 1);
}

export function photoCanSlide(tiles: number[], size: number, pos: number) {
  const b = photoBlank(tiles);
  const br = Math.floor(b / size), bc = b % size, r = Math.floor(pos / size), c = pos % size;
  return Math.abs(br - r) + Math.abs(bc - c) === 1;
}

export function photoSlide(tiles: number[], pos: number) {
  const b = photoBlank(tiles);
  const next = tiles.slice();
  next[b] = tiles[pos];
  next[pos] = tiles[b];
  return next;
}

export function photoSolved(tiles: number[]) {
  return tiles.every((p, i) => p === i);
}

// ── Vial sort ───────────────────────────────────────────────────────────────────────────────────────────────────────
// Each vial is bottom first. A pour moves the whole same-colour run on top of `from`, as much as fits in `to`.
export function vialCanPour(vials: string[][], cap: number, from: number, to: number) {
  if (from === to) return false;
  const a = vials[from], b = vials[to];
  if (!a || !b || !a.length || b.length >= cap) return false;
  return !b.length || b[b.length - 1] === a[a.length - 1];
}

export function vialPour(vials: string[][], cap: number, from: number, to: number) {
  const next = vials.map(v => v.slice());
  const a = next[from], b = next[to];
  const colour = a[a.length - 1];
  while (a.length && a[a.length - 1] === colour && b.length < cap) b.push(a.pop() as string);
  return next;
}

export function vialSolved(vials: string[][], cap: number) {
  return vials.every(v => !v.length || (v.length === cap && v.every(c => c === v[0])));
}

// ── Lab wiring ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Openings as bits N=1 E=2 S=4 W=8 at rotation 0; each rotation turns the tile 90 degrees clockwise.
export const N = 1, E = 2, S = 4, W = 8;
const BASE: Record<string, number> = { I: N | S, L: N | E, T: N | E | S, X: N | E | S | W, E: N };

export function wireOpenings(type: string, rot: number) {
  let m = BASE[type] ?? 0;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

// Every tile reached from src through matching openings (index set). Solved when dst is in it.
export function wirePowered(types: string[], rots: number[], w: number, h: number, src: [number, number]) {
  const seen = new Set<number>();
  const start = src[1] * w + src[0];
  const stack = [start];
  seen.add(start);
  const dirs: [number, number, number, number][] = [[N, S, 0, -1], [E, W, 1, 0], [S, N, 0, 1], [W, E, -1, 0]];
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w, y = Math.floor(i / w);
    const m = wireOpenings(types[i], rots[i]);
    for (const [d, back, dx, dy] of dirs) {
      if (!(m & d)) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen.has(j) || !(wireOpenings(types[j], rots[j]) & back)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen;
}

// ── Pattern unlock ──────────────────────────────────────────────────────────────────────────────────────────────────
export function patternValid(p: string) {
  return /^[1-9]{4,6}$/.test(p) && new Set(p).size === p.length;
}
