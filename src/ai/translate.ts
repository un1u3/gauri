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

// Translates the labels that `have` does not contain yet. Each finished batch is handed to `onBatch`
// at once, so a failure part-way (the model stopping, the phone running out of memory) loses nothing.
// A label that fails its check is recorded as "" (shown in English) so that it is not tried again and again.
export async function translateLabels(cfg: AiConfig, have: Partial<Record<Key, string>>, onBatch: (done: Partial<Record<Key, string>>, left: number) => void): Promise<void> {
  const lang = cfg.ownerLang;
  const todo = KEYS.filter((k) => !(k in have));
  for (let i = 0; i < todo.length; i += BATCH) {
    const keys = todo.slice(i, i + BATCH);
    const labels = Object.fromEntries(keys.map((k) => [k, ENGLISH[k]]));
    const done: Partial<Record<Key, string>> = {};
    try {
      const out = await validated(() => chat(cfg.baseUrl, cfg.model, uiSystem(lang), uiUser(labels), uiSchema(keys)), (x: any) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null));
      for (const k of keys) done[k] = labelOk(ENGLISH[k], out[k], lang) ? (out[k] as string).trim() : "";
    } catch (e) {
      if (!(e instanceof NotSureError)) throw e; // the model is not reachable: stop here, keep what is done
      for (const k of keys) done[k] = "";
    }
    onBatch(done, todo.length - i - keys.length);
  }
}
