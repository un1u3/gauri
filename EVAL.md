# Evaluation (held-out test set)

Produced by `npm run eval -- --set test` on 2026-10-04. The test set was never read while tuning prompts;
tuning used the dev set only (see LOOP_LOG.md). All messages are synthetic.

| Metric | Result |
|---|---|
| Set | test (40 synthetic messages, mean of 2 runs) |
| Model | gemma4-e2b-text, 3.6 GB on disk |
| Theme recall (4 planted themes) | 100% |
| Per-language recall en / ko / hi / zh / ne | 80% / 80% / 100% / 100% / 100% |
| Weakest language | 80% |
| Single mention (Wi-Fi) not shown as a point | yes |
| Single mention (Wi-Fi) listed as uncertain | in 1 of 2 runs (left out altogether in the other) |
| Citation validity (displayed points) | 100% |
| Citation precision (cited message really expresses that theme) | 100% |
| Fewest citations on any displayed point | 4 |
| 5 messages → "not enough feedback", no model call | yes |
| Seconds per analysis | 55.5 |

**SCORE = 1.525** (theme_recall + 0.5 × weakest-language recall + 0.25 if the single mention is handled correctly − 1 if any displayed citation is invalid; max 1.75).

How to read this:
- *Theme recall*: a planted theme counts as found if a point of the right kind (loved / wished) cites at least 2 of its messages.
- *Per-language recall*: of the messages that express a planted theme in that language, the share cited under the right point. This is our language-bias check.
- *Citation precision*: of the messages cited under a point, the share that really express that point's theme. It guards against raising recall by citing everything.
- Citation validity is enforced in code (guardrails), so it is 100% by construction; the model cannot display an uncited point.

## What the numbers say

**Works:** on the held-out messages the model found all 4 planted themes in both runs, never showed the single Wi-Fi
request as a point, and cited 23 of the 25 theme messages with none cited wrongly (precision 100%).

**Language bias, before and after.** The first version of the pipeline cited only 1 of 5 Korean theme messages on this
set (20% recall), against 80–100% for the other languages: Korean guests were under-counted. The cause was not wrong
themes but short citation lists. We added a **second look**: after the summary is written, the model is asked a simpler
question about each message not yet cited ("which of these points does it support, or none?"). Only real, uncited
messages can be added, and only to a point that is already shown. Result on this set:

| | SCORE | en / ko / hi / zh / ne | precision |
|---|---|---|---|
| First pass only | 1.350 | 80 / 20 / 80 / 80 / 100 | 100% |
| With the second look | **1.525** | 80 / **80** / 100 / 100 / 100 | 100% |

Two messages are still missed in both runs, one English and one Korean, both about the coffee walk.

**Caveat on "held-out".** The test set was not used to tune any prompt. But after the first test run we looked at which
messages had been missed, in order to report them, and the second look was built afterwards. It is a general mechanism
and nothing in it refers to those messages, but the test set is no longer strictly unseen by the people who built it.

**Run-to-run variation.** Even with `temperature: 0` and a fixed seed, two runs on the same input can differ. Here the
two runs scored 1.40 and 1.65: in one run the first pass did not list the Wi-Fi request under "not sure" (it left it
out altogether). All numbers are means of 2 runs.

**Not caught by this score: wording.** The guardrails check sources, not wording. In an earlier test run the suggested
upgrade said "earlier breakfast, perhaps around 9 AM or sooner"; guests had said breakfast came *after nine*. The
citations were valid, so it was shown. This is why the screen ends with "This is only a suggestion. The decision is
yours." and why every point opens the original messages.

**Model.** These runs used the text-only copy of gemma4:e2b (same weights without the unused image/audio part, 3.6 GB).
The first test run used the full 4.6 GB model; on the dev set the two give identical scores.

## A fresh held-out set (the cleanest number we have)

Because the test set above had been inspected, we wrote a third set of 40 messages (`data/synthetic_final.json`, same
planted themes, new wording and guests) and ran the final version on it **once**, with `npm run eval -- --set final`.
Nothing was changed afterwards.

| Metric | Result (mean of 2 runs: 1.45, 1.40) |
|---|---|
| Theme recall (4 planted themes) | 100% |
| Per-language recall en / ko / hi / zh / ne | 100% / 100% / 60% / 100% / 90% |
| Weakest language | Hindi, 60% |
| Citation precision | 98% (one wrong citation in one run) |
| Single mention (Wi-Fi) not shown as a point | yes, both runs |
| Single mention (Wi-Fi) listed as uncertain | in 1 of 2 runs |
| Fewest citations on any displayed point | 4 |
| Seconds per analysis | 85 (the laptop was short of memory during this run) |
| **SCORE** | **1.425** |

What it shows:
- The themes, the "no single-guest trends" rule and the source links hold on unseen data.
- The weak language moved: Korean is fully cited here, Hindi is not (2 to 3 of 5 Hindi theme messages missed). The
  honest summary is that **which language is under-counted varies from set to set**; none is reliably safe, and the
  per-point language list is there so the owner can see it.
- The one wrong citation: a Hindi message about a *morning* walk in the coffee garden was cited under "breakfast too
  late". It came from the first pass. A cited message that does not support its point is the failure the owner can
  catch by opening the sources, but it does happen.

## The realistic sample set (harder)

`data/sample_reviews.json` is the sample shown in the app: 40 invented messages modelled on what public write-ups and
studies say homestay guests in Nepal praise and complain about. It is harder than the evaluation sets: 7 themes instead
of 4, 9 languages instead of 5, longer messages, and four messages that hold praise and a wish together. Run with
`npm run eval -- --set sample` after everything else; nothing was tuned on it.

| Metric | Result (mean of 2 runs: 1.11, 0.96) |
|---|---|
| Theme recall (7 planted themes) | 79% (6 of 7, then 5 of 7) |
| Per-language recall en / ko / hi / zh / ne / de / es / fr / ja | 75 / 88 / 70 / 50 / 90 / 100 / 100 / 50 / 100 |
| Citation precision | 99% |
| Single mentions (Wi-Fi, card payment, squat toilet) shown as a point | none |
| Fewest citations on any displayed point | 3 |
| Seconds per analysis | 113 |
| **SCORE** | **1.036** |

What it shows:
- With more themes and languages the model misses more. "Rough road / hard to find" (3 messages) was never shown as a
  point, and "could not talk without the guide" (4 messages) only in one run; both times the model put them under
  "not sure" instead. In one run it also split the coffee experience into two overlapping points.
- It fails in the cautious direction: under-reporting a real theme, not inventing one. The owner still sees those
  remarks, in the "not sure — please check yourself" box.
- Languages outside the evaluated five (Japanese, German, Spanish, French) were cited correctly; French recall was 50%.

## Dev set and the improvement loop

| | dev SCORE | en / ko / hi / zh / ne |
|---|---|---|
| Baseline prompt | 1.475 | 80 / 80 / 100 / 70 / 70 |
| After the prompt loop (1 kept change of 3 tried) | 1.650 | 100 / 80 / 80 / 100 / 80 |
| With the second look | 1.750 (maximum) | 100 / 100 / 100 / 100 / 100 |
| Held-out test (inspected before the final version), final version | 1.525 | 80 / 80 / 100 / 100 / 100 |
| **Fresh held-out set, final version, run once** | **1.425** | **100 / 100 / 60 / 100 / 90** |

Details of each iteration are in LOOP_LOG.md. The gap between dev and test is the reason we keep a held-out set: the dev
number alone hid the Korean weakness the first time, and still flatters the final version.

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
