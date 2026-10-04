import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runChecks } from "../src/checks";
import { fromJson, fromPaste, guessLang } from "../src/messages";
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
    expect(fromJson([{ id: "x", text: "again" }], first)[0].id).not.toBe("x");
    expect(() => fromJson({ text: "x" }, [])).toThrow();
  });
});

describe("checks page and demo mode", () => {
  it("every guardrail check passes", async () => {
    const checks = await runChecks();
    expect(checks.length).toBe(8);
    expect(checks.filter((c) => !c.pass)).toEqual([]);
  });
  it("demo analysis is guarded too: shows nothing when its messages are not on the device", () => {
    const a = applyGuardrails(MOCK_ANALYSIS, [], { model: "demo", seconds: 0 });
    expect([a.loved, a.wished, a.upgrade]).toEqual([[], [], null]);
    expect(applyGuardrails(MOCK_ANALYSIS, load("synthetic_messages.json"), { model: "demo", seconds: 0 }).loved.length).toBe(2);
  });
});
