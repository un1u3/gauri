// The ideas knowledge files, bundled with the app (read-only, built and reviewed outside the app).
import problemsJson from "../../data/problem_catalog.json";
import libraryJson from "../../data/ideas_library.json";
import draftedJson from "../../data/drafted_ideas.json";

export type Review = { status: string; checked_by: string | null; checked_on: string | null; note: string | null };
export type Problem = { id: string; tag: string; type: "wished" | "loved"; problem_en: string; keywords_en: string[] };
export type LibraryIdea = {
  id: string; tags: string[]; idea_en: string; where: string; needs_internet: boolean; needs_english: boolean; cost: string;
  source_title: string; source_url: string; page: string; quote: string; quote_2?: string; review: Review;
};
// idea_ne is optional: the data is English only today; a checked Nepali text would be used if added.
export type DraftedIdea = { id: string; problem_id: string; label: "ai_drafted"; idea_en: string; idea_ne?: string; related_library_ids: string[]; review: Review };
export type IdeasData = { problems: Problem[]; library: LibraryIdea[]; drafted: DraftedIdea[] };

const isText = (x: unknown) => typeof x === "string" && x.trim().length > 0;

// Throws with the first problem found, so a broken data file stops the feature instead of showing half an idea.
export function validateIdeasData(problems: any, library: any, drafted: any): IdeasData {
  if (![problems, library, drafted].every(Array.isArray)) throw new Error("ideas data: each file must be a list");
  for (const p of problems)
    if (!isText(p.id) || !isText(p.tag) || !["wished", "loved"].includes(p.type) || !isText(p.problem_en) || !Array.isArray(p.keywords_en)) throw new Error(`problem_catalog: bad entry ${p.id}`);
  const libraryIds = new Set<string>();
  for (const e of library) {
    if (!isText(e.id) || !Array.isArray(e.tags) || !isText(e.idea_en) || !isText(e.source_title) || !isText(e.page) || !isText(e.quote) || typeof e.needs_internet !== "boolean" || typeof e.needs_english !== "boolean" || !isText(e.review?.status))
      throw new Error(`ideas_library: bad entry ${e.id}`);
    libraryIds.add(e.id);
  }
  const problemIds = new Set(problems.map((p: Problem) => p.id));
  for (const d of drafted) {
    if (!isText(d.id) || !problemIds.has(d.problem_id) || d.label !== "ai_drafted" || !isText(d.idea_en) || !Array.isArray(d.related_library_ids) || !isText(d.review?.status)) throw new Error(`drafted_ideas: bad entry ${d.id}`);
    if (d.source_url || d.quote) throw new Error(`drafted_ideas: ${d.id} must not cite a source`);
    if (!d.related_library_ids.every((id: string) => libraryIds.has(id))) throw new Error(`drafted_ideas: ${d.id} refers to an unknown library entry`);
  }
  return { problems, library, drafted };
}

export const IDEAS = validateIdeasData(problemsJson, libraryJson, draftedJson);
