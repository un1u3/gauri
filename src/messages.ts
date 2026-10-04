// Turning pasted text or an imported JSON file into Message objects.
import { guessLang, isLangCode } from "./lang";
import type { Message } from "./types";

// Gauri works on what arrived recently: the inbox and the summary both cover the last WINDOW_DAYS days.
export const WINDOW_DAYS = 7;
const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number, now: Date) => dayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));

export function recent(messages: Message[], now = new Date()): Message[] {
  const from = daysAgo(WINDOW_DAYS - 1, now);
  return messages.filter((m) => m.received_at.slice(0, 10) >= from);
}

// The bundled sample has fixed dates. When it is loaded it is spread over the last WINDOW_DAYS days,
// oldest first, so it reads as this week's messages.
export function datedThisWeek(messages: Message[], now = new Date()): Message[] {
  return messages.map((m, i) => ({ ...m, received_at: daysAgo(WINDOW_DAYS - 1 - Math.floor((i * WINDOW_DAYS) / messages.length), now) }));
}

const today = () => dayString(new Date());

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
