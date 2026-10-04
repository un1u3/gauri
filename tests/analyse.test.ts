// Pipeline tests with a fake Ollama (no real model): rules 4 and 6 end to end.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { analyse, draftThanks } from "../src/ai/analyse";
import { NotSureError } from "../src/ai/guardrails";
import { OllamaError } from "../src/ai/ollama";
import type { Message } from "../src/types";

const messages: Message[] = JSON.parse(readFileSync("data/synthetic_messages.json", "utf8"));
const cfg = { baseUrl: "http://localhost:11434", model: "fake", minMessages: 8, ownerLang: "ne", secondLook: false };
const reply = (content: string) => new Response(JSON.stringify({ message: { content } }));
const fakeFetch = (...contents: string[]) => {
  const f = vi.fn();
  for (const c of contents) f.mockResolvedValueOnce(reply(c));
  vi.stubGlobal("fetch", f);
  return f;
};
afterEach(() => vi.unstubAllGlobals());

describe("analyse", () => {
  it("fewer than MIN_MESSAGES → not_enough_feedback and the model is NOT called", async () => {
    const f = fakeFetch();
    const a = await analyse(messages.slice(0, 5), cfg);
    expect(a.status).toBe("not_enough_feedback");
    expect(a.n_messages).toBe(5);
    expect(f).not.toHaveBeenCalled();
  });
  it("valid output goes through the guardrails; request is local, non-streaming, schema-bound", async () => {
    const f = fakeFetch(JSON.stringify({
      loved: [{ point_en: "Cooking class", point_ne: "खाना पकाउने कक्षा", message_ids: ["m02", "m03", "nope"] }],
      wished: [{ point_en: "Wi-Fi", point_ne: "वाइफाइ", message_ids: ["m04"] }],
      upgrade: [], uncertain: [],
    }));
    const a = await analyse(messages, cfg);
    expect(a.loved[0].message_ids).toEqual(["m02", "m03"]);
    expect(a.wished).toEqual([]);
    expect(a.uncertain.length).toBe(1);
    const [url, init] = f.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("http://localhost:11434/api/chat");
    expect([body.stream, body.think, body.options.temperature]).toEqual([false, false, 0]);
    expect(body.format.required).toContain("uncertain");
    expect([a.lang, a.loved[0].point_own]).toEqual(["ne", "खाना पकाउने कक्षा"]);
  });
  it("owner reads another language → asks for and accepts that language, rejects Nepali", async () => {
    const points = (key: string, text: string) => JSON.stringify({ loved: [{ point_en: "Cooking class", [key]: text, message_ids: ["m02", "m03"] }], wished: [], upgrade: [], uncertain: [] });
    const f = fakeFetch(points("point_ja", "料理教室がよかった"));
    const a = await analyse(messages, { ...cfg, ownerLang: "ja" });
    expect([a.lang, a.loved[0].point_own]).toEqual(["ja", "料理教室がよかった"]);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('simple Japanese in Japanese script ("point_ja")');
    expect(body.format.properties.loved.items.required).toEqual(["point_en", "point_ja", "message_ids"]);
    fakeFetch(points("point_ne", "खाना पकाउने कक्षा"), points("point_ja", "खाना पकाउने कक्षा"));
    await expect(analyse(messages, { ...cfg, ownerLang: "ja" })).rejects.toBeInstanceOf(NotSureError);
  });
  it("invalid output twice → NotSureError after exactly one retry", async () => {
    const f = fakeFetch("I think guests were happy!", '{"loved":[]}');
    await expect(analyse(messages, cfg)).rejects.toBeInstanceOf(NotSureError);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("Ollama stopped → clear OllamaError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(analyse(messages, cfg)).rejects.toBeInstanceOf(OllamaError);
  });
});

describe("second look: citations the first pass missed", () => {
  const first = JSON.stringify({
    loved: [{ point_en: "Cooking class", point_ne: "खाना पकाउने कक्षा", message_ids: ["m04", "m18"] }],
    wished: [{ point_en: "Breakfast late", point_ne: "खाना ढिलो", message_ids: ["m03", "m20"] }],
    upgrade: [], uncertain: [],
  });
  const on = { ...cfg, secondLook: true };
  it("adds only real, not-yet-cited messages, each to one displayed point", async () => {
    const f = fakeFetch(first, JSON.stringify({ matches: [
      { id: "m06", point: "P1" }, { id: "[m15]", point: "P2" },   // genuine additions
      { id: "m04", point: "P2" },                                  // already cited → ignored
      { id: "zz9", point: "P1" },                                  // no such message → ignored
      { id: "m27", point: "none" }, { id: "m31", point: "P7" },    // none / unknown point → ignored
      { id: "m06", point: "P2" },                                  // a message supports one point only
    ] }));
    const a = await analyse(messages, on);
    expect(a.loved[0].message_ids).toEqual(["m04", "m18", "m06"]);
    expect(a.wished[0].message_ids).toEqual(["m03", "m20", "m15"]);
    const second = JSON.parse(f.mock.calls[1][1].body);
    expect(second.messages[1].content).toContain("P1 (guests loved): Cooking class");
    expect(second.messages[1].content).not.toContain("[m04]"); // only uncited messages are asked about
    expect(second.format.properties.matches.items.properties.point.enum).toEqual(["P1", "P2", "none"]);
  });
  it("if the second look fails, the first-pass summary stands", async () => {
    fakeFetch(first, "not json", "still not json");
    const a = await analyse(messages, on);
    expect([a.status, a.loved[0].message_ids, a.wished[0].message_ids]).toEqual(["ok", ["m04", "m18"], ["m03", "m20"]]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(first)).mockRejectedValue(new TypeError("fetch failed")));
    expect((await analyse(messages, on)).loved[0].message_ids).toEqual(["m04", "m18"]);
  });
});

describe("text-only copy of the model", () => {
  const good = JSON.stringify({ loved: [], wished: [], upgrade: [], uncertain: [] });
  it("is used when it exists; the full model is used when it does not", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))   // gemma4-e2b-text not created
      .mockResolvedValueOnce(reply(good))                            // gemma4:e2b answers
      .mockResolvedValueOnce(reply(good));                           // next call goes straight to the full model
    vi.stubGlobal("fetch", f);
    const a = await analyse(messages, { ...cfg, model: "gemma4:e2b" });
    await analyse(messages, { ...cfg, model: "gemma4:e2b" });
    expect(f.mock.calls.map((c) => JSON.parse(c[1].body).model)).toEqual(["gemma4-e2b-text", "gemma4:e2b", "gemma4:e2b"]);
    expect(a.model).toBe("gemma4:e2b");
  });
  it("a missing model that has no text-only copy is reported as missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    await expect(analyse(messages, cfg)).rejects.toMatchObject({ message: "model_missing" });
  });
});

describe("draftThanks", () => {
  it("returns a pending draft; a draft without Nepali meaning is rejected", async () => {
    fakeFetch(JSON.stringify({ text: "감사합니다!", text_ne: "धन्यवाद!" }));
    const d = await draftThanks(messages[2], cfg);
    expect([d.status, d.lang, d.message_id, d.text_own, d.own_lang]).toEqual(["pending", messages[2].lang, messages[2].id, "धन्यवाद!", "ne"]);
    fakeFetch('{"text":"Thanks","text_ne":"Thanks"}', '{"text":"Thanks","text_ne":"Thanks"}');
    await expect(draftThanks(messages[2], cfg)).rejects.toBeInstanceOf(NotSureError);
  });
});
