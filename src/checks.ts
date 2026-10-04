// The Checks screen: runs every guardrail on fixed inputs, with no model call, and reports PASS/FAIL.
import { analyse } from "./ai/analyse";
import { addCitations, applyGuardrails, languagesOf, NotSureError, validateAnalysis, validateDraft, validated } from "./ai/guardrails";
import { gatherCandidates } from "./ideas/candidates";
import { IDEAS } from "./ideas/data";
import { applyIdeaGuardrails } from "./ideas/guardrails";
import { DEFAULT_PROFILE, getIdeas } from "./ideas/ideas";
import { matchProblems } from "./ideas/match";
import { cardView } from "./ideas/view";
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

  // Second look: may only add real, not-yet-cited messages to a point that is already shown.
  const shown = applyGuardrails(raw({ loved: [point(["a1", "a2"])] }), MSGS, meta);
  addCitations(shown, [{ label: "P1", point: shown.loved[0] }], [{ id: "a3", point: "P1" }, { id: "a1", point: "P1" }, { id: "zz9", point: "P1" }, { id: "a4", point: "P9" }, { id: "a5", point: "none" }], MSGS.slice(2));

  // ---- "What can I improve?" ----
  const BREAKFAST = "Breakfast was too late for our early bus";
  const candidates = gatherCandidates(matchProblems(BREAKFAST, "wished", IDEAS.problems), IDEAS);
  const OK = "अघिल्लो साँझ पाहुनालाई सोध्नुहोस्।";
  const cards = applyIdeaGuardrails([
    { candidate_id: "L9", how: OK, first_step: OK },                       // an id the model made up
    { candidate_id: "L1", how: "बिहान ७ बजे खाना दिनुहोस्।", first_step: OK },   // a number
    { candidate_id: "L2", how: "यसको शुल्क लिनुहोस्।", first_step: OK },        // money
    { candidate_id: "D1", how: OK, first_step: "लाइसेन्स लिनुहोस्।" },          // a legal claim
  ], candidates, "ne");
  // Model switched off: the original ideas must still appear, and nothing may be asked of the model when nothing matches.
  let ideaCalls = 0;
  globalThis.fetch = (() => { ideaCalls++; return Promise.reject(new Error("blocked")); }) as typeof fetch;
  let off, none;
  try {
    const cfg = { baseUrl: "", model: "check", minMessages: 8, ownerLang: "ne" };
    off = await getIdeas(BREAKFAST, "wished", DEFAULT_PROFILE, cfg, IDEAS);
    const before = ideaCalls;
    none = await getIdeas("Purple elephants sing quietly on Tuesdays", "wished", DEFAULT_PROFILE, cfg, IDEAS);
    ideaCalls -= before;
  } finally {
    globalThis.fetch = realFetch;
  }
  const views = [...IDEAS.library.map((idea) => cardView({ candidate: { short: "L1", kind: "library", idea } }, "ne")), ...IDEAS.drafted.map((idea) => cardView({ candidate: { short: "D1", kind: "drafted", idea } }, "ne"))];

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
    { en: "The second look can only add real, not-yet-cited messages to a point already shown", ne: "दोस्रो हेराइले पहिल्यै देखाइएको कुरामा साँच्चैका, नजोडिएका सन्देश मात्र थप्न सक्छ", pass: shown.loved[0].message_ids.join() === "a1,a2,a3" && shown.loved.length === 1 },
    { en: "Ideas: “breakfast too late” is matched to a meal-time problem by keywords, with no model", ne: "उपाय: “बिहानको खाना ढिलो” लाई खानाको समयको समस्यासँग मोडेलबिनै मिलाइन्छ", pass: matchProblems(BREAKFAST, "wished", IDEAS.problems)[0]?.tag === "food_timing" },
    { en: "Ideas: a “loved” point never gets a complaint's ideas", ne: "उपाय: “मन परेको” कुरामा गुनासोको उपाय आउँदैन", pass: IDEAS.problems.every((p) => matchProblems(p.problem_en, "loved", IDEAS.problems).every((m) => m.type === "loved")) },
    { en: "Ideas: an idea the model made up is dropped; text with a number, money or a legal claim is never shown", ne: "उपाय: मोडेलले आफैं बनाएको उपाय हटाइन्छ; अंक, पैसा वा कानुनी कुरा भएको पाठ देखाइँदैन", pass: cards.length === 3 && cards.every((c) => c.how === undefined && c.first_step === undefined) },
    { en: "Ideas: with the AI off, the original ideas are still shown", ne: "उपाय: AI बन्द हुँदा पनि मूल उपाय देखिन्छ", pass: off.status === "fallback" && off.cards.length === 3 && off.cards.every((c) => !c.how) },
    { en: "Ideas: nothing matches → “ask your homestay association or guide”, model not called", ne: "उपाय: केही नमिले → “होमस्टे संघ वा गाइडसँग सोध्नुहोस्”, मोडेल चल्दैन", pass: none.status === "no_match" && ideaCalls === 0 },
    { en: "Ideas: every guidebook idea shows its source and exact quote; every Gauri idea is marked as not from a guidebook", ne: "उपाय: गाइडबुकको हरेक उपायमा स्रोत र ठ्याक्कै शब्द हुन्छ; गौरीको हरेक उपायमा “गाइडबुकबाट होइन” लेखिन्छ", pass: views.every((v) => (v.kind === "library" ? !!v.source && v.quotes.length > 0 : !v.source && v.quotes.length === 0)) },
  ];
}
