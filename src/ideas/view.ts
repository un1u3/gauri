// What an idea card shows. Kept apart from the DOM so the source-label rules can be tested.
import type { Lang } from "../types";
import type { Card } from "./guardrails";

export type CardView = {
  kind: "library" | "drafted";
  how?: string; first_step?: string;            // model text, only if it passed the guardrails
  original: string; originalLang: Lang;         // the idea as written in the data file
  source?: string; quotes: string[];            // library only: "<title>, <page>" and the exact words
  needsInternet: boolean; needsEnglish: boolean;
  pending: boolean;                             // not yet checked by a person
};

export function cardView(card: Card, owner: Lang): CardView {
  const c = card.candidate;
  const base = { how: card.how, first_step: card.first_step, pending: c.idea.review.status === "pending" };
  if (c.kind === "library")
    return { ...base, kind: "library", original: c.idea.idea_en, originalLang: "en", source: `${c.idea.source_title}, ${c.idea.page}`,
      quotes: [c.idea.quote, ...(c.idea.quote_2 ? [c.idea.quote_2] : [])], needsInternet: c.idea.needs_internet, needsEnglish: c.idea.needs_english };
  const nepali = owner === "ne" && c.idea.idea_ne;
  return { ...base, kind: "drafted", original: nepali || c.idea.idea_en, originalLang: nepali ? "ne" : "en", quotes: [], needsInternet: false, needsEnglish: false };
}
