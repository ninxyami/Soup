// DEV ONLY: placeholder wording the dev mock sends as `text` in /me, so every text slot of every screen can be seen.
// Imported only by lib/th/mock.ts, which the production build never bundles. On purpose this holds no real story
// (the repo may be public): the real wording lives with the bot and arrives from the API.
import type { Step, StepText } from "./types";

const ACT: Partial<Record<Step, string>> = {
  linking: "Act 1", call: "Act 1", unlock: "Act 2", mg1_signal: "Act 2", mg1_photo: "Act 2", go_loc2: "Act 2",
  arrange: "Act 3", scan: "Act 3", code_horde: "Act 3", mg2_cipher: "Act 4", mg2_game: "Act 4",
  go_final: "Act 5", finale: "Act 5", lastcall: "Act 5",
};

export function mockText(step: Step, mg2: "vial" | "wiring", prize: string): StepText {
  const name = step === "mg2_game" ? `${step} (${mg2})` : step;
  const travel = step === "go_loc2" || step === "go_final";
  return {
    act: ACT[step] ?? "",
    title: `[mock] ${name}`,
    next: `[mock] The next-step line for ${name}, as the API sends it.`,
    sub: `[mock] The smaller line under it for ${name}.`,
    hint: travel ? { text: `[mock] A hint line for ${step}. With hint.img the API can add a picture.` } : null,
    quote: step === "go_final" ? { text: "[mock] A quote shown above the picture.", by: "[mock] who said it" } : null,
    buzz: step === "go_final" ? { title: "[mock] The buzz line, shown while me.buzz is true.", sub: "[mock] The line under it." } : null,
    flavor: step === "mg1_signal" ? "[mock] a line that fades in near the signal" : undefined,
    intro: { title: "[mock] Start screen title", text: "[mock] Start screen text, from text.intro." },
    end: step === "done" || step === "broken"
      ? { title: "[mock] End title", text: "[mock] End text, from text.end.", prize: prize ? `[mock] Prize line for "${prize}".` : "" }
      : null,
    carrier: "MOCK",
  };
}
