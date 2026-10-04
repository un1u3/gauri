export type Lang = "en" | "ko" | "hi" | "zh" | "ne";
export const LANGS: Lang[] = ["en", "ko", "hi", "zh", "ne"];
// Language names in their own script; shown to the owner next to every cited message.
export const LANG_NAMES: Record<Lang, string> = { en: "English", ko: "한국어", hi: "हिन्दी", zh: "中文", ne: "नेपाली" };

export type Message = { id: string; text: string; lang: Lang; received_at: string; contact: string | null; synthetic: boolean };
export type Point = { point_en: string; point_ne: string; message_ids: string[] };
export type Uncertain = { note_en: string; note_ne: string };
export type Analysis = {
  status: "ok" | "not_enough_feedback";
  n_messages: number;
  loved: Point[];
  wished: Point[];
  upgrade: Point | null;
  uncertain: Uncertain[];
  model: string; seconds: number; created_at: string;
};
export type Draft = { id: string; message_id: string; lang: Lang; text: string; text_ne: string; status: "pending" | "approved" | "discarded" };

// What the model is asked to return (before guardrails). `upgrade` is a list of 0–1 points.
export type RawAnalysis = { loved: Point[]; wished: Point[]; upgrade: Point[]; uncertain: Uncertain[] };
export type RawDraft = { text: string; text_ne: string };
