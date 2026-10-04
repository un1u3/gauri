// The Checks screen: runs every guardrail on fixed inputs, with no model call, and reports PASS/FAIL.
import { analyse } from "./ai/analyse";
import { applyGuardrails, languagesOf, NotSureError, validateAnalysis, validateDraft, validated } from "./ai/guardrails";
import type { Lang, Message, Point, RawAnalysis } from "./types";

export type Check = { en: string; ne: string; pass: boolean };

const msg = (id: string, lang: Lang): Message => ({ id, text: "…", lang, received_at: "2026-09-01", contact: null, synthetic: true });
const MSGS = [msg("a1", "en"), msg("a2", "ko"), msg("a3", "ne"), msg("a4", "zh"), msg("a5", "hi")];
const point = (ids: string[]): Point => ({ point_en: "Guests want Wi-Fi.", point_own: "पाहुनालाई वाइफाइ चाहियो।", message_ids: ids });
// What a model reply looks like for an owner who reads `lang`.
const reply = (lang: Lang, own: string) => ({ loved: [{ point_en: "Guests want Wi-Fi.", [`point_${lang}`]: own, message_ids: ["a1", "a2"] }], wished: [], upgrade: [], uncertain: [] });
const raw = (over: Partial<RawAnalysis>): RawAnalysis => ({ loved: [], wished: [], upgrade: [], uncertain: [], ...over });
const meta = { model: "check", seconds: 0, lang: "ne" };

export async function runChecks(): Promise<Check[]> {
  // 1. Too few messages: no analysis, and the model must not be contacted.
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => { calls++; return Promise.reject(new Error("blocked")); }) as typeof fetch;
  let few;
  try {
    few = await analyse(MSGS, { baseUrl: "", model: "check", minMessages: 8, ownerLang: "ne" });
  } finally {
    globalThis.fetch = realFetch;
  }

  const fake = applyGuardrails(raw({ loved: [point(["a1", "zz9", "a2", "xx7"])] }), MSGS, meta);
  const single = applyGuardrails(raw({ wished: [point(["a1"])] }), MSGS, meta);
  const invented = applyGuardrails(raw({ loved: [point(["zz1", "zz2"])] }), MSGS, meta);
  const upgrade = applyGuardrails(raw({ upgrade: [point(["a3"])] }), MSGS, meta);

  let tries = 0, refused = false;
  try {
    await validated(async () => { tries++; return '{"loved": "guests were happy"}'; }, (x) => validateAnalysis(x, "ne"));
  } catch (e) {
    refused = e instanceof NotSureError;
  }

  // The owner's-language text must really be in that language's script, whatever the language is.
  const ownLanguageChecked =
    validateDraft({ text: "Thanks", text_ne: "Thanks" }, "ne") === null &&
    validateAnalysis(reply("ne", "Guests want Wi-Fi"), "ne") === null && validateAnalysis(reply("ne", "पाहुनालाई वाइफाइ चाहियो।"), "ne") !== null &&
    validateAnalysis(reply("ar", "Guests want Wi-Fi"), "ar") === null && validateAnalysis(reply("ar", "الضيوف يريدون واي فاي"), "ar") !== null &&
    validateAnalysis(reply("ko", "पाहुनालाई वाइफाइ चाहियो।"), "ko") === null;

  return [
    { en: "5 messages (fewer than 8) → “not enough feedback”, model not called", ne: "५ सन्देश (८ भन्दा कम) → “पर्याप्त प्रतिक्रिया छैन”, मोडेल चल्दैन", pass: few.status === "not_enough_feedback" && calls === 0 },
    { en: "Citations to messages that do not exist are removed", ne: "नभएका सन्देशको हवाला हटाइन्छ", pass: fake.loved[0]?.message_ids.join() === "a1,a2" },
    { en: "A point from only one guest is moved to “not sure”", ne: "एक जना पाहुनाको कुरा “निश्चित छैन” मा जान्छ", pass: single.wished.length === 0 && single.uncertain.length === 1 },
    { en: "A point with no real source is not shown at all", ne: "स्रोत नभएको कुरा देखाइँदैन", pass: invented.loved.length === 0 && invented.uncertain.length === 0 },
    { en: "A suggestion from fewer than 2 guests is not shown as a suggestion", ne: "२ भन्दा कम पाहुनाबाट आएको सुझाव देखाइँदैन", pass: upgrade.upgrade === null && upgrade.uncertain.length === 1 },
    { en: "Broken model output → one retry → “not sure”, never displayed", ne: "बिग्रेको उत्तर → एक पटक फेरि प्रयास → “निश्चित छैन”, कहिल्यै देखाइँदैन", pass: refused && tries === 2 },
    { en: "Text in the owner's language must really be in that language (tested: Nepali, Arabic, Korean)", ne: "मालिकको भाषाको पाठ साँच्चै त्यही भाषामा हुनुपर्छ (जाँचिएको: नेपाली, अरबी, कोरियाली)", pass: ownLanguageChecked },
    { en: "Languages behind a point are computed from the messages, not by the model", ne: "भाषाको सूची सन्देशबाट गनिन्छ, मोडेलबाट होइन", pass: languagesOf(point(["a1", "a2", "a3"]), MSGS).join() === "en,ko,ne" },
  ];
}
