// Runs the real local model on a synthetic set and scores it against the ground truth.
//   npm run eval                 (dev set, used for tuning)
//   npm run eval -- --set test   (held-out set; also writes EVAL.md)
//   npm run eval -- --set sample (the realistic sample shown in the app: 7 themes, 9 languages)
//   npm run eval -- --set final  (second held-out set, written after the first had been inspected)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { analyse } from "../src/ai/analyse";
import { DEFAULT_MIN_MESSAGES } from "../src/ai/guardrails";
import { DEFAULT_MODEL } from "../src/ai/prompts";
import { EVAL_LANGS as LANGS, type Analysis, type Lang, type Message, type Point } from "../src/types";

type Theme = { id: string; type: "loved" | "wished" | "single"; name: string; message_ids: string[] };

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const set = arg("set", "dev");
const runs = Number(arg("runs", "2"));
const files = set === "test" ? ["synthetic_test.json", "synthetic_test_truth.json"] : set === "final" ? ["synthetic_final.json", "synthetic_final_truth.json"] : set === "sample" ? ["sample_reviews.json", "sample_reviews_truth.json"] : ["synthetic_messages.json", "synthetic_truth.json"];
const messages: Message[] = JSON.parse(readFileSync(`data/${files[0]}`, "utf8"));
const themes: Theme[] = JSON.parse(readFileSync(`data/${files[1]}`, "utf8")).themes;
const cfg = { baseUrl: "http://localhost:11434", model: arg("model", DEFAULT_MODEL), minMessages: DEFAULT_MIN_MESSAGES, ownerLang: "ne", secondLook: !process.argv.includes("--no-second-look") };

// Languages that have theme messages in this set: the five evaluated ones first, then any others.
const themeLangs = new Set(themes.filter((t) => t.type !== "single").flatMap((t) => t.message_ids).map((id) => messages.find((m) => m.id === id)!.lang));
const SET_LANGS: Lang[] = [...LANGS.filter((l) => themeLangs.has(l)), ...[...themeLangs].filter((l) => !LANGS.includes(l)).sort()];

const overlap = (p: Point, ids: string[]) => p.message_ids.filter((id) => ids.includes(id)).length;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x: number) => `${Math.round(x * 100)}%`;

function score(a: Analysis) {
  const known = new Set(messages.map((m) => m.id));
  const langOf = new Map(messages.map((m) => [m.id, m.lang]));
  const grouped = themes.filter((t) => t.type !== "single");
  const singles = themes.filter((t) => t.type === "single").flatMap((t) => t.message_ids);

  // A theme is found if a point of the right type cites ≥ 2 of its ground-truth messages.
  const matched = grouped.map((t) => ({ t, points: a[t.type as "loved" | "wished"].filter((p) => overlap(p, t.message_ids) >= 2) }));
  const themes_found = Object.fromEntries(matched.map(({ t, points }) => [t.id, points.length > 0]));
  const theme_recall = mean(matched.map(({ points }) => (points.length ? 1 : 0)));

  // Per language: share of ground-truth theme messages cited under their correct theme.
  const hit: Record<string, number> = {}, total: Record<string, number> = {};
  for (const { t, points } of matched)
    for (const id of t.message_ids) {
      const l = langOf.get(id)!;
      total[l] = (total[l] ?? 0) + 1;
      if (points.some((p) => p.message_ids.includes(id))) hit[l] = (hit[l] ?? 0) + 1;
    }
  const per_language = Object.fromEntries(SET_LANGS.map((l) => [l, (hit[l] ?? 0) / total[l]])) as Record<Lang, number>;
  const min_language = Math.min(...Object.values(per_language));

  // The single-mention theme must not be shown as a point; it should be listed as uncertain.
  const displayed = [...a.loved, ...a.wished, ...(a.upgrade ? [a.upgrade] : [])];
  const t5_not_a_point = !displayed.some((p) => overlap(p, singles) > 0); // no single mention is shown as a point
  const t5_in_uncertain = a.uncertain.some((u) => /wi-?fi|internet|वाइ|वाई|इन्टरनेट/i.test(u.note_en + u.note_own));
  const t5_correct = t5_not_a_point && t5_in_uncertain;

  // Precision: of the messages cited under loved / wished points, the share that truly express that point's theme.
  let cited = 0, right = 0;
  for (const kind of ["loved", "wished"] as const)
    for (const p of a[kind]) {
      const best = Math.max(0, ...grouped.filter((t) => t.type === kind).map((t) => overlap(p, t.message_ids)));
      cited += p.message_ids.length;
      right += best;
    }
  const citation_precision = cited ? right / cited : 1;

  const cites = displayed.flatMap((p) => p.message_ids);
  const citation_validity = cites.length ? cites.filter((id) => known.has(id)).length / cites.length : 1;
  const min_citations = displayed.length ? Math.min(...displayed.map((p) => p.message_ids.length)) : 0;

  const SCORE = theme_recall + 0.5 * min_language + (t5_correct ? 0.25 : 0) - (citation_validity < 1 ? 1 : 0);
  return { SCORE, theme_recall, themes_found, per_language, min_language, t5_correct, t5_not_a_point, t5_in_uncertain, citation_validity, citation_precision, min_citations, n_points: displayed.length, seconds: a.seconds };
}


