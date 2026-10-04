// Guardrails applied in code to every model output before anything is displayed.
// These are the product: do not weaken them to raise an eval number.
import { writtenIn } from "../lang";
import type { Analysis, Lang, Message, Point, RawAnalysis, RawDraft, Uncertain } from "../types";

export const DEFAULT_MIN_MESSAGES = 8;
export const MIN_CITATIONS = 2;

const isText = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;

// The model is asked for each text twice: in English ("point_en") and in the owner's language
// under a key named after that language ("point_ne", "point_fr", …).
export const ownKey = (prefix: "point" | "note" | "text" | "how" | "first_step", lang: Lang) => `${prefix}_${lang.replace(/[^a-z]/g, "")}`;

// Text that claims to be in the owner's language must use that language's script, and
// (unless the owner reads English) must not simply be the English text again.
function inOwnLanguage(x: unknown, lang: Lang, english?: unknown): x is string {
  return isText(x) && writtenIn(x, lang) && (lang === "en" || x.trim() !== english);
}

// Rule 1: with too few messages there is no analysis and the model is not called.
export function hasEnoughFeedback(n: number, min = DEFAULT_MIN_MESSAGES): boolean {
  return n >= min;
}

export function notEnoughFeedback(n: number, model: string, lang: Lang): Analysis {
  return { status: "not_enough_feedback", n_messages: n, loved: [], wished: [], upgrade: null, uncertain: [], lang, model, seconds: 0, created_at: new Date().toISOString() };
}

// Rule 5 (schema): returns null unless the output has exactly the expected shape,
// including owner-language fields that are really written in the owner's language (`lang`).
export function validateAnalysis(x: any, lang: Lang): RawAnalysis | null {
  if (!x || typeof x !== "object") return null;
  for (const key of ["loved", "wished", "upgrade", "uncertain"]) if (!Array.isArray(x[key])) return null;
  const pk = ownKey("point", lang), nk = ownKey("note", lang);
  const isPoint = (p: any) => !!p && isText(p.point_en) && inOwnLanguage(p[pk], lang, p.point_en) && Array.isArray(p.message_ids) && p.message_ids.every((id: unknown) => typeof id === "string");
  if (![...x.loved, ...x.wished, ...x.upgrade].every(isPoint)) return null;
  if (!x.uncertain.every((u: any) => !!u && isText(u.note_en) && inOwnLanguage(u[nk], lang, u.note_en))) return null;
  const point = (p: any): Point => ({ point_en: p.point_en, point_own: p[pk], message_ids: p.message_ids });
  return { loved: x.loved.map(point), wished: x.wished.map(point), upgrade: x.upgrade.map(point), uncertain: x.uncertain.map((u: any) => ({ note_en: u.note_en, note_own: u[nk] })) };
}

export function validateDraft(x: any, lang: Lang): RawDraft | null {
  const own = x?.[ownKey("text", lang)];
  if (!x || !isText(x.text) || !inOwnLanguage(own, lang)) return null;
  return { text: x.text.trim(), text_own: own.trim() };
}

export class NotSureError extends Error {}

// Rule 5 (retry): one retry on invalid output, then give up. Invalid output is never returned.
export async function validated<T>(call: () => Promise<unknown>, validate: (x: unknown) => T | null): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let parsed: unknown = null;
    try {
      const out = await call();
      parsed = typeof out === "string" ? JSON.parse(out) : out;
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e; // network errors are not retried here
    }
    const ok = validate(parsed);
    if (ok) return ok;
  }
  throw new NotSureError("model output failed validation twice");
}

// Rules 2–4: keep only citations that exist; a point needs MIN_CITATIONS of them to be shown.
export function applyGuardrails(raw: RawAnalysis, messages: Message[], meta: { model: string; seconds: number; lang: Lang }): Analysis {
  const known = new Set(messages.map((m) => m.id));
  const clean = (p: Point): Point => ({ ...p, message_ids: [...new Set(p.message_ids.map(normalizeId))].filter((id) => known.has(id)) });
  const uncertain: Uncertain[] = [];
  // The screen adds "Only one guest mentioned:" in the owner's language, from `reason`.
  const demote = (p: Point, reason: Uncertain["reason"]) => {
    // A point with no real source at all is dropped: there is nothing for the owner to check.
    if (p.message_ids.length > 0) uncertain.push({ note_en: p.point_en, note_own: p.point_own, reason });
  };
  const keep = (points: Point[]): Point[] =>
    points.map(clean).filter((p) => {
      if (p.message_ids.length >= MIN_CITATIONS) return true;
      demote(p, "single_guest");
      return false;
    });

  const loved = keep(raw.loved);
  const wished = keep(raw.wished);
  let upgrade: Point | null = raw.upgrade.length ? clean(raw.upgrade[0]) : null;
  if (upgrade && upgrade.message_ids.length < MIN_CITATIONS) {
    demote(upgrade, "weak_upgrade");
    upgrade = null;
  }
  // The model sometimes leaves a raw id like "[m01]" in a note; ids mean nothing to the owner.
  const tidy = (t: string) => t.replace(/\s*[[(]\s*[a-z]{1,2}\d+\s*[\])]/gi, "").trim();
  uncertain.push(...raw.uncertain.map((u) => ({ note_en: tidy(u.note_en), note_own: tidy(u.note_own) })));

  return { status: "ok", n_messages: messages.length, loved, wished, upgrade, uncertain, ...meta, created_at: new Date().toISOString() };
}

// Second look: add citations the first pass missed. Only messages that exist and are not yet cited by
// any point can be added, and only to a displayed point. Nothing is removed and no point is created.
export function validateSecondLook(x: any): { id: string; point: string }[] | null {
  if (!x || !Array.isArray(x.matches) || !x.matches.every((m: any) => m && typeof m.id === "string" && typeof m.point === "string")) return null;
  return x.matches;
}

export function addCitations(analysis: Analysis, labelled: { label: string; point: Point }[], matches: { id: string; point: string }[], uncited: Message[]): Analysis {
  const allowed = new Set(uncited.map((m) => m.id));
  for (const m of matches) {
    const id = normalizeId(m.id), target = labelled.find((l) => l.label === m.point);
    if (!target || !allowed.has(id)) continue; // "none", an unknown label, an unknown id, or already cited
    allowed.delete(id); // a message supports at most one point
    target.point.message_ids.push(id);
  }
  return analysis;
}

// The model sometimes echoes the brackets it saw in the prompt: "[m12]" → "m12".
function normalizeId(id: string): string {
  return id.trim().replace(/^\[|\]$/g, "");
}

// Languages behind a point are computed here from the cited messages, never taken from the model.
export function languagesOf(point: Point, messages: Message[]): Lang[] {
  const byId = new Map(messages.map((m) => [m.id, m.lang]));
  return [...new Set(point.message_ids.map((id) => byId.get(id)).filter((l): l is Lang => !!l))];
}
