# LOOP_LOG — measured prompt improvement (dev set only)

Each row is the mean of 2 runs of `npm run eval` on the **dev** set (`data/synthetic_messages.json`).
One change per iteration, only in `src/ai/prompts.ts`. Guardrails, data and truth files are never touched.
The held-out test set is not read here; it is run once at the end (see EVAL.md).

SCORE = theme_recall + 0.5 × min_per_language_recall + 0.25 (single mention handled) − 1 (any invalid citation). Max 1.75.

| iter | hypothesis | change | dev SCORE before → after | per-language recall (en/ko/hi/zh/ne) | kept? |
|---|---|---|---|---|---|
| 0 | baseline | first prompt | — → 1.475 (runs 1.30, 1.65) | 80 / 80 / 100 / 70 / 70 | — |
| 1 | Telling the model that a point usually has 5–10 supporting messages and to re-check every message should fix short citation lists, because it stops listing IDs after ~5. | one sentence added to the `message_ids` rule | 1.475 → 1.650 (runs 1.65, 1.65) | 100 / 80 / 80 / 100 / 80 | yes |
| 2 | Making the model label every message with a topic before writing points should fix missed citations, because each message is then considered on its own. | added a `labels` list as first schema field + 2 rules | 1.650 → 0.950 (runs 1.30, 0.60) | 70 / 50 / 60 / 40 / 60 | no (reverted) |
| 3 | A short reminder after the messages ("list ALL ids, including Korean, Hindi, Chinese, Nepali") should lift non-English recall, because small models attend most to the end of the input. | one reminder line appended to the user message | 1.650 → 0.950 (runs 0.95, 0.95) | 60 / 40 / 60 / 40 / 40 | no (reverted) |

**Stopped after iteration 3**: two iterations in a row did not improve SCORE (loop rule). Best version = iteration 1.

What we learned:
- The loop raised dev SCORE from 1.475 to 1.650 and the weakest language's recall from 70% to 80% with one added sentence.
- This small model is very sensitive to prompt wording: two reasonable-looking additions each cost 0.7 SCORE and lost a whole theme in some runs. More prompt text is not better.
- Themes are found reliably (4/4 in the baseline and in the kept version). The remaining weakness is incomplete citation lists (3 of 25 theme messages missed: one each in Korean, Hindi, Nepali). That looks like a model-size limit, not a prompt problem. The guardrails make this failure safe: a missed citation under-counts support, it never invents any.
