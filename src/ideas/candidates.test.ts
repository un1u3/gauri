import { describe, expect, it } from "vitest";
import { gatherCandidates } from "./candidates";
import { IDEAS, type IdeasData, type LibraryIdea } from "./data";
import { matchProblems } from "./match";

const review = { status: "pending", checked_by: null, checked_on: null, note: null };
const lib = (id: string, tags: string[], needs_internet = false, needs_english = false): LibraryIdea =>
  ({ id, tags, idea_en: id, where: "", needs_internet, needs_english, cost: "unknown", source_title: "t", source_url: "u", page: "p", quote: "q", review });

describe("3. candidates", () => {
  it("real data: related library ideas first, then drafted; at most 5", () => {
    const c = gatherCandidates(matchProblems("Breakfast was too late for our early bus", "wished", IDEAS.problems), IDEAS);
    expect(c.map((x) => [x.short, x.idea.id])).toEqual([["L1", "idea_03"], ["L2", "idea_04"], ["L3", "idea_05"], ["D1", "draft_P015"], ["D2", "draft_P017"]]);
  });
  it("never more than 3 library + 2 drafted, library before drafted", () => {
    for (const p of IDEAS.problems) {
      const c = gatherCandidates([p, IDEAS.problems[0]], IDEAS);
      expect(c.filter((x) => x.kind === "library").length).toBeLessThanOrEqual(3);
      expect(c.filter((x) => x.kind === "drafted").length).toBeLessThanOrEqual(2);
      expect(c.map((x) => x.kind).join()).toMatch(/^(library,?)*(drafted,?)*$/);
    }
  });
  it("ranking: related → usable without internet and English → the rest", () => {
    const problems = [{ id: "P001", tag: "food", type: "wished" as const, problem_en: "x", keywords_en: [] }];
    const data: IdeasData = {
      problems,
      library: [lib("a_net", ["food"], true), lib("b_english", ["food"], false, true), lib("c_plain", ["food"]), lib("d_related", ["rooms"], true, true), lib("e_other_tag", ["rooms"])],
      drafted: [{ id: "draft_P001", problem_id: "P001", label: "ai_drafted", idea_en: "y", related_library_ids: ["d_related"], review }],
    };
    expect(gatherCandidates(problems, data).map((x) => x.idea.id)).toEqual(["d_related", "c_plain", "a_net", "draft_P001"]);
  });
  it("no matched problem → no candidates", () => expect(gatherCandidates([], IDEAS)).toEqual([]));
});
