# LOOP_LOG — measured prompt improvement (dev set only)

Each row is the mean of 2 runs of `npm run eval` on the **dev** set (`data/synthetic_messages.json`).
One change per iteration, only in `src/ai/prompts.ts`. Guardrails, data and truth files are never touched.
The held-out test set is not read here; it is run once at the end (see EVAL.md).

SCORE = theme_recall + 0.5 × min_per_language_recall + 0.25 (single mention handled) − 1 (any invalid citation). Max 1.75.

| iter | hypothesis | change | dev SCORE before → after | per-language recall (en/ko/hi/zh/ne) | kept? |
|---|---|---|---|---|---|
| 0 | baseline | first prompt | — → 1.475 (runs 1.30, 1.65) | 80 / 80 / 100 / 70 / 70 | — |
| 1 | Telling the model that a point usually has 5–10 supporting messages and to re-check every message should fix short citation lists, because it stops listing IDs after ~5. | one sentence added to the `message_ids` rule | 1.475 → 1.650 (runs 1.65, 1.65) | 100 / 80 / 80 / 100 / 80 | yes |
