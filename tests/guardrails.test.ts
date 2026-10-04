import { describe, expect, it, vi } from "vitest";
import { applyGuardrails, hasEnoughFeedback, languagesOf, NotSureError, notEnoughFeedback, validateAnalysis, validateDraft, validated } from "../src/ai/guardrails";
import type { Lang, Message, Point, RawAnalysis } from "../src/types";

const msg = (id: string, lang: Lang = "en"): Message => ({ id, text: "x", lang, received_at: "2026-09-01", contact: null, synthetic: true });
const messages = [msg("m1"), msg("m2", "ko"), msg("m3", "ne"), msg("m4", "zh")];
const NE = "पाहुनालाई खाना पकाउने कक्षा मन पर्‍यो।";
const point = (ids: string[], en = "Guests loved the cooking class."): Point => ({ point_en: en, point_own: NE, message_ids: ids });
// A model reply for an owner who reads `lang`: the owner-language text sits under "point_<lang>".
const reply = (lang: string, own: string, ids = ["m1", "m2"]) => ({ loved: [{ point_en: "Guests loved the cooking class.", [`point_${lang}`]: own, message_ids: ids }], wished: [], upgrade: [], uncertain: [] });
const raw = (over: Partial<RawAnalysis>): RawAnalysis => ({ loved: [], wished: [], upgrade: [], uncertain: [], ...over });
const meta = { model: "test", seconds: 1, lang: "ne" };

describe("rule 1: not enough data → no analysis", () => {
  it("7 of 8 messages is not enough, 8 is", () => {
    expect(hasEnoughFeedback(7, 8)).toBe(false);
    expect(hasEnoughFeedback(8, 8)).toBe(true);
  });
  it("returns an empty not_enough_feedback analysis", () => {
    const a = notEnoughFeedback(5, "test", "ne");
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
    expect(a.uncertain[0]).toEqual({ note_en: "Guest wants Wi-Fi.", note_own: NE, reason: "single_guest" });
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

it("raw message ids are removed from the model's own 'not sure' notes", () => {
  const a = applyGuardrails(raw({ uncertain: [{ note_en: "Is the farm open in December? [m01]", note_own: "डिसेम्बरमा खुला छ? (m01)" }] }), messages, meta);
  expect(a.uncertain[0]).toEqual({ note_en: "Is the farm open in December?", note_own: "डिसेम्बरमा खुला छ?" });
});

describe("rule 4: upgrade needs ≥ 2 citations", () => {
  it("weak upgrade becomes null and goes to uncertain", () => {
    const a = applyGuardrails(raw({ upgrade: [point(["m1"], "Add Wi-Fi.")] }), messages, meta);
    expect(a.upgrade).toBeNull();
    expect(a.uncertain[0]).toMatchObject({ note_en: "Add Wi-Fi.", reason: "weak_upgrade" });
  });
  it("grounded upgrade is kept", () => {
    expect(applyGuardrails(raw({ upgrade: [point(["m1", "m2"])] }), messages, meta).upgrade?.message_ids).toEqual(["m1", "m2"]);
  });
});

describe("rule 5: schema failure → retry once → error", () => {
  const good = JSON.stringify(reply("ne", NE));
  const validate = (x: unknown) => validateAnalysis(x, "ne");
  it("rejects wrong shapes", () => {
    expect(validate(null)).toBeNull();
    expect(validate({ loved: [] })).toBeNull();
    expect(validate({ ...reply("ne", NE), loved: [{ point_en: "x", point_ne: NE }] })).toBeNull();
    expect(validate(reply("ne", NE, [1] as any))).toBeNull();
    expect(validate(reply("ne", NE))?.loved[0]).toEqual({ point_en: "Guests loved the cooking class.", point_own: NE, message_ids: ["m1", "m2"] });
  });
  it("rejects owner-language text that is not in the owner's language — for any language", () => {
    expect(validate(reply("ne", "Guests loved it"))).toBeNull();
    expect(validateAnalysis(reply("ar", "Guests loved it"), "ar")).toBeNull();
    expect(validateAnalysis(reply("ar", "أحب الضيوف درس الطبخ"), "ar")).not.toBeNull();
    expect(validateAnalysis(reply("ko", NE), "ko")).toBeNull();
    expect(validateAnalysis(reply("ja", "ゲストは料理教室が大好きでした"), "ja")).not.toBeNull();
    expect(validateAnalysis(reply("ne", NE), "fr")).toBeNull(); // asked for French, got "point_ne"
  });
  it("Latin-script owner language: accepted, unless it is just the English text again", () => {
    expect(validateAnalysis(reply("fr", "Les invités ont adoré le cours de cuisine."), "fr")).not.toBeNull();
    expect(validateAnalysis(reply("fr", "Guests loved the cooking class."), "fr")).toBeNull();
  });
  it("an owner who reads English needs only the English text", () => {
    expect(validateAnalysis({ loved: [{ point_en: "Good food", message_ids: ["m1", "m2"] }], wished: [], upgrade: [], uncertain: [{ note_en: "Wi-Fi?" }] }, "en")?.loved[0].point_own).toBe("Good food");
  });
  it("drafts: the meaning must be in the owner's language", () => {
    expect(validateDraft({ text: "감사합니다", text_ne: "Thank you" }, "ne")).toBeNull();
    expect(validateDraft({ text: "감사합니다", text_ne: "धन्यवाद" }, "ne")).toEqual({ text: "감사합니다", text_own: "धन्यवाद" });
    expect(validateDraft({ text: "감사합니다", text_th: "ขอบคุณ" }, "th")).not.toBeNull();
  });
  it("bad then good → one retry, valid result", async () => {
    const call = vi.fn().mockResolvedValueOnce("{not json").mockResolvedValueOnce(good);
    expect((await validated(call, validate)).loved.length).toBe(1);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("bad twice → NotSureError, exactly 2 calls, nothing returned", async () => {
    const call = vi.fn().mockResolvedValue('{"loved": "oops"}');
    await expect(validated(call, validate)).rejects.toBeInstanceOf(NotSureError);
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe("languages per point are computed from cited messages", () => {
  it("unique languages in citation order", () => {
    expect(languagesOf(point(["m1", "m2", "m3", "m1"]), messages)).toEqual(["en", "ko", "ne"]);
  });
});
