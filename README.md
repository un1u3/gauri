# Gauri (गौरी)

**Gauri helps a small farm-stay owner in Nepal learn from her guests' messages, in Nepali, on her own device, with no internet.**

Built for the World Bank "Small AI for Development" hackathon (tourism).

## What it does

1. Guests send a short message after their visit, in their own language (English, Korean, Hindi, Chinese, Nepali). In this prototype the messages are pasted or imported.
2. Once a month the owner presses one button. A small model running on the device reads all the messages and shows her, **in Nepali**: what guests loved, what they wished for, and one suggested upgrade.
3. **Every point links to the exact messages behind it** and shows which languages those messages were in.
4. Gauri drafts a thank-you / come-back message in each guest's language and shows its meaning in Nepali. The owner approves, edits or discards. Approved drafts are **copied**; Gauri never sends anything.
5. With too little evidence, Gauri says so instead of guessing.
6. Everything works with a screen reader (TalkBack), and the summary can be read aloud in Nepali.

**Why AI and not a spreadsheet:** the messages arrive in five languages and four scripts, and the owner reads one of them. A spreadsheet can store them; it cannot tell her that a Korean, a Hindi and a Chinese message are all saying "breakfast was too late".

## Who it's for

Noor runs a coffee farm-stay in Nepal's mid-hills. Six or seven visitors a month find her by word of mouth. She reads Nepali but not her guests' languages. She has no Wi-Fi and occasional 3G, and uses the household smartphone mostly at weekends. Her guests leave happy, but she never learns why, what they wished were different, or how to turn a good visit into a return visit or a referral.

## How to run

