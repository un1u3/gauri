// The two AI features: monthly analysis and thank-you drafts.
// Model output passes through `validated` and the guardrails before it is returned.
import type { Analysis, Draft, Message } from "../types";
import { applyGuardrails, hasEnoughFeedback, notEnoughFeedback, validateAnalysis, validateDraft, validated } from "./guardrails";
import { chat } from "./ollama";
import { ANALYSIS_SCHEMA, ANALYSIS_SYSTEM, DRAFT_SCHEMA, DRAFT_SYSTEM, analysisUser, draftUser } from "./prompts";

export type AiConfig = { baseUrl: string; model: string; minMessages: number };

export async function analyse(messages: Message[], cfg: AiConfig): Promise<Analysis> {
  if (!hasEnoughFeedback(messages.length, cfg.minMessages)) return notEnoughFeedback(messages.length, cfg.model);
  const start = Date.now();
  const raw = await validated(() => chat(cfg.baseUrl, cfg.model, ANALYSIS_SYSTEM, analysisUser(messages), ANALYSIS_SCHEMA), validateAnalysis);
  return applyGuardrails(raw, messages, { model: cfg.model, seconds: Math.round((Date.now() - start) / 1000) });
}

export async function draftThanks(m: Message, cfg: AiConfig): Promise<Draft> {
  const raw = await validated(() => chat(cfg.baseUrl, cfg.model, DRAFT_SYSTEM, draftUser(m), DRAFT_SCHEMA), validateDraft);
  return { id: `d-${m.id}-${Date.now()}`, message_id: m.id, lang: m.lang, ...raw, status: "pending" };
}
