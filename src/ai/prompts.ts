// All prompt text and model options live here. The inner improvement loop (LOOP_LOG.md)
// only ever changes this file.
import type { Lang, Message } from "../types";

export const DEFAULT_MODEL = "gemma4:e2b";
// temperature 0 + fixed seed so two runs are comparable; num_ctx fits ~40 short messages
// plus the answer on a 6 GB laptop.
export const MODEL_OPTIONS = { temperature: 0, seed: 7, num_ctx: 8192 };

const LANG_EN: Record<Lang, string> = { en: "English", ko: "Korean", hi: "Hindi", zh: "Chinese", ne: "Nepali" };

export const ANALYSIS_SYSTEM = `You help a small farm-stay owner in Nepal understand her guests' feedback.
The messages are in English, Korean, Hindi, Chinese and Nepali. Each line is: [id] (language) text.

Rules:
- Use only what is written in the messages. Do not add facts.
- "loved": things guests liked. "wished": things guests wished were different.
- "upgrade": at most one suggestion for the owner, based on what several guests wished for.
- For every point, list in "message_ids" the ids of ALL messages that support it, in every language.
- Write each point in short, simple English ("point_en") and in short, simple Nepali in Devanagari script ("point_ne"), for someone with basic reading skills.
- If something is mentioned by only one guest, or is unclear or contradictory, put it in "uncertain" ("note_en" in English, "note_ne" in Nepali in Devanagari script), not in the points.
- Ignore messages that are only greetings, thanks or travel news.
- Output JSON only.`;

export function analysisUser(messages: Message[]): string {
  return messages.map((m) => `[${m.id}] (${m.lang}) ${m.text.replace(/\s+/g, " ").trim()}`).join("\n");
}

const POINT = {
  type: "object",
  properties: { point_en: { type: "string" }, point_ne: { type: "string" }, message_ids: { type: "array", items: { type: "string" } } },
  required: ["point_en", "point_ne", "message_ids"],
};
export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    loved: { type: "array", items: POINT },
    wished: { type: "array", items: POINT },
    upgrade: { type: "array", items: POINT, maxItems: 1 },
    uncertain: { type: "array", items: { type: "object", properties: { note_en: { type: "string" }, note_ne: { type: "string" } }, required: ["note_en", "note_ne"] } },
  },
  required: ["loved", "wished", "upgrade", "uncertain"],
};

export const DRAFT_SYSTEM = `You help a small farm-stay owner in Nepal reply to a guest.
Write a short, warm thank-you message in the guest's language, in two natural sentences: first thank them for visiting, then say you hope they visit again and tell their friends about the farm.
Do not mention prices, discounts, dates or promises. Do not add facts that are not in the guest's message.
Return JSON: "text" is the reply in the guest's language; "text_ne" is the same reply in short, simple Nepali written in Devanagari script.`;

export function draftUser(m: Message): string {
  return `Guest's language: ${LANG_EN[m.lang]}\nGuest's message: ${m.text}`;
}

export const DRAFT_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" }, text_ne: { type: "string" } },
  required: ["text", "text_ne"],
};
