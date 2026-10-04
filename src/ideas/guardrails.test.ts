import { afterEach, describe, expect, it, vi } from "vitest";
import { gatherCandidates } from "./candidates";
import { IDEAS } from "./data";
import { applyIdeaGuardrails, breaksRules, trimToSentences, validateChosen } from "./guardrails";
import { DEFAULT_PROFILE, describeProfile, getIdeas } from "./ideas";
import { matchProblems } from "./match";
import { cardView } from "./view";

const POINT = "Breakfast was too late for our early bus";
const candidates = gatherCandidates(matchProblems(POINT, "wished", IDEAS.problems), IDEAS); // L1 L2 L3 D1 D2
const HOW = "अघिल्लो साँझ पाहुनालाई बिहान कति बेला खाने भनेर सोध्नुहोस्।", STEP = "आज साँझ एक पटक सोध्नुहोस्।";
const pick = (id: string, how = HOW, first_step = STEP) => ({ candidate_id: id, how, first_step });
const cfg = { baseUrl: "http://localhost:11434", model: "fake", minMessages: 8, ownerLang: "ne" };
const reply = (chosen: object[]) => new Response(JSON.stringify({ message: { content: JSON.stringify({ chosen }) } }));
afterEach(() => vi.unstubAllGlobals());

describe("4. guardrails", () => {
  it("an invented candidate id is dropped; duplicates are dropped; at most 3", () => {
    const cards = applyIdeaGuardrails([pick("L9"), pick("L1"), pick("L1"), pick("D1"), pick("L2"), pick("L3")], candidates, "ne");
    expect(cards.map((c) => c.candidate.short)).toEqual(["L1", "D1", "L2"]);
    expect(cards.every((c) => c.how === HOW)).toBe(true);
  });
  it.each([
    ["an ASCII digit", "बिहान 7 बजे खाना दिनुहोस्।"],
    ["a Devanagari digit", "बिहान ७ बजे खाना दिनुहोस्।"],
    ["a money word", "यसको शुल्क लिनुहोस्।"],
    ["रु", "रु तिर्न लगाउनुहोस्।"],
    ["a banned topic (licence)", "लाइसेन्स लिनुहोस्।"],
    ["a banned topic (tax)", "कर तिर्नुहोस्।"],
    ["English money word", "Tell guests the price."],
  ])("text with %s is rejected: the card is shown without model text", (_, bad) => {
    expect(breaksRules(bad)).not.toBeNull();
    for (const chosen of [pick("L1", bad), pick("L1", HOW, bad)]) {
      const [card] = applyIdeaGuardrails([chosen], candidates, "ne");
      expect([card.candidate.short, card.how, card.first_step]).toEqual(["L1", undefined, undefined]);
    }
  });
  it("ordinary words that merely contain a banned syllable are not rejected", () => {
    expect(["करेसाबारीको साग टिप्नुहोस्।", "सुरुमा पाहुनालाई सोध्नुहोस्।", "उपकरण सफा राख्नुहोस्।"].map(breaksRules)).toEqual([null, null, null]);
  });
  it("text in the wrong language is rejected", () => {
    expect(applyIdeaGuardrails([pick("L1", "Ask guests the evening before.", "Ask tonight.")], candidates, "ne")[0].how).toBeUndefined();
  });
  it("over-length text is trimmed at the last full sentence within the limit", () => {
    const long = "पहिलो वाक्य यहाँ छ। " + "शब्द ".repeat(45) + "।";
    expect(trimToSentences(long, 40)).toBe("पहिलो वाक्य यहाँ छ।");
    expect(trimToSentences("छोटो वाक्य।", 40)).toBe("छोटो वाक्य।");
    expect(trimToSentences("शब्द ".repeat(50), 40)).toBeNull(); // no full sentence fits → no model text
    expect(applyIdeaGuardrails([pick("L1", long)], candidates, "ne")[0].how).toBe("पहिलो वाक्य यहाँ छ।");
  });
  it("schema: the reply must be {chosen: [{candidate_id, how_ne, first_step_ne}]}", () => {
    expect(validateChosen({ chosen: [{ candidate_id: "[L1]", how_ne: HOW, first_step_ne: STEP }] }, "ne")).toEqual([pick("L1")]);
    expect(validateChosen({ chosen: [{ candidate_id: "L1", how_ne: HOW }] }, "ne")).toBeNull();
    expect(validateChosen({ ideas: [] }, "ne")).toBeNull();
    expect(validateChosen({ chosen: [{ candidate_id: "L1", how_fr: "Demandez la veille.", first_step_fr: "Ce soir." }] }, "fr")?.[0].how).toBe("Demandez la veille.");
  });
  it("the profile is given to the model in words, with no digits", () => {
    expect(describeProfile(DEFAULT_PROFILE)).toBe("She runs a farm-stay with three guest rooms in Gulmi district. She has no Wi-Fi and only occasional mobile internet. She can use a smartphone: weekends only. She has a very small budget. She speaks: Nepali. Help she has: daughter on weekends.");
  });
});

