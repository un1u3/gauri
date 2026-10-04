// Pipeline tests with a fake Ollama (no real model): rules 4 and 6 end to end.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { analyse, draftThanks } from "../src/ai/analyse";
import { NotSureError } from "../src/ai/guardrails";
import { OllamaError } from "../src/ai/ollama";
import type { Message } from "../src/types";

const messages: Message[] = JSON.parse(readFileSync("data/synthetic_messages.json", "utf8"));
const cfg = { baseUrl: "http://localhost:11434", model: "fake", minMessages: 8 };
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

describe("draftThanks", () => {
  it("returns a pending draft; a draft without Nepali meaning is rejected", async () => {
    fakeFetch(JSON.stringify({ text: "감사합니다!", text_ne: "धन्यवाद!" }));
    const d = await draftThanks(messages[2], cfg);
    expect([d.status, d.lang, d.message_id]).toEqual(["pending", messages[2].lang, messages[2].id]);
    fakeFetch('{"text":"Thanks","text_ne":"Thanks"}', '{"text":"Thanks","text_ne":"Thanks"}');
    await expect(draftThanks(messages[2], cfg)).rejects.toBeInstanceOf(NotSureError);
  });
});
