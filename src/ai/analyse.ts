// The two AI features: monthly analysis and thank-you drafts.
// Model output passes through `validated` and the guardrails before it is returned.
import type { Analysis, Draft, Lang, Message } from "../types";
import { addCitations, applyGuardrails, hasEnoughFeedback, NotSureError, notEnoughFeedback, validateAnalysis, validateDraft, validateSecondLook, validated } from "./guardrails";
import { chat, lastModel, OllamaError } from "./ollama";
import { analysisSchema, analysisSystem, analysisUser, draftSchema, draftSystem, draftUser, SECOND_LOOK_SYSTEM, secondLookSchema, secondLookUser } from "./prompts";

// ownerLang: the language the owner reads; summaries and meanings are written in it.
// secondLook: false switches off the citation-completing second pass (used to measure what it adds).
export type AiConfig = { baseUrl: string; model: string; minMessages: number; ownerLang: Lang; secondLook?: boolean };

export async function analyse(messages: Message[], cfg: AiConfig): Promise<Analysis> {
  const lang = cfg.ownerLang;
  if (!hasEnoughFeedback(messages.length, cfg.minMessages)) return notEnoughFeedback(messages.length, cfg.model, lang);
  const start = Date.now();
  const raw = await validated(() => chat(cfg.baseUrl, cfg.model, analysisSystem(messages, lang), analysisUser(messages), analysisSchema(lang)), (x) => validateAnalysis(x, lang));
  const analysis = applyGuardrails(raw, messages, { model: lastModel || cfg.model, seconds: 0, lang });
  if (cfg.secondLook !== false) await secondLook(analysis, messages, cfg);
  analysis.seconds = Math.round((Date.now() - start) / 1000);
  return analysis;
}

// Adds citations the first pass missed. If this step fails, the first-pass summary stands as it is.
async function secondLook(analysis: Analysis, messages: Message[], cfg: AiConfig): Promise<void> {
  const labelled = [...analysis.loved.map((point) => ({ point, kind: "guests loved" })), ...analysis.wished.map((point) => ({ point, kind: "guests wished" }))]
    .map((p, i) => ({ ...p, label: `P${i + 1}` }));
  const cited = new Set(labelled.flatMap((l) => l.point.message_ids));
  const uncited = messages.filter((m) => !cited.has(m.id));
  if (!labelled.length || !uncited.length) return;
  try {
    const user = secondLookUser(labelled.map((l) => ({ label: l.label, kind: l.kind, text: l.point.point_en })), uncited);
    const matches = await validated(() => chat(cfg.baseUrl, cfg.model, SECOND_LOOK_SYSTEM, user, secondLookSchema(labelled.map((l) => l.label))), validateSecondLook);
    addCitations(analysis, labelled, matches, uncited);
  } catch (e) {
    if (!(e instanceof NotSureError) && !(e instanceof OllamaError)) throw e;
  }
}

export async function draftThanks(m: Message, cfg: AiConfig): Promise<Draft> {
  const lang = cfg.ownerLang;
  const raw = await validated(() => chat(cfg.baseUrl, cfg.model, draftSystem(lang), draftUser(m), draftSchema(lang)), (x) => validateDraft(x, lang));
  return { id: `d-${m.id}-${Date.now()}`, message_id: m.id, lang: m.lang, ...raw, own_lang: lang, status: "pending" };
}
