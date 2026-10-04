// The two AI features: monthly analysis and thank-you drafts.
// Model output passes through `validated` and the guardrails before it is returned.
import type { Analysis, Draft, Lang, Message } from "../types";
import { applyGuardrails, hasEnoughFeedback, notEnoughFeedback, validateAnalysis, validateDraft, validated } from "./guardrails";
import { chat, lastModel } from "./ollama";
import { analysisSchema, analysisSystem, analysisUser, draftSchema, draftSystem, draftUser } from "./prompts";

// ownerLang: the language the owner reads; summaries and meanings are written in it.
export type AiConfig = { baseUrl: string; model: string; minMessages: number; ownerLang: Lang };

export async function analyse(messages: Message[], cfg: AiConfig): Promise<Analysis> {
  const lang = cfg.ownerLang;
  if (!hasEnoughFeedback(messages.length, cfg.minMessages)) return notEnoughFeedback(messages.length, cfg.model, lang);
  const start = Date.now();
  const raw = await validated(() => chat(cfg.baseUrl, cfg.model, analysisSystem(messages, lang), analysisUser(messages), analysisSchema(lang)), (x) => validateAnalysis(x, lang));
  return applyGuardrails(raw, messages, { model: lastModel || cfg.model, seconds: Math.round((Date.now() - start) / 1000), lang });
}

export async function draftThanks(m: Message, cfg: AiConfig): Promise<Draft> {
  const lang = cfg.ownerLang;
  const raw = await validated(() => chat(cfg.baseUrl, cfg.model, draftSystem(lang), draftUser(m), draftSchema(lang)), (x) => validateDraft(x, lang));
  return { id: `d-${m.id}-${Date.now()}`, message_id: m.id, lang: m.lang, ...raw, own_lang: lang, status: "pending" };
}