Needs Node 20+ and [Ollama](https://ollama.com).

```bash
ollama pull gemma4:e2b     # once; 4.6 GB download
npm install
npm run dev                # open http://localhost:5173
```

In the app: **सन्देश (Messages)** → "नमुना सन्देश राख्नुहोस्" (Load sample messages) → **सारांश (Summary)** → "प्रतिक्रिया विश्लेषण गर्नुहोस्" (Analyse feedback). Analysis takes about 30–60 seconds on a laptop CPU. An English interface is under **सेटिङ (Settings)** → "एपको भाषा".

Other commands:

```bash
npm test                     # 34 tests: guardrails, offline rule, data, import
npm run eval                 # real model on the dev set
npm run eval -- --set test   # real model on the held-out test set, rewrites EVAL.md
```

After the model is pulled, nothing needs the internet. If Ollama is not running, the app says so and shows nothing else.

## How it works

```
messages (on device) ──► fewer than 8? ──► "not enough feedback yet" (model is not called)
        │
        ▼
 gemma4:e2b via local Ollama (JSON schema, temperature 0)
        │
        ▼
 schema check ──fail──► retry once ──fail──► "not sure — try again"
        │
        ▼
 guardrails in code ──► summary in Nepali, every point with its source messages
```

The guardrails (`src/ai/guardrails.ts`) are applied to every model output before anything is displayed:

| Rule | What the code does |
|---|---|
| Not enough data | Fewer than `MIN_MESSAGES` (default 8) → no analysis, and the model is not called. |
| No invented sources | Citation IDs that do not exist are removed. |
| No single-guest "trends" | A point needs ≥ 2 real messages. With 1 it moves to "निश्चित छैन — आफैं हेर्नुहोस्" (Not sure — please check yourself). With 0 it is dropped. |
| Grounded suggestion | An upgrade with < 2 citations is not shown as a suggestion. |
| Validated output only | Output must match the schema, and Nepali fields must really be in Devanagari. One retry, then an error. |
| Languages per point | Computed in code from the cited messages, never taken from the model. |

The **जाँच (Checks)** screen (from Settings) runs these rules on fixed inputs in the browser and shows PASS/FAIL for each.

Stack: Vite + plain TypeScript, no UI framework, Vitest, localStorage, the browser's built-in speech synthesis. The only network target is the local Ollama, through the dev-server proxy (`/ollama` → `http://localhost:11434`). The Devanagari font is bundled. A test fails the build if any external URL or any sending code appears in the app.

## Data

| Dataset | Source | License | Size | Use |
|---|---|---|---|---|
| `data/synthetic_messages.json` + `synthetic_truth.json` | **Synthetic**, written by the team (`scripts/make_synthetic.py`) | MIT (this repo) | 40 messages, 8 per language | Dev set: tuning the prompt |
| `data/synthetic_test.json` + `synthetic_test_truth.json` | **Synthetic**, written by the team, different wording and guests | MIT (this repo) | 40 messages, 8 per language | Held-out test set: final numbers only |
| `data/real_messages.json` | Real guest comments, with consent, names removed | — | **0 (empty slot)** | Import works; no real data collected yet |

Each synthetic set has four planted themes spread across languages (loved the cooking class, loved the coffee farm walk, breakfast too late, farm hard to find), one single mention (Wi-Fi) that must *not* become a point, and 14 neutral messages. Every synthetic message is flagged `synthetic: true` and shown with a "बनावटी / synthetic" badge.

**What the data does not cover:** real Nepali farm-stay guests at any scale; Romanized Nepali ("khana mitho thiyo"); mother tongues such as Gurung, Tamang or Newar; voice input; very short or sarcastic messages; mixed-language messages; messages that hold two themes at once. The synthetic messages were written by the same people who built the tool, so they are cleaner and more on-topic than real ones will be.

## Evaluation results

Held-out **test set**, `gemma4:e2b` (4.6 GB on disk), mean of 2 runs, laptop CPU with 6 GB RAM. Full table in [EVAL.md](EVAL.md).

| Metric | Result |
|---|---|
| Planted themes found | 4 of 4 (100%) |
| Per-language recall en / ko / hi / zh / ne | 80% / **20%** / 80% / 80% / 100% |
| Single Wi-Fi mention kept out of the points, listed as "not sure" | yes |
| Displayed citations that exist | 100% (enforced in code) |
| Fewest citations on any displayed point | 3 |
| 5 messages → "not enough feedback", no model call | yes |
| Seconds per analysis | 38.5 |
| SCORE (max 1.75) | **1.350** |

**The improvement loop** ([LOOP_LOG.md](LOOP_LOG.md)): we measured the prompt on the dev set, changed one thing at a time, and kept only what helped. One of three changes was kept. It raised dev SCORE from 1.475 to 1.650 and the weakest language's recall on dev from 70% to 80%. On the held-out test set the same prompt scores 1.350.

## Responsible AI

- **Human in the loop.** Gauri informs; it never acts. There is no sending code in the app (a test checks this). Drafts must be approved, and approval only enables a Copy button.
- **Citations.** Every point opens the original messages it is based on, with their language. A point without two real sources is not shown as a point.
- **Uncertain states.** "Not enough feedback yet", "Not sure — please check yourself" and "Not sure — try again" are real screens, and they are marked by wording, icon and border, not colour alone.
- **Consent.** The farm card guests receive says: *"Your message may be read by the owner to improve her tours. It stays on her phone."* The same note is shown in Settings.
- **Data stays on the device** (localStorage). The owner can delete any message, or everything, in one tap. Deleting a message also removes the summary that cited it.
- **Language bias, measured.** Korean messages are under-cited: 20% recall on the test set against 80–100% for the others (dev set: 90%). Themes are still found, but Korean guests are under-counted in the evidence. We report this rather than hide it; the per-point language list makes it visible to the owner.
- **Known hallucination risk.** The guardrails check *sources*, not *wording*. In one test run the suggestion said "earlier breakfast, perhaps around 9 AM"; guests had said breakfast came after nine. That is why every point opens its source messages and the screen ends with "यो सुझाव मात्र हो। निर्णय तपाईंको।" (This is only a suggestion. The decision is yours.)
- **Inclusivity.** Nepali by default, simple wording, icons paired with text, 48 px touch targets, three text sizes, semantic HTML with `lang` on every piece of text so TalkBack picks the right voice, an `aria-live` announcement when the summary is ready, and read-aloud. If the phone has no Nepali voice, Gauri says so instead of reading Nepali with the wrong voice.

## Limitations and trade-offs

- **The prototype runs on a laptop.** The model itself runs on Android phones; packaging the app and model for a phone is the next step and is not done.
- **Model size.** `gemma4:e2b` is 4.6 GB on disk as measured here (the published figure we planned around was ~2.6 GB). It can be side-loaded from an SD card or a laptop, but it is not something to download over occasional 3G, and it needs a phone with enough memory.
- **Nepali voice depends on the phone.** Read-aloud uses the phone's installed text-to-speech. On the development laptop there was no Nepali voice, so only the "no Nepali voice" message was exercised; reading aloud is untested on a real phone.
- **TalkBack itself is untested.** Accessibility was checked by automated audit (labels, `lang` attributes, target sizes, live region, keyboard use), not yet with TalkBack on a phone.
- **Not deterministic.** The same input can give slightly different citation lists between runs, even at temperature 0.
- **Prompt-sensitive.** Two reasonable prompt additions each made results much worse (see LOOP_LOG.md). A small model needs measuring, not guessing.
- **Synthetic evaluation only.** No real guest messages have been tested.
- **Editing a draft** changes only the guest-language text; the Nepali meaning is then marked as possibly out of date, since the owner cannot verify the edit herself.
- **Setup defaults used** (no team answers at build time): 6 GB RAM laptop, one model loaded; no Android phone with a Nepali voice; no real guest comments.

## Next steps

1. Package for Android (model + app on the phone, no laptop).
2. Collect real messages with consent, fill `data/real_messages.json`, and re-run the evaluation.
3. Fix Korean recall: try a per-language pass, or translate-then-group, and measure both on the test set.
4. Test with TalkBack and a Nepali voice on a real phone, with a real owner.
5. Romanized Nepali and mother-tongue messages.

Out of scope by design: sending SMS/WhatsApp, reading the phone's inbox, voice input, bookings, payments, accounts, cloud sync, analytics.

## License

MIT. See [LICENSE](LICENSE).
