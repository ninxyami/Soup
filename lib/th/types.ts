// Event phone (/p), 2026-10-19. Shapes from the event contract (PC kit docs).
// The API builds and checks every puzzle and sends every story line; the website only renders `puzzle` and `text`
// and sends the payloads. No story text lives in this code: the site is public.

export type Step =
  | "linking" | "call" | "unlock" | "mg1_signal" | "mg1_photo" | "go_loc2" | "arrange" | "scan" | "code_horde"
  | "mg2_cipher" | "mg2_game" | "go_final" | "finale" | "lastcall" | "done" | "broken";

export interface PatternP { game: "pattern"; grid: number; tries_left: number; wait_until: number }
export interface SignalP { game: "signal"; min: number; max: number; target: number }
export interface PhotoP { game: "photo"; img: string; size: number; tiles: number[] }
export interface SketchTile { type: string; name: string }
export interface SketchP { game: "sketch"; img: string; tiles: Record<string, SketchTile> }
export interface ScanP { game: "scan"; img?: string; tiles?: Record<string, SketchTile> } // th-bot adds the sketch
export interface CipherP { game: "cipher"; len: number; wait_until: number; letters?: string; shift?: number }
export interface VialP {
  game: "vial"; vials: string[][]; cap: number; move_limit: number; time_s: number; started: number; attempt: number;
}
export interface WiringP {
  game: "wiring"; w: number; h: number; tiles: [string, number][]; src: [number, number]; dst: [number, number];
  time_s: number; started: number; attempt: number;
}
export interface WaitP { game: "wait"; key: string; img?: string } // img: a location picture for this step

export type Puzzle = PatternP | SignalP | PhotoP | SketchP | ScanP | CipherP | VialP | WiringP | WaitP;

export interface Me {
  step: Step; since: number; team_size: number; members_here: number; fails: number; fail_cap: number;
  broken: boolean; prize: string; test: boolean; puzzle: Puzzle | null;
  stale?: boolean; // the game's snapshot is older than 30 s (the game isn't answering)
  buzz?: boolean;  // the team is at the special spot: show text.buzz and buzz the phone
  text?: StepText | null; // every word the player reads for this step, from the API
  now?: number; // optional server clock (epoch s), see CONTRACT_CHANGES.md; falls back to this device's clock
}

export interface StepText {
  act?: string; title?: string; next?: string; sub?: string;
  hint?: { text: string; img?: string } | null;
  quote?: { text: string; by?: string } | null;
  buzz?: { title: string; sub?: string } | null;
  flavor?: string;
  intro?: { title?: string; text?: string } | null;
  end?: { title?: string; text?: string; prize?: string } | null;
  carrier?: string;
}

export type ActAction = "solve" | "scan" | "fail";

// result: {done:false,pending:true} while the game hasn't answered, then {done:true,ok,msg,at}
export interface ActResult { id?: string; ok?: boolean; msg?: string; at?: number; pending?: boolean; done?: boolean; attempt?: number }

// What every game component gets from the page
export interface GameProps<P> {
  puzzle: P;
  busy: boolean;                                   // a tap is syncing with the game
  serverNow: () => number;                         // epoch seconds on the server clock
  onSolve: (payload: Record<string, unknown>) => Promise<boolean>;
  onFail?: (payload: Record<string, unknown>) => Promise<boolean>;
  error: string;
}
