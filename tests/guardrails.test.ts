import { describe, expect, it, vi } from "vitest";
import { applyGuardrails, hasEnoughFeedback, languagesOf, NotSureError, notEnoughFeedback, validateAnalysis, validateDraft, validated } from "../src/ai/guardrails";
import type { Lang, Message, Point, RawAnalysis } from "../src/types";

const msg = (id: string, lang: Lang = "en"): Message => ({ id, text: "x", lang, received_at: "2026-09-01", contact: null, synthetic: true });
const messages = [msg("m1"), msg("m2", "ko"), msg("m3", "ne"), msg("m4", "zh")];
const point = (ids: string[], en = "Guests loved the cooking class."): Point => ({ point_en: en, point_ne: "पाहुनालाई खाना पकाउने कक्षा मन पर्‍यो।", message_ids: ids });
const raw = (over: Partial<RawAnalysis>): RawAnalysis => ({ loved: [], wished: [], upgrade: [], uncertain: [], ...over });
const meta = { model: "test", seconds: 1 };

describe("rule 1: not enough data → no analysis", () => {
  it("7 of 8 messages is not enough, 8 is", () => {
    expect(hasEnoughFeedback(7, 8)).toBe(false);
    expect(hasEnoughFeedback(8, 8)).toBe(true);
  });
  it("returns an empty not_enough_feedback analysis", () => {
    const a = notEnoughFeedback(5, "test");
    expect(a.status).toBe("not_enough_feedback");
    expect([a.loved, a.wished, a.uncertain, a.upgrade]).toEqual([[], [], [], null]);
  });
});

describe("rule 2: citations to non-existent IDs are removed", () => {
  it("drops unknown IDs and duplicates, keeps real ones", () => {
    const a = applyGuardrails(raw({ loved: [point(["m1", "m99", "m2", "m1", "[m3]"])] }), messages, meta);
    expect(a.loved[0].message_ids).toEqual(["m1", "m2", "m3"]);
  });
});

describe("rule 3: points with < 2 valid citations move to uncertain", () => {
  it("one valid citation → uncertain, not displayed as a point", () => {
    const a = applyGuardrails(raw({ wished: [point(["m1", "m99"], "Guest wants Wi-Fi.")] }), messages, meta);
    expect(a.wished).toEqual([]);
    expect(a.uncertain[0].note_en).toBe("Only one guest mentioned: Guest wants Wi-Fi.");
  });
  it("a point with no valid citation is dropped entirely", () => {
    const a = applyGuardrails(raw({ loved: [point(["m98", "m99"])] }), messages, meta);
    expect(a.loved).toEqual([]);
    expect(a.uncertain).toEqual([]);
  });
  it("every displayed point cites ≥ 2 existing messages", () => {
    const a = applyGuardrails(raw({ loved: [point(["m1", "m2"]), point(["m3"])], wished: [point(["m3", "m4", "zz"])] }), messages, meta);
    const ids = new Set(messages.map((m) => m.id));
    for (const p of [...a.loved, ...a.wished]) {
      expect(p.message_ids.length).toBeGreaterThanOrEqual(2);
      expect(p.message_ids.every((id) => ids.has(id))).toBe(true);
    }
    expect(a.loved.length + a.wished.length).toBe(2);
  });
});

describe("rule 4: upgrade needs ≥ 2 citations", () => {
  it("weak upgrade becomes null and goes to uncertain", () => {
    const a = applyGuardrails(raw({ upgrade: [point(["m1"], "Add Wi-Fi.")] }), messages, meta);
    expect(a.upgrade).toBeNull();
    expect(a.uncertain[0].note_en).toContain("Add Wi-Fi.");
  });
  it("grounded upgrade is kept", () => {
    expect(applyGuardrails(raw({ upgrade: [point(["m1", "m2"])] }), messages, meta).upgrade?.message_ids).toEqual(["m1", "m2"]);
  });
});

describe("rule 5: schema failure → retry once → error", () => {
  const good = JSON.stringify(raw({ loved: [point(["m1", "m2"])] }));
  it("rejects wrong shapes", () => {
    expect(validateAnalysis(null)).toBeNull();
    expect(validateAnalysis({ loved: [] })).toBeNull();
    expect(validateAnalysis(raw({ loved: [{ point_en: "x", point_ne: "y" } as any] }))).toBeNull();
    expect(validateAnalysis(raw({ loved: [{ ...point(["m1"]), message_ids: [1] } as any] }))).toBeNull();
  });
  it("rejects a 'Nepali' field that is not in Devanagari", () => {
    expect(validateAnalysis(raw({ loved: [{ ...point(["m1", "m2"]), point_ne: "Guests loved it" }] }))).toBeNull();
    expect(validateDraft({ text: "감사합니다", text_ne: "Thank you" })).toBeNull();
    expect(validateDraft({ text: "감사합니다", text_ne: "धन्यवाद" })).not.toBeNull();
  });
  it("bad then good → one retry, valid result", async () => {
    const call = vi.fn().mockResolvedValueOnce("{not json").mockResolvedValueOnce(good);
    expect((await validated(call, validateAnalysis)).loved.length).toBe(1);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("bad twice → NotSureError, exactly 2 calls, nothing returned", async () => {
    const call = vi.fn().mockResolvedValue('{"loved": "oops"}');
    await expect(validated(call, validateAnalysis)).rejects.toBeInstanceOf(NotSureError);
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("languages per point are computed from cited messages", () => {
  it("unique languages in citation order", () => {
    expect(languagesOf(point(["m1", "m2", "m3", "m1"]), messages)).toEqual(["en", "ko", "ne"]);
  });
});
