// Step 4: checks applied in code to the model's explanation of an idea before anything is shown.
// The model may only choose from the candidates and reword them; it may not add numbers, money,
// or legal / medical claims. Text that breaks a rule is never shown: the card falls back to the original idea.
import { ownKey } from "../ai/guardrails";
import { writtenIn } from "../lang";
import type { Lang } from "../types";
import type { Candidate } from "./candidates";

export const MAX_IDEAS = 3;
export const HOW_WORDS = 40;
export const STEP_WORDS = 15;

export type Chosen = { candidate_id: string; how: string; first_step: string };
// A card always carries its original idea and source; `how` / `first_step` are present only if they passed every check.
export type Card = { candidate: Candidate; how?: string; first_step?: string };

const DIGIT = /\p{Nd}/u; // ASCII, Devanagari and every other script's digits
// Devanagari words are matched as whole words (with a case ending), so "कर" (tax) does not hit "करेसाबारी".
const NE = (w: string) => `(?<![\\u0900-\\u097F])${w}(को|का|की|मा|ले|लाई|हरू)?(?![\\u0900-\\u097F])`;
const MONEY = new RegExp(`\\b(rs|rupees?|prices?|costs?)\\b|[$₹]|${NE("रु")}|रुपैयाँ|रुपियाँ|मूल्य|शुल्क`, "i");
const BANNED = new RegExp(`\\b(licen[sc]es?|tax(es)?|laws?|legal|medicines?|doctors?|guarantees?)\\b|कानून|कानुन|लाइसेन्स|${NE("कर")}|औषधि|औषधी|डाक्टर|ग्यारेन्टी`, "i");

export function breaksRules(text: string): "digit" | "money" | "banned" | null {
  return DIGIT.test(text) ? "digit" : MONEY.test(text) ? "money" : BANNED.test(text) ? "banned" : null;
}

// Keeps whole sentences up to the word limit. Returns null if not even the first sentence fits.
export function trimToSentences(text: string, maxWords: number): string | null {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.split(" ").length <= maxWords) return clean;
  let kept = "";
  for (const sentence of clean.match(/[^।.!?]+[।.!?]+/g) ?? []) {
    if ((kept + sentence).trim().split(" ").length > maxWords) break;
    kept += sentence;
  }
  return kept.trim() || null;
}

// Schema check for the model's reply (owner reads `lang`): {"chosen": [{candidate_id, how_<lang>, first_step_<lang>}]}.
export function validateChosen(x: any, lang: Lang): Chosen[] | null {
  if (!x || !Array.isArray(x.chosen)) return null;
  const hk = ownKey("how", lang), sk = ownKey("first_step", lang);
  if (!x.chosen.every((c: any) => c && typeof c.candidate_id === "string" && typeof c[hk] === "string" && typeof c[sk] === "string")) return null;
  return x.chosen.map((c: any) => ({ candidate_id: c.candidate_id.trim().replace(/^\[|\]$/g, ""), how: c[hk], first_step: c[sk] }));
}

export function applyIdeaGuardrails(chosen: Chosen[], candidates: Candidate[], lang: Lang): Card[] {
  const cards: Card[] = [];
  for (const c of chosen) {
    const candidate = candidates.find((k) => k.short === c.candidate_id);
    if (!candidate || cards.some((k) => k.candidate === candidate)) continue; // invented or repeated id
    const how = trimToSentences(c.how, HOW_WORDS), first_step = trimToSentences(c.first_step, STEP_WORDS);
    const ok = how && first_step && [how, first_step].every((t) => !breaksRules(t) && writtenIn(t, lang));
    cards.push(ok ? { candidate, how, first_step } : { candidate });
    if (cards.length === MAX_IDEAS) break;
  }
  return cards;
}

// Step 5 fallback: the original ideas, with no model text at all.
export const fallbackCards = (candidates: Candidate[]): Card[] => candidates.slice(0, MAX_IDEAS).map((candidate) => ({ candidate }));
