// "What can I improve?" — match in code, let the local model choose and explain, check in code.
import type { AiConfig } from "../ai/analyse";
import { NotSureError, validated } from "../ai/guardrails";
import { chat, OllamaError } from "../ai/ollama";
import { ideasSchema, ideasSystem, ideasUser } from "../ai/prompts";
import type { Lang } from "../types";
import { gatherCandidates, type Candidate } from "./candidates";
import type { IdeasData } from "./data";
import { applyIdeaGuardrails, fallbackCards, validateChosen, type Card } from "./guardrails";
import { matchProblems, type Section } from "./match";

export type Profile = {
  rooms: number; district: string; has_wifi: boolean; smartphone_days: string;
  budget: "very_small" | "small" | "some"; host_languages: string[]; helpers: string;
};
export const DEFAULT_PROFILE: Profile = { rooms: 3, district: "Gulmi", has_wifi: false, smartphone_days: "weekends only", budget: "very_small", host_languages: ["Nepali"], helpers: "a family member on weekends" };

// "ok": the model's explanation passed the checks (per card). "fallback": model unavailable or invalid →
// original ideas only. "no_match": nothing in the library fits → ask a person.
export type IdeasResult = { status: "ok" | "fallback" | "no_match"; cards: Card[]; lang: Lang; seconds: number };

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
// The profile as short sentences. Numbers are written as words: the model is not allowed to output digits.
export function describeProfile(p: Profile): string {
  const budget = { very_small: "a very small", small: "a small", some: "some" }[p.budget];
  return [
    `She runs a farm-stay with ${NUMBER_WORDS[p.rooms] ?? "several"} guest rooms in ${p.district} district.`,
    p.has_wifi ? "She has Wi-Fi." : "She has no Wi-Fi and only occasional mobile internet.",
    `She can use a smartphone: ${p.smartphone_days}.`,
    `She has ${budget} budget.`,
    `She speaks: ${p.host_languages.join(", ")}.`,
    p.helpers ? `Help she has: ${p.helpers}.` : "She has no helpers.",
  ].join(" ");
}

const forModel = (c: Candidate) => ({
  id: c.short,
  from: c.kind === "library" ? "from a guidebook" : "drafted idea",
  text: c.idea.idea_en,
  needs: c.kind === "library" ? [c.idea.needs_internet && "internet", c.idea.needs_english && "English"].filter((x): x is string => !!x) : [],
});

// With no model at all (Ollama off, or demo mode): the original ideas, or "ask a person".
export function offlineIdeas(pointEn: string, section: Section, data: IdeasData, lang: Lang): IdeasResult {
  const candidates = gatherCandidates(matchProblems(pointEn, section, data.problems), data);
  return { status: candidates.length ? "fallback" : "no_match", cards: fallbackCards(candidates), lang, seconds: 0 };
}

export async function getIdeas(pointEn: string, section: Section, profile: Profile, cfg: AiConfig, data: IdeasData): Promise<IdeasResult> {
  const lang = cfg.ownerLang;
  const candidates = gatherCandidates(matchProblems(pointEn, section, data.problems), data);
  if (!candidates.length) return { status: "no_match", cards: [], lang, seconds: 0 }; // the model is not called
  const start = Date.now();
  const seconds = () => Math.round((Date.now() - start) / 1000);
  try {
    const chosen = await validated(() => chat(cfg.baseUrl, cfg.model, ideasSystem(describeProfile(profile), lang), ideasUser(pointEn, candidates.map(forModel)), ideasSchema(lang)), (x) => validateChosen(x, lang));
    const cards = applyIdeaGuardrails(chosen, candidates, lang);
    // The model found none that fit her situation: say so rather than push an idea.
    return cards.length ? { status: "ok", cards, lang, seconds: seconds() } : { status: "no_match", cards: [], lang, seconds: seconds() };
  } catch (e) {
    if (!(e instanceof NotSureError) && !(e instanceof OllamaError)) throw e;
    return { status: "fallback", cards: fallbackCards(candidates), lang, seconds: seconds() };
  }
}