describe("5. pipeline and fallbacks (Ollama mocked)", () => {
  it("valid reply → cards with the model's text; request is local, schema-bound, temperature 0", async () => {
    const f = vi.fn().mockResolvedValue(reply([{ candidate_id: "L1", how_ne: HOW, first_step_ne: STEP }, { candidate_id: "X7", how_ne: HOW, first_step_ne: STEP }]));
    vi.stubGlobal("fetch", f);
    const r = await getIdeas(POINT, "wished", DEFAULT_PROFILE, cfg, IDEAS);
    expect([r.status, r.lang, r.cards.length, r.cards[0].how]).toEqual(["ok", "ne", 1, HOW]);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect([f.mock.calls[0][0], body.stream, body.options.temperature]).toEqual(["http://localhost:11434/api/chat", false, 0]);
    expect(body.format.properties.chosen.items.required).toEqual(["candidate_id", "how_ne", "first_step_ne"]);
    expect(body.messages[1].content).toContain("[L1] (from a guidebook)");
    expect(body.messages[1].content).toContain("[D1] (drafted idea)");
  });
  it("schema failure → one retry → fallback cards (original ideas, no model text)", async () => {
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: { content: "Here are some ideas!" } })));
    vi.stubGlobal("fetch", f);
    const r = await getIdeas(POINT, "wished", DEFAULT_PROFILE, cfg, IDEAS);
    expect(f).toHaveBeenCalledTimes(2);
    expect([r.status, r.cards.length, r.cards.every((c) => c.how === undefined)]).toEqual(["fallback", 3, true]);
  });
  it("Ollama off → fallback cards", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const r = await getIdeas(POINT, "wished", DEFAULT_PROFILE, cfg, IDEAS);
    expect([r.status, r.cards.map((c) => c.candidate.short)]).toEqual(["fallback", ["L1", "L2", "L3"]]);
  });
  it("no matching problem → 'ask a person', and the model is not called", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await getIdeas("Purple elephants sing quietly on Tuesdays", "wished", DEFAULT_PROFILE, cfg, IDEAS)).status).toBe("no_match");
    expect(f).not.toHaveBeenCalled();
  });
  it("model says none fit → no_match, nothing is pushed on her", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply([])));
    expect((await getIdeas(POINT, "wished", DEFAULT_PROFILE, cfg, IDEAS)).status).toBe("no_match");
  });
});

describe("6. source labels", () => {
  it("every library card shows title + page + the exact quotes; every drafted card is marked as not from a guidebook", () => {
    for (const idea of IDEAS.library) {
      const v = cardView({ candidate: { short: "L1", kind: "library", idea } }, "ne");
      expect(v.kind).toBe("library");
      expect(v.source).toBe(`${idea.source_title}, ${idea.page}`);
      expect(v.quotes).toEqual(idea.quote_2 ? [idea.quote, idea.quote_2] : [idea.quote]);
      expect([v.needsInternet, v.needsEnglish, v.pending]).toEqual([idea.needs_internet, idea.needs_english, true]);
    }
    for (const idea of IDEAS.drafted) {
      const v = cardView({ candidate: { short: "D1", kind: "drafted", idea } }, "ne");
      expect([v.kind, v.source, v.quotes, v.pending]).toEqual(["drafted", undefined, [], true]);
    }
  });
  it("a card rejected by the guardrails still shows the original idea, never the rejected text", () => {
    const [card] = applyIdeaGuardrails([pick("L1", "बिहान 7 बजे।")], candidates, "ne");
    const v = cardView(card, "ne");
    expect([v.how, v.original, v.originalLang]).toEqual([undefined, candidates[0].idea.idea_en, "en"]);
  });
});
