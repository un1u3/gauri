import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runChecks } from "../src/checks";
import { fromJson, fromPaste } from "../src/messages";
import { guessLang, langName, scriptHint, writtenIn } from "../src/lang";
import { labelOk, translateLabels } from "../src/ai/translate";
import { ENGLISH, KEYS, setPacks, translate } from "../src/i18n";
import { applyGuardrails } from "../src/ai/guardrails";
import { MOCK_ANALYSIS } from "../src/mock";

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
  });
  it("import fills defaults, avoids ID clashes, rejects non-lists", () => {
    const first = fromJson([{ text: "Lovely farm" }, { nonsense: 1 }, { id: "x", text: "좋아요", lang: "xx" }], []);
    expect(first.map((m) => [m.lang, m.synthetic])).toEqual([["en", false], ["ko", false]]);
    expect(fromJson([{ text: "Merci pour tout", lang: "fr" }, { text: "ありがとう", lang: "ja" }], []).map((m) => m.lang)).toEqual(["fr", "ja"]);
    expect(fromJson([{ id: "x", text: "again" }], first)[0].id).not.toBe("x");
    expect(() => fromJson({ text: "x" }, [])).toThrow();
  });
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
    expect(applyGuardrails(MOCK_ANALYSIS, load("synthetic_messages.json"), { model: "demo", seconds: 0, lang: "ne" }).loved.length).toBe(2);
  });
});

describe("any language", () => {
  afterEach(() => { vi.unstubAllGlobals(); setPacks({}); });

  it("guesses many scripts; unknown script → 'und'", () => {
    expect(["ありがとう", "Спасибо", "شكرا", "ขอบคุณ", "ধন্যবাদ", "Merci", "…!"].map(guessLang)).toEqual(["ja", "ru", "ar", "th", "bn", "en", "und"]);
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
