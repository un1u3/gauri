import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runChecks } from "../src/checks";
import { datedThisWeek, fromJson, fromPaste, recent, WINDOW_DAYS } from "../src/messages";
import { detectLang, guessLang, langName, scriptHint, writtenIn } from "../src/lang";
import { labelOk, translateLabels } from "../src/ai/translate";
import { ENGLISH, KEYS, setPacks, translate } from "../src/i18n";
import { applyGuardrails } from "../src/ai/guardrails";
import { MOCK_ANALYSIS } from "../src/mock";
import { refreshSampleContacts, repairLanguageLabels } from "../src/store";

const load = (f: string) => JSON.parse(readFileSync(`data/${f}`, "utf8"));

describe("messages", () => {
  it("guesses language by script", () => {
    expect(["Great stay", "요리 수업", "早餐太晚", "धन्यवाद दिदी"].map(guessLang)).toEqual(["en", "ko", "zh", "ne"]);
  });
  it("paste: one message per line, blank lines skipped, unique IDs", () => {
    const a = fromPaste("Great stay\n\n  감사합니다  \n", []);
    expect(a.map((m) => [m.text, m.lang, m.synthetic, m.contact])).toEqual([["Great stay", "en", false, null], ["감사합니다", "ko", false, null]]);
    expect(fromPaste("x", a)[0].id).not.toBe(a[0].id);
  });
  it("imports every bundled data file, including the empty real-data slot", () => {
    expect(fromJson(load("synthetic_messages.json"), []).length).toBe(40);
    expect(fromJson(load("synthetic_test.json"), []).every((m) => m.synthetic)).toBe(true);
    expect(fromJson(load("real_messages.json"), [])).toEqual([]);
    const sample = fromJson(load("sample_reviews.json"), []);
    expect([sample.length, new Set(sample.map((m) => m.lang)).size, sample.every((m) => m.synthetic)]).toEqual([40, 9, true]);
  });
  it("import fills defaults, avoids ID clashes, rejects non-lists", () => {
    const first = fromJson([{ text: "Lovely farm" }, { nonsense: 1 }, { id: "x", text: "좋아요", lang: "xx" }], []);
    expect(first.map((m) => [m.lang, m.synthetic])).toEqual([["en", false], ["ko", false]]);
    expect(fromJson([{ text: "Merci pour tout", lang: "fr" }, { text: "ありがとう", lang: "ja" }], []).map((m) => m.lang)).toEqual(["fr", "ja"]);
    expect(fromJson([{ id: "x", text: "again" }], first)[0].id).not.toBe("x");
    expect(() => fromJson({ text: "x" }, [])).toThrow();
  });
});

it("sample messages saved with an old placeholder e-mail get the sample's phone number; others are left alone", () => {
  const sample = load("sample_reviews.json");
  const withContact = sample.find((m: any) => m.contact);
  const fixed = refreshSampleContacts([
    { ...withContact, contact: `guest-${withContact.id}@example.invalid` },
    { ...withContact, id: "g7", contact: "someone@example.invalid" },      // not a sample message
    { ...withContact, id: "g8", contact: "+977 98-0000-0000" },             // the owner's own entry
  ]);
  expect(fixed.map((m) => m.contact)).toEqual([withContact.contact, "someone@example.invalid", "+977 98-0000-0000"]);
  expect(withContact.contact).toMatch(/^\+\d/);
});

describe("language is worked out from the message, with nobody correcting it", () => {
  it("tells apart languages that share a script", () => {
    expect([
      "The shower was cold but the family was lovely.", "La route est longue et la maison est difficile à trouver.",
      "Nachts war es im Zimmer sehr kalt und die Decke war dünn.", "La familia nos trató muy bien y la comida fue excelente.",
      "नहाने के लिए गरम पानी नहीं था।", "राति कोठा धेरै चिसो भयो, ओढ्ने पातलो थियो।",
    ].map(guessLang)).toEqual(["en", "fr", "de", "es", "hi", "ne"]);
  });
  it("gets the labelled language right on the bundled sets", () => {
    const all = ["sample_reviews", "synthetic_messages", "synthetic_test", "synthetic_final"].flatMap((f) => load(`${f}.json`));
    const wrong = all.filter((m: any) => guessLang(m.text) !== m.lang);
    expect([all.length, wrong.length]).toEqual([160, 0]);
  });
  it("a saved label that cannot be right is repaired; plausible labels are kept", () => {
    const m = (text: string, lang: string) => ({ id: "x", text, lang, received_at: "", contact: null, synthetic: true });
    const fixed = repairLanguageLabels([m("Roasting our own coffee by the fire was the best part.", "mr"), m("धन्यवाद दिदी", "hi"), m("Gracias", "en")]);
    expect(fixed.map((x) => x.lang)).toEqual(["en", "hi", "en"]);
  });
  it("says when it is only going by the script", () => {
    expect(detectLang("OK!")).toEqual({ lang: "en", sure: false });
    expect(detectLang("Merci !")).toEqual({ lang: "fr", sure: true });
    expect(detectLang("감사합니다")).toEqual({ lang: "ko", sure: true });
    expect(detectLang("Merci pour tout, nous avons adoré la ferme.")).toEqual({ lang: "fr", sure: true });
  });
});

