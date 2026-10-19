// Which steps the player does on this phone (a mini-game or the scan). The wording of every step comes from the API.
import type { Step } from "@/lib/th/types";

export const WEB_STEPS: ReadonlySet<Step> = new Set<Step>(["unlock", "mg1_signal", "mg1_photo", "scan", "mg2_cipher", "mg2_game"]);