const few = await analyse(messages.slice(0, 5), cfg);
const not_enough_ok = few.status === "not_enough_feedback";

const results: (ReturnType<typeof score> & { analysis: Analysis })[] = [];
for (let i = 0; i < runs; i++) {
  try {
    const analysis = await analyse(messages, cfg);
    results.push({ ...score(analysis), analysis });
    console.log(`run ${i + 1}: SCORE ${results[i].SCORE.toFixed(3)} (${analysis.seconds}s)`);
  } catch (e) {
    console.error(`run ${i + 1} failed:`, e);
    process.exit(1);
  }
}

// Report the model that actually answered (the text-only copy, when it exists) and its size on disk.
const model = results[0].analysis.model;
const tags = await (await fetch(`${cfg.baseUrl}/api/tags`)).json();
const sizeBytes: number = tags.models.find((m: any) => m.name === model || m.name === `${model}:latest`)?.size ?? 0;
const model_size_gb = +(sizeBytes / 1e9).toFixed(1);

const avg = (f: (r: (typeof results)[number]) => number) => +mean(results.map(f)).toFixed(3);
const summary = {
  set, model, model_size_gb, n_messages: messages.length, runs, at: new Date().toISOString(),
  SCORE: avg((r) => r.SCORE),
  theme_recall: avg((r) => r.theme_recall),
  per_language: Object.fromEntries(SET_LANGS.map((l) => [l, avg((r) => r.per_language[l])])) as Record<Lang, number>,
  min_language: avg((r) => r.min_language),
  t5_correct: results.every((r) => r.t5_correct),
  t5_not_a_point: results.every((r) => r.t5_not_a_point),
  t5_in_uncertain: results.every((r) => r.t5_in_uncertain),
  citation_validity: avg((r) => r.citation_validity),
  citation_precision: avg((r) => r.citation_precision),
  second_look: cfg.secondLook,
  min_citations_per_point: Math.min(...results.map((r) => r.min_citations)),
  seconds: avg((r) => r.seconds),
  not_enough_ok,
  themes_found: results.map((r) => r.themes_found),
};

const L = summary.per_language;
const table = `| Metric | Result |
|---|---|
| Set | ${set} (${messages.length} synthetic messages, mean of ${runs} runs) |
| Model | ${model}, ${model_size_gb} GB on disk |
| Theme recall (${themes.filter((t) => t.type !== "single").length} planted themes) | ${pct(summary.theme_recall)} |
| Per-language recall ${SET_LANGS.join(" / ")} | ${SET_LANGS.map((l) => pct(L[l])).join(" / ")} |
| Weakest language | ${pct(summary.min_language)} |
| Single mentions not shown as a point | ${summary.t5_not_a_point ? "yes" : "NO"} |
| Single mention (Wi-Fi) listed as uncertain | ${summary.t5_in_uncertain ? "yes" : "NO"} |
| Citation validity (displayed points) | ${pct(summary.citation_validity)} |
| Citation precision (cited message really expresses that theme) | ${pct(summary.citation_precision)} |
| Fewest citations on any displayed point | ${summary.min_citations_per_point} |
| 5 messages → "not enough feedback", no model call | ${not_enough_ok ? "yes" : "NO"} |
| Seconds per analysis | ${summary.seconds} |`;
console.log(`\n${table}\n\nSCORE = ${summary.SCORE.toFixed(3)}  (theme_recall + 0.5 × min_per_language_recall + 0.25 if T5 correct − 1 if citation validity < 100%)\n`);

const all = existsSync("eval_results.json") ? JSON.parse(readFileSync("eval_results.json", "utf8")) : {};
all[set] = { summary, runs: results };
writeFileSync("eval_results.json", JSON.stringify(all, null, 1) + "\n");

if (set === "test") {
  // Everything from "## What the numbers say" on is written by hand (and by eval:ideas): keep it.
  const kept = existsSync("EVAL.md") ? readFileSync("EVAL.md", "utf8").split("\n## What the numbers say")[1] : undefined;
  writeFileSync("EVAL.md", `# Evaluation (held-out test set)

Produced by \`npm run eval -- --set test\` on ${summary.at.slice(0, 10)}. The test set was never read while tuning prompts;
tuning used the dev set only (see LOOP_LOG.md). All messages are synthetic.

${table}

**SCORE = ${summary.SCORE.toFixed(3)}** (theme_recall + 0.5 × weakest-language recall + 0.25 if the single mention is handled correctly − 1 if any displayed citation is invalid; max 1.75).

How to read this:
- *Theme recall*: a planted theme counts as found if a point of the right kind (loved / wished) cites at least 2 of its messages.
- *Per-language recall*: of the messages that express a planted theme in that language, the share the model cited under the right point. This is our language-bias check.
- *Citation precision*: of the messages cited under a point, the share that really express that point's theme. It guards against raising recall by citing everything.
- Citation validity is enforced in code (guardrails), so it is 100% by construction; the model cannot display an uncited point.
${kept === undefined ? "" : `\n## What the numbers say${kept}`}`);
}
