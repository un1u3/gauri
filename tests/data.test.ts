// The synthetic sets must keep the planted structure the evaluation relies on.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EVAL_LANGS as LANGS, type Message } from "../src/types";

const load = (f: string) => JSON.parse(readFileSync(`data/${f}`, "utf8"));
const sets = [["synthetic_messages.json", "synthetic_truth.json"], ["synthetic_test.json", "synthetic_test_truth.json"], ["synthetic_final.json", "synthetic_final_truth.json"]];

describe.each(sets)("%s", (messagesFile, truthFile) => {
  const messages: Message[] = load(messagesFile);
  const themes: { id: string; type: string; message_ids: string[] }[] = load(truthFile).themes;
  const byId = new Map(messages.map((m) => [m.id, m]));
  const theme = (id: string) => themes.find((t) => t.id === id)!;

  it("~40 messages, all synthetic, unique IDs, ≥ 6 per language, ~half with contacts", () => {
    expect(messages.length).toBe(40);
    expect(messages.every((m) => m.synthetic)).toBe(true);
    expect(byId.size).toBe(40);
    for (const l of LANGS) expect(messages.filter((m) => m.lang === l).length).toBeGreaterThanOrEqual(6);
    expect(messages.filter((m) => m.contact).length).toBe(20);
  });
  it("themes have the planted sizes and each spans ≥ 3 languages", () => {
    const min = { T1: 6, T2: 5, T3: 4, T4: 4 };
    for (const [id, n] of Object.entries(min)) {
      expect(theme(id).message_ids.length).toBeGreaterThanOrEqual(n);
      expect(new Set(theme(id).message_ids.map((m) => byId.get(m)!.lang)).size).toBeGreaterThanOrEqual(3);
    }
    expect(theme("T5").message_ids.length).toBe(1);
  });
});

it("the three sets share no message text", () => {
  const texts = ["synthetic_messages.json", "synthetic_test.json", "synthetic_final.json"].flatMap((f) => (load(f) as Message[]).map((m) => m.text));
  expect(new Set(texts).size).toBe(120);
});
it("real data slot exists and is a Message[]", () => {
  expect(Array.isArray(load("real_messages.json"))).toBe(true);
});
