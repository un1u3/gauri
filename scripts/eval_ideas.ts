// Evaluates the "What can I improve?" feature.   npm run eval:ideas
//  1. Matching accuracy on 15 hand-written points (code only, no model).
//  2. The real local model on 5 of them: are the shown ids valid, how much model text the guardrails reject, seconds.
// The points and expected tags below were written before running; they are not taken from data/synthetic_*.json.
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_MIN_MESSAGES } from "../src/ai/guardrails";
import { lastModel } from "../src/ai/ollama";
import { DEFAULT_MODEL } from "../src/ai/prompts";
import { gatherCandidates } from "../src/ideas/candidates";
import { IDEAS } from "../src/ideas/data";
import { DEFAULT_PROFILE, getIdeas } from "../src/ideas/ideas";
import { matchProblems, type Section } from "../src/ideas/match";

const POINTS: [string, Section, string, boolean][] = [ // point, section, expected tag, run on the real model?
  ["Guests could not find the house because there is no signboard on the road", "wished", "directions", true],
  ["Several guests said the morning meal came too late", "wished", "food_timing", true],
  ["The rooms were cold at night and guests wanted more blankets", "wished", "rooms", true],
  ["Guests wished there was hot water for a shower", "wished", "bathroom_water", false],
  ["Too many flies near the food in the kitchen", "wished", "hygiene", false],
  ["Guests did not know the price until the end", "wished", "pricing_payment", false],
  ["Nobody could translate after the guide went home", "wished", "language", false],
  ["Guests loved the coffee picking and roasting", "loved", "activities", false],
  ["Guests enjoyed feeding the goats and milking the cow", "loved", "activities", true],
  ["They were afraid of the dogs when walking at night", "wished", "safety", false],
  ["Guests want to pay by card but we only take cash", "wished", "pricing_payment", false],
  ["Nobody answered the phone when they tried to book", "wished", "booking_enquiries", false],
  ["Guests could not find us on the map or online", "wished", "online_presence", false],
  ["Happy guests never come back or stay in touch", "wished", "reviews_referrals", true],
  ["The road was blocked by a landslide in the monsoon", "wished", "seasonal_operations", false],
];

const matched = POINTS.map(([point, section, expected]) => ({ point, expected, got: matchProblems(point, section, IDEAS.problems)[0]?.tag ?? "no match" }));
const correct = matched.filter((m) => m.got === m.expected).length;
console.log(`Matching accuracy: ${correct}/${POINTS.length}`);
for (const m of matched.filter((m) => m.got !== m.expected)) console.log(`  MISS  "${m.point}" → ${m.got} (expected ${m.expected})`);

const cfg = { baseUrl: "http://localhost:11434", model: DEFAULT_MODEL, minMessages: DEFAULT_MIN_MESSAGES, ownerLang: "ne" };
const runs = [];
for (const [point, section] of POINTS.filter((p) => p[3])) {
  const candidates = gatherCandidates(matchProblems(point, section, IDEAS.problems), IDEAS);
  const r = await getIdeas(point, section, DEFAULT_PROFILE, cfg, IDEAS);
  const valid = r.cards.every((c) => candidates.some((k) => k.idea.id === c.candidate.idea.id));
  runs.push({ point, status: r.status, seconds: r.seconds, cards: r.cards.length, withText: r.cards.filter((c) => c.how).length, valid });
  console.log(`\n"${point}" → ${r.status}, ${r.seconds}s`);
  for (const c of r.cards) console.log(`  [${c.candidate.short} ${c.candidate.idea.id}] ${c.how ? `${c.how}  | पहिलो कदम: ${c.first_step}` : "(model text rejected or missing → original idea shown)"}`);
}

const answered = runs.filter((r) => r.status === "ok");
const cards = answered.reduce((n, r) => n + r.cards, 0), withText = answered.reduce((n, r) => n + r.withText, 0);
const secs = answered.map((r) => r.seconds).sort((a, b) => a - b);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
const modelRows = answered.length
  ? `| Model runs that returned a valid answer | ${answered.length} of ${runs.length} (others fell back to the original ideas) |
| Points where every shown idea is one of the candidates | ${runs.filter((r) => r.valid).length} of ${runs.length} (enforced in code) |
| Chosen ideas whose model text was rejected by the guardrails | ${cards - withText} of ${cards} (${pct(cards - withText, cards)}); those cards show the original idea |
| Median seconds per point | ${secs[Math.floor(secs.length / 2)]} |`
  : `| Real-model run | NOT COMPLETED: the model did not answer (${runs.map((r) => r.status).join(", ")}); every point fell back to the original ideas |`;

const section = `## Ideas feature

Produced by \`npm run eval:ideas\` on ${new Date().toISOString().slice(0, 10)}. Model: ${lastModel || cfg.model}, owner language: Nepali, default profile.
The 15 points were written by hand before running and are not taken from the synthetic message sets.

| Metric | Result |
|---|---|
| Matching accuracy (point → problem tag, code only) | ${correct} of ${POINTS.length} (${pct(correct, POINTS.length)}) |
${matched.filter((m) => m.got !== m.expected).map((m) => `| Missed | "${m.point}" → ${m.got} (expected ${m.expected}) |`).join("\n")}
${modelRows}

Not measured: whether the Nepali explanations are good advice or natural Nepali. Every idea in the data files is still marked "not yet checked" by a person.
`.replace(/\n\n\n/g, "\n\n");

const evalMd = readFileSync("EVAL.md", "utf8").split("\n## Ideas feature")[0].trimEnd();
writeFileSync("EVAL.md", `${evalMd}\n\n${section}`);
