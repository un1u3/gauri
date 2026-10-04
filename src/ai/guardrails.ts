// Guardrails applied in code to every model output before anything is displayed.
// These are the product: do not weaken them to raise an eval number.
import type { Analysis, Lang, Message, Point, RawAnalysis, RawDraft, Uncertain } from "../types";

export const DEFAULT_MIN_MESSAGES = 8;
export const MIN_CITATIONS = 2;

const DEVANAGARI = /[ऀ-ॿ]/;
const isText = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const isNepali = (x: unknown): x is string => isText(x) && DEVANAGARI.test(x);

// Rule 1: with too few messages there is no analysis and the model is not called.
export function hasEnoughFeedback(n: number, min = DEFAULT_MIN_MESSAGES): boolean {
  return n >= min;
}

export function notEnoughFeedback(n: number, model: string): Analysis {
  return { status: "not_enough_feedback", n_messages: n, loved: [], wished: [], upgrade: null, uncertain: [], model, seconds: 0, created_at: new Date().toISOString() };
}

function isPoint(x: any): x is Point {
  return !!x && isText(x.point_en) && isNepali(x.point_ne) && Array.isArray(x.message_ids) && x.message_ids.every((id: unknown) => typeof id === "string");
}

// Rule 5 (schema): returns null unless the output has exactly the expected shape,
// including Nepali fields that are really written in Devanagari.
export function validateAnalysis(x: any): RawAnalysis | null {
  if (!x || typeof x !== "object") return null;
  for (const key of ["loved", "wished", "upgrade", "uncertain"]) if (!Array.isArray(x[key])) return null;
  if (![...x.loved, ...x.wished, ...x.upgrade].every(isPoint)) return null;
  if (!x.uncertain.every((u: any) => !!u && isText(u.note_en) && isNepali(u.note_ne))) return null;
  return { loved: x.loved, wished: x.wished, upgrade: x.upgrade, uncertain: x.uncertain };
}

export function validateDraft(x: any): RawDraft | null {
  if (!x || !isText(x.text) || !isNepali(x.text_ne)) return null;
  return { text: x.text.trim(), text_ne: x.text_ne.trim() };
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
export function applyGuardrails(raw: RawAnalysis, messages: Message[], meta: { model: string; seconds: number }): Analysis {
  const known = new Set(messages.map((m) => m.id));
  const clean = (p: Point): Point => ({ ...p, message_ids: [...new Set(p.message_ids.map(normalizeId))].filter((id) => known.has(id)) });
  const uncertain: Uncertain[] = [];
  const demote = (p: Point, en: string, ne: string) => {
    // A point with no real source at all is dropped: there is nothing for the owner to check.
    if (p.message_ids.length > 0) uncertain.push({ note_en: `${en}: ${p.point_en}`, note_ne: `${ne}: ${p.point_ne}` });
  };
  const keep = (points: Point[]): Point[] =>
    points.map(clean).filter((p) => {
      if (p.message_ids.length >= MIN_CITATIONS) return true;
      demote(p, "Only one guest mentioned", "एक जना पाहुनाले मात्र भन्नुभयो");
      return false;
    });

  const loved = keep(raw.loved);
  const wished = keep(raw.wished);
  let upgrade: Point | null = raw.upgrade.length ? clean(raw.upgrade[0]) : null;
  if (upgrade && upgrade.message_ids.length < MIN_CITATIONS) {
    demote(upgrade, "Suggestion from only one guest", "एक जना पाहुनाको कुराबाट मात्र आएको सुझाव");
    upgrade = null;
  }
  uncertain.push(...raw.uncertain.map((u) => ({ note_en: u.note_en, note_ne: u.note_ne })));

  return { status: "ok", n_messages: messages.length, loved, wished, upgrade, uncertain, ...meta, created_at: new Date().toISOString() };
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
