// Step 1: match a summary point to known problems. Code only — the model is not involved.
import type { Problem } from "./data";

export type Section = "loved" | "wished" | "upgrade";
export const MIN_SCORE = 2;

const STOPWORDS = new Set("a an the and or but of to in on at for with from by as is are was were be been it its this that these those we our us they their them i my me you your he she his her not no so too very there here had has have did do does would could should will can just than then also when which who what how more most some any all into out up down over after before about".split(" "));

// Light word endings: "cooking", "cooks", "cooked" → "cook"; "earlier" → "early"; "times" → "time"; "cherries" → "cherry".
// The same rule is applied to the point and to the keywords, so it only has to be consistent.
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && w.endsWith("ier")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  w = SAME[w] ?? w;
  return w.length > 3 && w.endsWith("e") ? w.slice(0, -1) : w;
}
// Words the model often uses for a keyword in the catalog.
const SAME: Record<string, string> = { lesson: "class", signage: "sign", signboard: "sign", tour: "walk" };

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter((w) => w && !STOPWORDS.has(w)).map(stem);
}

// Number of the problem's keywords found in the point. A phrase like "bus stop" must appear as a phrase.
export function score(tokens: string[], problem: Problem): number {
  const joined = ` ${tokens.join(" ")} `;
  return new Set(problem.keywords_en.map((k) => tokenize(k).join(" ")).filter((k) => k && joined.includes(` ${k} `))).size;
}

// Top 2 problems of the right type with at least 2 keyword hits; ties go to the lower id. [] = no match.
export function matchProblems(pointEn: string, section: Section, problems: Problem[]): Problem[] {
  const tokens = tokenize(pointEn);
  return problems
    .filter((p) => section === "upgrade" || p.type === section)
    .map((p) => ({ p, s: score(tokens, p) }))
    .filter((x) => x.s >= MIN_SCORE)
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .slice(0, 2)
    .map((x) => x.p);
}
