// Everything the app knows lives in this one localStorage entry on the device (hard rule 7).
import { DEFAULT_MIN_MESSAGES } from "./ai/guardrails";
import { DEFAULT_MODEL } from "./ai/prompts";
import type { Analysis, Draft, Lang, Message } from "./types";

// ownerLang: the language the owner reads (any language). ui: show the app in that language, or in English for judges.
export type Settings = { demo: boolean; model: string; minMessages: number; textSize: "normal" | "large" | "xlarge"; ui: "own" | "en"; ownerLang: Lang };
// packs: the app's labels in other languages, translated on this device and kept here.
export type State = { messages: Message[]; analysis: Analysis | null; drafts: Draft[]; settings: Settings; packs: Record<string, Record<string, string>> };

const KEY = "gauri.v2";
const defaults = (): State => ({
  messages: [], analysis: null, drafts: [], packs: {},
  settings: { demo: false, model: DEFAULT_MODEL, minMessages: DEFAULT_MIN_MESSAGES, textSize: "normal", ui: "own", ownerLang: "ne" },
});

export function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return saved ? { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings } } : defaults();
  } catch {
    return defaults();
  }
}

export function save(state: State): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAll(): State {
  localStorage.removeItem(KEY);
  return defaults();
}
