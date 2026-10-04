# Evaluation (held-out test set)

Produced by `npm run eval -- --set test` on 2026-10-04. The test set was never read while tuning prompts;
tuning used the dev set only (see LOOP_LOG.md). All messages are synthetic.

| Metric | Result |
|---|---|
| Set | test (40 synthetic messages, mean of 2 runs) |
| Model | gemma4:e2b, 4.6 GB on disk |
| Theme recall (4 planted themes) | 100% |
| Per-language recall en / ko / hi / zh / ne | 80% / 20% / 80% / 80% / 100% |
| Weakest language | 20% |
| Single mention (Wi-Fi) not shown as a point | yes |
| Single mention (Wi-Fi) listed as uncertain | yes |
| Citation validity (displayed points) | 100% |
| Fewest citations on any displayed point | 3 |
| 5 messages → "not enough feedback", no model call | yes |
| Seconds per analysis | 38.5 |

**SCORE = 1.350** (theme_recall + 0.5 × weakest-language recall + 0.25 if the single mention is handled correctly − 1 if any displayed citation is invalid; max 1.75).

How to read this:
- *Theme recall*: a planted theme counts as found if a point of the right kind (loved / wished) cites at least 2 of its messages.
- *Per-language recall*: of the messages that express a planted theme in that language, the share the model cited under the right point. This is our language-bias check.
- Citation validity is enforced in code (guardrails), so it is 100% by construction; the model cannot display an uncited point.

## What the numbers say

**Works:** on messages it had never been tuned on, the model found all 4 planted themes in both runs, kept the
single Wi-Fi request out of the points and listed it under "not sure", and every displayed point cited at least
3 real messages.

**Language bias (the honest part):** Korean recall is **20%** on the test set (1 of 5 Korean theme messages cited,
in both runs), against 80–100% for the other four languages. On the dev set Korean was 80–90%, so the dev set
understated the problem. The Korean messages it missed are paraphrases ("the way here was hard to find", "breakfast
was late so our trek started late") rather than the most literal wording. The effect for the owner: a point still
appears, but with fewer Korean messages behind it than there really are, so Korean guests' voices are under-counted.
The app shows which languages are behind each point so she can see this, and all original messages stay readable
on the Messages screen.

**Not caught by this score:** in one test run the suggested upgrade said "earlier breakfast, perhaps around 9 AM or
sooner". Guests said breakfast came *after nine*; the "around 9 AM" detail is the model's wording, not a guest's.
The citations were valid, so the guardrails let it through. This is why the screen ends with "This is only a
suggestion. The decision is yours." and why every point opens the original messages.

**Run-to-run variation:** even with `temperature: 0` and a fixed seed, two runs on the same input can differ
(dev baseline: 1.30 and 1.65). All numbers here are means of 2 runs.

## Dev set and the improvement loop

| | dev SCORE | en / ko / hi / zh / ne |
|---|---|---|
| Baseline prompt | 1.475 | 80 / 80 / 100 / 70 / 70 |
| After the loop (1 kept change of 3 tried) | 1.650 | 100 / 90 / 100 / 100 / 80 |
| **Held-out test, same prompt** | **1.350** | **80 / 20 / 80 / 80 / 100** |

Details of each iteration are in LOOP_LOG.md. The gap between dev (1.650) and test (1.350) is the reason we keep a
held-out set: the dev number alone would have hidden the Korean weakness.

## Ideas feature

Produced by `npm run eval:ideas` on 2026-10-04. Model: gemma4-e2b-text, owner language: Nepali, default profile.
The 15 points were written by hand before running and are not taken from the synthetic message sets.

| Metric | Result |
|---|---|
| Matching accuracy (point → problem tag, code only) | 13 of 15 (87%) |
| Missed | "Guests did not know the price until the end" → no match (expected pricing_payment) |
| Missed | "Guests loved the coffee picking and roasting" → food (expected activities) |
| Model runs that returned a valid answer | 5 of 5 (others fell back to the original ideas) |
| Points where every shown idea is one of the candidates | 5 of 5 (enforced in code) |
| Chosen ideas whose model text was rejected by the guardrails | 0 of 9 (0%); those cards show the original idea |
| Median seconds per point | 11 |

Not measured: whether the Nepali explanations are good advice or natural Nepali. Every idea in the data files is still marked "not yet checked" by a person.
