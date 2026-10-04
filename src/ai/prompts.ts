// All prompt text and model options live here. The inner improvement loop (LOOP_LOG.md)
// only ever changes this file.
//
// Nothing is tied to one language: the owner's language and the guests' languages are
// filled in. For a Nepali owner and the five evaluated guest languages the text is
// byte-identical to the prompt that produced EVAL.md (tests/prompts.test.ts checks this).
import { langName, scriptHint, UNKNOWN } from "../lang";
import { EVAL_LANGS, type Lang, type Message } from "../types";
import { ownKey } from "./guardrails";

export const DEFAULT_MODEL = "gemma4:e2b";
// temperature 0 + fixed seed so two runs are comparable; num_ctx fits ~40 short messages
// plus the answer on a 6 GB laptop.
export const MODEL_OPTIONS = { temperature: 0, seed: 7, num_ctx: 8192 };

const english = (lang: Lang) => langName(lang, "en");
// "Nepali in Devanagari script", "Arabic in Arabic script", "French".
const written = (lang: Lang) => `${english(lang)}${scriptHint(lang)}`;
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]);

// Guest languages in a stable order: the evaluated five first, then the rest alphabetically.
function guestLanguages(messages: Message[]): string {
  const present = [...new Set(messages.map((m) => m.lang))].filter((l) => l !== UNKNOWN);
  const ordered = [...EVAL_LANGS.filter((l) => present.includes(l)), ...present.filter((l) => !EVAL_LANGS.includes(l)).sort()];
  return ordered.length ? `The messages are in ${list(ordered.map(english))}.` : "The messages may be in any language.";
}

export function analysisSystem(messages: Message[], owner: Lang): string {
  const own = owner === "en" ? "" : ` and in short, simple ${written(owner)} ("${ownKey("point", owner)}")`;
  const note = owner === "en" ? `"note_en" in English` : `"note_en" in English, "${ownKey("note", owner)}" in ${written(owner)}`;
  return `You help a small farm-stay owner in Nepal understand her guests' feedback.
${guestLanguages(messages)} Each line is: [id] (language) text.

Rules:
- Use only what is written in the messages. Do not add facts.
- "loved": things guests liked. "wished": things guests wished were different.
- "upgrade": at most one suggestion for the owner, based on what several guests wished for.
- For every point, list in "message_ids" the ids of ALL messages that support it, in every language. A point often has 5 to 10 supporting messages. Before you finish a point, check every message again, one by one, and add each id that says the same thing.
- Write each point in short, simple English ("point_en")${own}, for someone with basic reading skills.
- If something is mentioned by only one guest, or is unclear or contradictory, put it in "uncertain" (${note}), not in the points.
- Ignore messages that are only greetings, thanks or travel news.
- Output JSON only.`;
}

export function analysisUser(messages: Message[]): string {
  return messages.map((m) => `[${m.id}] (${m.lang}) ${m.text.replace(/\s+/g, " ").trim()}`).join("\n");
}

const strings = (keys: string[]) => ({ type: "object", properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])), required: keys });

export function analysisSchema(owner: Lang) {
  const pointKeys = [...new Set(["point_en", ownKey("point", owner)])];
  const point = { type: "object", properties: { ...strings(pointKeys).properties, message_ids: { type: "array", items: { type: "string" } } }, required: [...pointKeys, "message_ids"] };
  return {
    type: "object",
    properties: {
      loved: { type: "array", items: point },
      wished: { type: "array", items: point },
      upgrade: { type: "array", items: point, maxItems: 1 },
      uncertain: { type: "array", items: strings([...new Set(["note_en", ownKey("note", owner)])]) },
    },
    required: ["loved", "wished", "upgrade", "uncertain"],
  };
}

export function draftSystem(owner: Lang): string {
  return `You help a small farm-stay owner in Nepal reply to a guest.
Write a short, warm thank-you message in the guest's language, in two natural sentences: first thank them for visiting, then say you hope they visit again and tell their friends about the farm.
Do not mention prices, discounts, dates or promises. Do not add facts that are not in the guest's message.
Return JSON: "text" is the reply in the guest's language; "${ownKey("text", owner)}" is the same reply in short, simple ${english(owner)}${scriptHint(owner) && ` written${scriptHint(owner)}`}.`;
}

export function draftUser(m: Message): string {
  return `Guest's language: ${m.lang === UNKNOWN ? "the same language as the guest's message" : english(m.lang)}\nGuest's message: ${m.text}`;
}

export const draftSchema = (owner: Lang) => strings(["text", ownKey("text", owner)]);

// ---- "What can I improve?": choosing among given ideas and explaining them for this owner ----
export function ideasSystem(situation: string, owner: Lang): string {
  const hk = ownKey("how", owner), sk = ownKey("first_step", owner);
  return `You help a small farm-stay owner in rural Nepal improve her guests' experience.
Her situation: ${situation}

You get what her guests said and a list of candidate ideas, each with an id.
Rules:
- Choose up to 3 ideas that fit her situation. You may only use these ideas. Do not add new ideas, places, prices, numbers, rules or promises.
- For each chosen idea write, in short, simple ${written(owner)}: "${hk}" (at most 40 words): how she could do it with what she has; and "${sk}" (at most 15 words): one small first step.
- Do not write any digits. Do not mention money, law or medicine.
- If an idea needs internet or English and she does not have it, either skip it or say plainly which part she cannot do yet.
- If none fit, return an empty list.
- Output JSON only.`;
}

export function ideasUser(pointEn: string, candidates: { id: string; from: string; text: string; needs: string[] }[]): string {
  return `Guests said: ${pointEn}\n\nCandidate ideas:\n` + candidates.map((c) => `[${c.id}] (${c.from}) ${c.text}${c.needs.length ? ` (needs ${c.needs.join(" and ")})` : ""}`).join("\n");
}

export function ideasSchema(owner: Lang) {
  return { type: "object", properties: { chosen: { type: "array", maxItems: 3, items: strings(["candidate_id", ownKey("how", owner), ownKey("first_step", owner)]) } }, required: ["chosen"] };
}

// ---- translating the app's own labels into the owner's language (Settings) ----
export function uiSystem(owner: Lang): string {
  return `Translate the labels of a phone app from English into ${written(owner)}. The app helps a farm-stay owner read her guests' messages.
Use short, simple, everyday words for someone with basic reading skills.
Keep {0}, {1}, {2} exactly as they are. Do not translate "Ollama", "JSON", "AI" or anything inside “ollama pull …”.
Return JSON with the same keys; each value is the translation of that label.`;
}
export const uiUser = (labels: Record<string, string>) => JSON.stringify(labels, null, 1);
export const uiSchema = (keys: string[]) => strings(keys);
