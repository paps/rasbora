/**
 * Which of a headword's two written forms the app shows.
 *
 * A Pleco card carries both — `hw` is simplified, `althw` traditional — and a
 * learner reads one of them, not whichever the export happened to put first.
 * The choice is therefore app-wide, like the selected profile: a card shown in
 * a table and the same card opened in a drawer have to agree, and a page that
 * forgot to ask would quietly render the other script.
 *
 * It lives here rather than in `src/database/` because it is not a fact about
 * the export. It outlives every import, means the same thing before one has
 * happened, and no query reads it.
 */

import { createContext, use } from "react";

/**
 * The written form to render.
 *
 * The two values are deliberately the names of the `Syllable` fields that hold
 * characters, so a caller writes `syllable[script]` and cannot pick the wrong
 * field for the current script.
 */
export type Script = "simplified" | "traditional";

/** The written form a card's *other* line shows, opposite the one selected. */
export const otherScript = (script: Script): Script =>
  script === "simplified" ? "traditional" : "simplified";

export interface ScriptContextValue {
  /** The written form every card display renders. */
  script: Script;
  setScript: (script: Script) => void;
}

export const ScriptContext = createContext<ScriptContextValue | null>(null);

export const useScript = (): ScriptContextValue => {
  const value = use(ScriptContext);

  if (!value) {
    throw new Error("useScript must be used inside a <ScriptProvider>");
  }

  return value;
};
