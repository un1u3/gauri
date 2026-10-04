// The prompts are language-neutral, but for a Nepali owner they must stay exactly the
// prompt that was evaluated: this model's results change a lot with small wording changes.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analysisSchema, analysisSystem, analysisUser, draftSchema, draftSystem, draftUser, uiSystem } from "../src/ai/prompts";
import type { Message } from "../src/types";

const dev: Message[] = JSON.parse(readFileSync("data/synthetic_messages.json", "utf8"));
const frozen = JSON.parse(readFileSync("tests/fixtures/evaluated_prompt.json", "utf8"));
const msg = (lang: string, text = "x"): Message => ({ id: "a", text, lang, received_at: "", contact: null, synthetic: false });

describe("Nepali owner = the evaluated prompt, byte for byte", () => {
  it("system prompt", () => expect(analysisSystem(dev, "ne")).toBe(frozen.system));
  it("user prompt", () => expect(analysisUser(dev)).toBe(frozen.user));
  it("schema", () => expect(JSON.stringify(analysisSchema("ne"))).toBe(frozen.schema));
});

describe("any other owner or guest language", () => {
  it("asks for the owner's language and script", () => {
    expect(analysisSystem(dev, "ar")).toContain('simple Arabic in Arabic script ("point_ar")');
    expect(analysisSystem(dev, "fr")).toContain('simple French ("point_fr")');
    expect(analysisSystem(dev, "fr")).not.toContain("Nepali in Devanagari");
    expect(Object.keys(analysisSchema("fr").properties.loved.items.properties)).toEqual(["point_en", "point_fr", "message_ids"]);
  });
  it("an English-reading owner gets one text per point, not two", () => {
    expect(Object.keys(analysisSchema("en").properties.loved.items.properties)).toEqual(["point_en", "message_ids"]);
    expect(analysisSystem(dev, "en")).toContain('simple English ("point_en"), for someone');
  });
  it("names the guest languages that are actually present", () => {
    expect(analysisSystem([msg("ja"), msg("fr"), msg("en")], "ne")).toContain("The messages are in English, French and Japanese.");
    expect(analysisSystem([msg("und")], "ne")).toContain("The messages may be in any language.");
  });
  it("drafts and app labels follow the owner's language", () => {
    expect(draftSystem("ne")).toContain('"text_ne" is the same reply in short, simple Nepali written in Devanagari script.');
    expect(draftSystem("es")).toContain('"text_es" is the same reply in short, simple Spanish.');
    expect(draftSchema("th").required).toEqual(["text", "text_th"]);
    expect(draftUser(msg("ja", "ありがとう"))).toContain("Guest's language: Japanese");
    expect(uiSystem("hi")).toContain("into Hindi in Devanagari script");
  });
});
