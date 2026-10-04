// A language code such as "en", "ko", "ne", "fr" ("und" = not known). Any language is allowed.
export type Lang = string;
// The five languages of the synthetic evaluation sets (the only ones we have measured).
export const EVAL_LANGS: Lang[] = ["en", "ko", "hi", "zh", "ne"];

export type Message = { id: string; text: string; lang: Lang; received_at: string; contact: string | null; synthetic: boolean };
// point_own / note_own / text_own are written in the owner's language (Nepali by default).
export type Point = { point_en: string; point_own: string; message_ids: string[] };
export type Uncertain = { note_en: string; note_own: string; reason?: "single_guest" | "weak_upgrade" };
export type Analysis = {
  status: "ok" | "not_enough_feedback";
  n_messages: number;
  loved: Point[];
  wished: Point[];
  upgrade: Point | null;
  uncertain: Uncertain[];
  lang: Lang; // the owner's language this analysis was written in
  model: string; seconds: number; created_at: string;
};
export type Draft = { id: string; message_id: string; lang: Lang; text: string; text_own: string; own_lang: Lang; status: "pending" | "approved" | "discarded" };

// What the model returned, after schema validation and before guardrails. `upgrade` is a list of 0–1 points.
export type RawAnalysis = { loved: Point[]; wished: Point[]; upgrade: Point[]; uncertain: Uncertain[] };
export type RawDraft = { text: string; text_own: string };
