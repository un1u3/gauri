// Translates the app's own labels into the owner's language with the local model, once,
// so the app is usable in any language without shipping hand-written text for each.
// Every label is checked; one that fails stays in English rather than showing a bad translation.
import { ENGLISH, KEYS, type Key } from "../i18n";
import { writtenIn } from "../lang";
import type { AiConfig } from "./analyse";
import { NotSureError, validated } from "./guardrails";
import { chat } from "./ollama";
import { uiSchema, uiSystem, uiUser } from "./prompts";

const BATCH = 16;
const placeholders = (s: string) => (s.match(/\{\d\}/g) ?? []).sort().join();

// A translated label must be non-empty, keep its {0} placeholders, and use the language's script.
export function labelOk(source: string, out: unknown, lang: string): out is string {
  return typeof out === "string" && out.trim().length > 0 && placeholders(out) === placeholders(source) && writtenIn(out, lang);
}

export async function translateLabels(cfg: AiConfig, onProgress: (done: number, total: number) => void): Promise<Partial<Record<Key, string>>> {
  const lang = cfg.ownerLang;
  const pack: Partial<Record<Key, string>> = {};
  for (let i = 0; i < KEYS.length; i += BATCH) {
    onProgress(i, KEYS.length);
    const keys = KEYS.slice(i, i + BATCH);
    const labels = Object.fromEntries(keys.map((k) => [k, ENGLISH[k]]));
    try {
      const out = await validated(() => chat(cfg.baseUrl, cfg.model, uiSystem(lang), uiUser(labels), uiSchema(keys)), (x: any) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null));
      for (const k of keys) if (labelOk(ENGLISH[k], out[k], lang)) pack[k] = (out[k] as string).trim();
    } catch (e) {
      if (!(e instanceof NotSureError)) throw e; // this batch stays in English
    }
  }
  onProgress(KEYS.length, KEYS.length);
  return pack;
}