describe("the 7-day window", () => {
  const now = new Date(2026, 9, 4, 14, 0); // 4 October 2026, afternoon
  const on = (received_at: string) => ({ id: received_at, text: "x", lang: "en", received_at, contact: null, synthetic: true });
  it("keeps messages from today back to 6 days ago, and nothing older", () => {
    expect(WINDOW_DAYS).toBe(7);
    const kept = recent(["2026-10-04", "2026-09-28", "2026-09-27", "2026-09-01", "2026-10-04T08:30:00Z"].map(on), now).map((m) => m.id);
    expect(kept).toEqual(["2026-10-04", "2026-09-28", "2026-10-04T08:30:00Z"]);
  });
  it("the sample is dated across the last 7 days when loaded, oldest first, and all of it is in the window", () => {
    const sample = datedThisWeek(fromJson(load("sample_reviews.json"), []), now);
    expect([sample[0].received_at, sample[39].received_at]).toEqual(["2026-09-28", "2026-10-04"]);
    expect(new Set(sample.map((m) => m.received_at)).size).toBe(7);
    expect(recent(sample, now).length).toBe(40);
    expect(recent(fromJson(load("sample_reviews.json"), []), now).length).toBeLessThan(40); // its fixed September dates are mostly older
  });
  it("a message added now is in the window", () => expect(recent(fromPaste("hello", [])).length).toBe(1));
});

describe("checks page and demo mode", () => {
  it("every guardrail check passes", async () => {
    const checks = await runChecks();
    expect(checks.length).toBe(15);
    expect(checks.filter((c) => !c.pass)).toEqual([]);
  });
  it("demo analysis is guarded too: shows nothing when its messages are not on the device", () => {
    const a = applyGuardrails(MOCK_ANALYSIS, [], { model: "demo", seconds: 0, lang: "ne" });
    expect([a.loved, a.wished, a.upgrade]).toEqual([[], [], null]);
    const demo = applyGuardrails(MOCK_ANALYSIS, load("sample_reviews.json"), { model: "demo", seconds: 0, lang: "ne" });
    expect([demo.loved.length, demo.wished.length, demo.upgrade !== null]).toEqual([MOCK_ANALYSIS.loved.length, MOCK_ANALYSIS.wished.length, true]);
  });
});

describe("any language", () => {
  afterEach(() => { vi.unstubAllGlobals(); setPacks({}); });

  it("guesses many scripts; unknown script → 'und'", () => {
    expect(["ありがとう", "Спасибо", "شكرا", "ขอบคุณ", "ধন্যবাদ", "Merci", "…!"].map(guessLang)).toEqual(["ja", "ru", "ar", "th", "bn", "fr", "und"]);
  });
  it("names any language in its own script, with no data files", () => {
    expect(["ne", "ko", "fr", "ar", "ja"].map((l) => langName(l))).toEqual(["नेपाली", "한국어", "Français", "العربية", "日本語"]);
    expect(langName("ne", "en")).toBe("Nepali");
    expect([scriptHint("ne"), scriptHint("fr"), scriptHint("ko")]).toEqual([" in Devanagari script", "", " in Hangul script"]);
  });
  it("checks text against the script of any language", () => {
    expect([writtenIn("धन्यवाद", "ne"), writtenIn("thanks", "ne"), writtenIn("merci", "fr"), writtenIn("谢谢", "zh"), writtenIn("谢谢", "ja"), writtenIn("ありがとう", "ja"), writtenIn("", "fr")])
      .toEqual([true, false, true, true, false, true, false]);
  });
  it("a translated label must keep its {0} placeholders and use the language's script", () => {
    expect(labelOk("{0} messages", "{0} mensajes", "es")).toBe(true);
    expect(labelOk("{0} messages", "mensajes", "es")).toBe(false);
    expect(labelOk("Delete", "Delete", "hi")).toBe(false);
    expect(labelOk("Delete", "हटाएँ", "hi")).toBe(true);
  });
  it("labels are translated on the device; any that fail the check stay in English", async () => {
    // Fake model: answers every label with a Hindi word, except it breaks one placeholder and leaves one in English.
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      const labels = JSON.parse(JSON.parse(init.body).messages[1].content);
      const out = Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, k === "count" ? "सन्देश" : k === "add" ? "Add" : `शब्द ${(String(v).match(/\{\d\}/g) ?? []).join(" ")}`]));
      return new Response(JSON.stringify({ message: { content: JSON.stringify(out) } }));
    }));
    const progress: number[] = [];
    const pack = await translateLabels({ baseUrl: "", model: "fake", minMessages: 8, ownerLang: "hi" }, (done) => progress.push(done));
    expect(Object.keys(pack).length).toBe(KEYS.length - 2);
    expect([pack.count, pack.add]).toEqual([undefined, undefined]);
    expect(progress.at(-1)).toBe(KEYS.length);
    setPacks({ hi: pack });
    expect(translate("hi", "count", 3)).toBe(ENGLISH.count.replace("{0}", "3")); // failed label → English
    expect(translate("hi", "notEnough", 2, 8)).toBe("शब्द 2 8");
    expect(translate("sw", "add")).toBe("Add"); // no labels yet for this language → English
    expect(translate("ne", "add")).toBe("थप्नुहोस्");
  });
});
