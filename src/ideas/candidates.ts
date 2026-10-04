// Step 2: gather the ideas the model may choose from. Code only.
import type { DraftedIdea, IdeasData, LibraryIdea, Problem } from "./data";

export type Candidate = { short: string } & ({ kind: "library"; idea: LibraryIdea } | { kind: "drafted"; idea: DraftedIdea });

export function gatherCandidates(matched: Problem[], data: IdeasData): Candidate[] {
  const drafted = matched.map((p) => data.drafted.find((d) => d.problem_id === p.id)).filter((d): d is DraftedIdea => !!d).slice(0, 2);
  const related = new Set(drafted.flatMap((d) => d.related_library_ids));
  const tags = new Set(matched.map((p) => p.tag));
  // Order: ideas written for the same problem first, then those she can use without internet or English.
  const rank = (e: LibraryIdea) => (related.has(e.id) ? 0 : !e.needs_internet && !e.needs_english ? 1 : 2);
  const library = data.library
    .filter((e) => related.has(e.id) || e.tags.some((t) => tags.has(t)))
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
    .slice(0, 3);
  return [
    ...library.map((idea, i): Candidate => ({ short: `L${i + 1}`, kind: "library", idea })),
    ...drafted.map((idea, i): Candidate => ({ short: `D${i + 1}`, kind: "drafted", idea })),
  ];
}
