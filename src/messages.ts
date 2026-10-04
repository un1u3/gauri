// Turning pasted text or an imported JSON file into Message objects.
import { guessLang, isLangCode } from "./lang";
import type { Message } from "./types";

const today = () => new Date().toISOString().slice(0, 10);

function freshId(taken: Set<string>): string {
  let n = taken.size + 1;
  while (taken.has(`g${n}`)) n++;
  taken.add(`g${n}`);
  return `g${n}`;
}

// One message per non-empty line.
export function fromPaste(text: string, existing: Message[]): Message[] {
  const taken = new Set(existing.map((m) => m.id));
  return text.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => ({ id: freshId(taken), text: l, lang: guessLang(l), received_at: today(), contact: null, synthetic: false }));
}

// Accepts a Message[] file; items without text are skipped, missing fields get defaults.
export function fromJson(json: unknown, existing: Message[]): Message[] {
  if (!Array.isArray(json)) throw new Error("not a list");
  const taken = new Set(existing.map((m) => m.id));
  return json.filter((x) => x && typeof x.text === "string" && x.text.trim()).map((x) => {
    const id = typeof x.id === "string" && x.id && !taken.has(x.id) ? x.id : freshId(taken);
    taken.add(id);
    return {
      id, text: x.text.trim(),
      lang: isLangCode(x.lang) ? x.lang : guessLang(x.text), // any language code is kept
      received_at: typeof x.received_at === "string" ? x.received_at : today(),
      contact: typeof x.contact === "string" && x.contact ? x.contact : null,
      synthetic: x.synthetic === true,
    };
  });
}
