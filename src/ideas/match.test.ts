import { describe, expect, it } from "vitest";
import { IDEAS, validateIdeasData } from "./data";
import { matchProblems, tokenize, type Section } from "./match";

const top = (point: string, section: Section) => matchProblems(point, section, IDEAS.problems)[0]?.tag ?? null;

describe("data files", () => {
  it("load and validate: 100 problems, 30 library ideas, 100 drafted ideas", () => {
    expect([IDEAS.problems.length, IDEAS.library.length, IDEAS.drafted.length]).toEqual([100, 30, 100]);
  });
  it("a broken file stops the feature", () => {
    expect(() => validateIdeasData(IDEAS.problems, IDEAS.library, [{ ...IDEAS.drafted[0], source_url: "x" }])).toThrow(/must not cite a source/);
    expect(() => validateIdeasData(IDEAS.problems, [{ id: "idea_99" }], IDEAS.drafted)).toThrow(/ideas_library/);
    expect(() => validateIdeasData({}, IDEAS.library, IDEAS.drafted)).toThrow();
  });
});

describe("1. matching a point to a problem (expected answers written before the code)", () => {
  it.each([
    ["Breakfast was too late for our early bus", "wished", "food_timing"],
    ["We got lost after the bus stop", "wished", "directions"],
    ["Loved the cooking class", "loved", "activities"],
    ["The room was very cold at night", "wished", "rooms"],
    ["There was no hot water to wash", "wished", "bathroom_water"],
    ["The food was far too spicy, full of chilli", "wished", "food"],
    ["Guests loved picking coffee cherries at harvest", "loved", "activities"],
    ["Purple elephants sing quietly on Tuesdays", "wished", null],
  ] as [string, Section, string | null][])("%s (%s) → %s", (point, section, tag) => expect(top(point, section)).toBe(tag));

  it("needs at least 2 keyword hits, returns at most 2 problems, best first", () => {
    expect(matchProblems("Breakfast", "wished", IDEAS.problems)).toEqual([]);
    const m = matchProblems("Breakfast was too late for our early bus", "wished", IDEAS.problems);
    expect(m.map((p) => p.id)).toEqual(["P015", "P017"]);
  });
  it("a phrase keyword must appear as a phrase", () => {
    expect(tokenize("The bus did not stop")).not.toContain("bus stop");
    expect(top("The bus did not stop", "wished")).toBeNull();
  });
});

describe("2. type filter", () => {
  it("a loved point never matches a wished problem, and the other way round", () => {
    for (const point of IDEAS.problems.map((p) => p.problem_en)) {
      expect(matchProblems(point, "loved", IDEAS.problems).every((p) => p.type === "loved")).toBe(true);
      expect(matchProblems(point, "wished", IDEAS.problems).every((p) => p.type === "wished")).toBe(true);
    }
    expect(top("Breakfast was too late for our early bus", "loved")).toBeNull();
  });
  it("the upgrade suggestion may match either type", () => {
    expect(top("Loved the cooking class", "upgrade")).toBe("activities");
    expect(top("The room was very cold at night", "upgrade")).toBe("rooms");
  });
});
