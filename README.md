# Gauri (गौरी)

**Gauri helps a small farm-stay owner learn from her guests' messages: on her own device, offline, in her own language.**

Built for the World Bank "Small AI for Development" hackathon (tourism track).

- **Hosted preview** (interface only, no AI behind it): https://un1u3.github.io/gauri/
- **Guest phone and Gauri side by side:** https://un1u3.github.io/gauri/flow.html
- **Evaluation:** [EVAL.md](EVAL.md) · **Improvement log:** [LOOP_LOG.md](LOOP_LOG.md) · **Build notes:** [PROGRESS.md](PROGRESS.md)

---

## The problem

Noor runs a coffee farm-stay in Nepal's mid-hills. Six or seven visitors a month find her by word of mouth. She reads Nepali, but not her guests' languages. She has no Wi-Fi, occasional 3G, and is outside most of the day.

Her guests leave happy, but she never learns **why**, what they **wished were different**, or how to turn a good visit into a return visit or a referral. Their feedback is scattered and written in languages she cannot read.

**Why AI and not a spreadsheet:** a spreadsheet can store the messages. It cannot tell her that a Korean, a Hindi and a Chinese message are all saying "breakfast was too late".

## What Gauri does

| | |
|---|---|
| **Reads guest messages in any language** | Korean, Hindi, Chinese, Japanese, French, Arabic… Gauri works out each message's language itself. |
| **Summarises them in her language** | What guests loved, what they wished for, and one suggested upgrade. Nepali by default; she can choose any language. |
| **Shows its sources** | Every point opens the exact messages behind it, with their languages. A point without two real messages cannot be shown. |
| **Says when it is not sure** | With too few messages it does not analyse. What only one guest said goes under "Not sure — please check yourself". |
| **Suggests what she can do** | For each point, up to three ideas with a first step, fitted to her situation. Each shows where it comes from: a guidebook with its exact quote, or "Gauri's idea — not from a guidebook". |
| **Drafts thank-you messages** | In the guest's own language, with the meaning shown in hers. She approves, edits or discards. Approved text is **copied**; Gauri never sends anything. |
| **Works for low literacy and screen readers** | Simple wording, icons with text, large touch targets, three text sizes, read-aloud, semantic HTML. |
| **Keeps everything on the device** | No cloud, no account, no analytics. She can delete any message or everything. |

## See it

### Hosted preview (no install)

https://un1u3.github.io/gauri/ shows the interface with sample reviews loaded.

**The AI does not run there, and the page says so on every screen.** The model runs only on a device that has it installed; a public web page has no model behind it. The preview is fixed in demo mode and shows a saved, unedited output the model produced earlier on that sample. To see the real model work, run Gauri locally.

### Run it locally (real AI, offline)

Needs Node 20+ and [Ollama](https://ollama.com).

```bash
ollama pull gemma4:e2b     # once; 4.6 GB download
npm install
npm run model:text         # recommended: text-only copy of the model, about 1 GB less memory
npm run dev                # open http://localhost:5173
```

Then either:

- open **http://localhost:5173/flow.html**, send messages from the simulated guest phone, and watch them arrive in Gauri; or
- in Gauri: **सेटिङ** (Settings) → **टोलीका लागि** (For the team) → **नमुना सन्देश राख्नुहोस्** to load 40 sample reviews in 9 languages, then **सारांश** (Summary) → **प्रतिक्रिया विश्लेषण गर्नुहोस्** (Analyse feedback).

Analysis takes one to two minutes on a laptop CPU. The **EN** button in the top bar switches the interface to English.

After the model is pulled, nothing needs the internet. If Ollama is not running, Gauri says so and shows nothing else.

`npm run model:text` makes `gemma4-e2b-text` from the files already downloaded: the same weights without the 1 GB image/audio part, which Gauri never uses. Gauri uses that copy automatically when it exists. On a 6 GB laptop with a browser open, the full model was killed for lack of memory; the text-only copy runs and gives the same scores.

### Commands

```bash
npm test                        # 105 tests: guardrails, offline rule, data, languages, ideas
npm run eval                    # real model on the dev set
npm run eval -- --set final     # real model on the fresh held-out set
npm run eval -- --set sample    # real model on the realistic 9-language sample
npm run eval:ideas              # ideas feature: matching accuracy + real model on 5 points
python3 scripts/check_data.py   # structure checks for the ideas data
npm run build                   # production build
npm run deploy:preview          # publish the hosted preview to GitHub Pages
```

---

## How it works

### The summary

```
messages from the last 7 days ──► fewer than 8? ──► "not enough feedback yet" (the model is not called)
        │
        ▼
 Gemma 4 E2B through local Ollama (JSON schema, temperature 0)
        │
        ▼
 schema check ──fail──► retry once ──fail──► "not sure — try again"
        │
        ▼
 guardrails in code (citations verified)
        │
        ▼
 second look: which shown point does each uncited message support, or none?
        │
        ▼
 summary in the owner's language, every point with its source messages
```

The model has one job: return structured data. **Code decides what is shown.**

| Rule | What the code does |
|---|---|
| Not enough data | Fewer than 8 messages → no analysis, and the model is not called. |
| No invented sources | Citations to messages that do not exist are removed. |
| No single-guest "trends" | A point needs at least 2 real messages. With 1 it moves to "Not sure". With 0 it is dropped. |
| Grounded suggestion | An upgrade backed by fewer than 2 messages is not shown as a suggestion. |
| Validated output only | Output must match the schema, and text for the owner must really be in her language's script. One retry, then an error. |
| Languages per point | Computed in code from the cited messages, never taken from the model. |
| Second look | May only add messages that exist and are not yet cited, to a point already shown. It cannot create a point. |
| Never acts for her | No sending code exists. A test fails the build if any appears. |

**15 of these checks can be run on the device** (Settings → "सुरक्षा जाँच हेर्नुहोस्"), with no model call.

### "What can I improve?"

```
summary point ──► keyword match to a problem (code) ──► nothing matches? ──► "ask your homestay association or guide"
        │
        ▼
 up to 5 candidate ideas (code): guidebook ideas first, then Gauri's drafted ideas
        │
        ▼
 local model: choose up to 3 of THESE and explain each for her situation ──fails──► the original ideas, with a notice
        │
        ▼
 guardrails in code ──► idea cards, each with a first step and its source
```

- The model may only choose from the ideas it is given, and reword them. An idea it makes up is dropped.
- An explanation containing a digit, a money word, or a legal or medical word is never shown; that card shows the original idea instead.
- A guidebook idea always shows its title, page and exact quote. A drafted idea always says it is not from a guidebook.
- Her situation (rooms, district, Wi-Fi, smartphone access, budget, helpers) is set under Settings → "मेरो होमस्टे".
- Every idea is still labelled **"जाँच बाँकी" (not yet checked)**: no person has reviewed the ideas data yet.

### Any language in, any language out

Nothing in the code is tied to one language.

- **Guests.** A message's language is worked out from its text: by script, then by a few very common words for languages that share a script (English, French, German, Spanish, Italian, Portuguese; Hindi and Nepali). The owner is not asked to correct it, since she cannot read those languages. Right-to-left scripts are laid out right-to-left.
- **Owner.** One setting, "मेरो भाषा" (My language), drives the prompt, the output schema, the guardrail that checks the output script, read-aloud, and the app's labels.
- **Labels.** Hand-written in Nepali and English. Complete AI-translated sets for Hindi, Chinese and Korean ship with the app. For any other language the on-device model translates them, saving each batch as it goes and resuming after a failure.
- **For Nepali**, the prompt is byte-for-byte the one that was evaluated; a test enforces this.

### How messages get in

The owner does not type or import messages. Her Messages screen is an inbox of what guests sent in the **last 7 days**, and the summary uses exactly those.

**Reading the phone's SMS inbox is not built.** In this prototype, messages reach the inbox from a **simulated guest phone** (`/guest.html`, shown beside Gauri at `/flow.html`) or from set-up tools under Settings → "For the team". The simulation is labelled on screen, sends no real SMS, and is one-way.

### Stack

Vite + plain TypeScript (no UI framework), Vitest, localStorage, the browser's built-in speech synthesis, a bundled Devanagari font. The only network target is the local Ollama, through the dev-server proxy. About 2,400 lines of source.

---

## Evidence

All numbers come from `npm run eval` on synthetic messages with planted themes and ground truth, mean of 2 runs, on a laptop CPU with 6 GB RAM. Details and discussion are in [EVAL.md](EVAL.md).

| Set | Themes found | Citation precision | Per-language recall | SCORE (max 1.75) |
|---|---|---|---|---|
| **Fresh held-out set**, run once (5 languages) | 4 of 4 | 98% | 100 / 100 / 60 / 100 / 90 (en / ko / hi / zh / ne) | **1.425** |
| First test set, inspected before the final version | 4 of 4 | 100% | 80 / 80 / 100 / 100 / 100 | 1.525 |
| Realistic sample, harder (9 languages, 7 themes) | 79% | 99% | 50% to 100% | 1.036 |
| Dev set (used for tuning) | 4 of 4 | 100% | 100 / 100 / 100 / 100 / 100 | 1.750 |

- **A single guest's remark was never shown as a point**, on any set.
- **The fresh set is the cleanest number.** It was written after the others had been looked at, run once, and nothing was changed afterwards.
- **More themes and languages are harder.** On the realistic sample the model missed one or two of seven themes, and put them under "Not sure" instead: it fails in the cautious direction.

### What measuring taught us

We tuned on a dev set, changing one thing at a time and keeping only what helped ([LOOP_LOG.md](LOOP_LOG.md)).

| Version | Dev SCORE | Korean recall on the first test set |
|---|---|---|
| First prompt | 1.475 | not run |
| After the prompt loop (1 of 3 changes kept; two made it much worse) | 1.650 | 20% |
| With the second look | 1.750 | **80%** |

The first test run exposed a **language bias**: only 1 of 5 Korean messages was cited, so Korean guests were under-counted. Prompt wording did not fix it. Asking the model a simpler question about each uncited message did, with no loss of precision. On the fresh set the weak language was Hindi instead: **which language is under-counted varies by set, and none is reliably safe.** The per-point language list keeps this visible to the owner.

### Ideas feature

`npm run eval:ideas`: matching put 13 of 15 hand-written points under the right problem area, and all 11 distinct points the model wrote in our runs got ideas. On 5 points the model answered all 5 in a median of 11 seconds; every shown idea was one of the candidates; none of 9 explanations was rejected by the guardrails. **Not measured:** whether the explanations are good advice.

---

## Data

| File | What it is | Source | Size |
|---|---|---|---|
| `data/sample_reviews.json` | The sample loaded in the app and used for demo mode | **Invented by the team**, modelled on what public write-ups and studies say homestay guests in Nepal praise and complain about. No review text was copied. | 40 messages, 9 languages |
| `data/synthetic_messages.json` | Dev set, used for tuning | Invented by the team | 40 messages, 5 languages |
| `data/synthetic_test.json` | First held-out set | Invented by the team | 40 messages, 5 languages |
| `data/synthetic_final.json` | Fresh held-out set, run once | Invented by the team | 40 messages, 5 languages |
| `data/*_truth.json` | Ground truth for each set | Generated with the messages by `scripts/make_synthetic.py` | |
| `data/problem_catalog.json` | Problems a farm-stay hears about | Written with a large AI model at build time | 100 problems, 15 areas |
| `data/ideas_library.json` | Sourced ideas with exact quotes | PNG Guesthouse Development Guidebook, ASEAN Homestay Standard, APEC community tourism manual, Airbnb host articles, Caritas Nepal, Kantipur | 30 ideas |
| `data/drafted_ideas.json` | "Gauri's idea" cards | **AI-drafted** at build time, not from any source | 100 ideas |
| `data/review_sheet.csv` | Checklist for a person to review the ideas | | 130 rows |
| `data/label_packs.json` | The app's labels in Hindi, Chinese and Korean | Translated by a large AI model at build time | 152 labels × 3 |
| `data/real_messages.json` | Slot for real guest comments | Empty: none collected yet | 0 |

Everything in this repository is MIT-licensed. The guidebook quotations are short, attributed, and belong to their publishers. Every invented message carries a "synthetic" badge in the app, and sample contacts are made-up phone numbers.

The sample reviews follow patterns found by web search in a Helvetas Nepal article on homestay sanitation, travel write-ups of Ghale Gaun, Sirubari and Panauti, satisfaction studies on NepJOL, and Community Homestay Network coffee experiences. We read search summaries, not full review archives.

**What the data does not cover:** real guests at any scale; Romanized Nepali; mother tongues such as Gurung, Tamang or Newar; voice input; sarcasm; very short messages. The messages were written by the people who built the tool, so they are cleaner than real ones will be.

---

## Responsible AI

- **Human in the loop.** Gauri informs and never acts. Drafts must be approved, and approval only enables Copy.
- **Sources always shown.** Every point opens its messages; every idea shows where it came from.
- **Uncertainty is a real state.** "Not enough feedback yet", "Not sure — please check yourself" and "Not sure — try again" are screens, marked by wording, icon and border, not colour alone.
- **Consent.** The farm card guests receive says: *"Your message may be read by the owner to improve her tours. It stays on her phone."* The guest phone shows it in the guest's language.
- **Data stays on the device.** One tap deletes a message, or everything.
- **Bias is measured and reported**, per language, for every run.
- **Unreviewed content is labelled.** Ideas say "not yet checked"; AI-translated labels say so in Settings.
- **Known gap.** The guardrails check sources, not wording. In one test run the suggestion said "earlier breakfast, perhaps around 9 AM"; guests had said breakfast came *after nine*. This is why every screen ends with "This is only a suggestion. The decision is yours."

## Limitations

- **Runs on a laptop, not yet on a phone.** The model itself can run on Android; packaging app and model for a phone is the next step.
- **No real guest messages have been tested.** All evaluation is on invented data.
- **Reading SMS is simulated** (see above).
- **TalkBack and read-aloud are untested on a real phone.** Accessibility was checked by automated audit; the development laptop had no Nepali voice, so only the "no voice on this phone" message was exercised.
- **Memory is tight.** The text-only model fits a 6 GB laptop with about 1 GB to spare; with a browser and an editor open, the system can kill it mid-analysis.
- **Slow.** One to two minutes per analysis, about 10 seconds per idea or draft.
- **Not deterministic.** The same input can give slightly different citations between runs, even at temperature 0.
- **A 7-day window fights the brief's numbers.** With 6–7 visitors a month and a minimum of 8 messages, a real farm would usually see "not enough feedback yet". The window is one constant (`WINDOW_DAYS`).
- **Other languages are unmeasured.** Scores cover a Nepali-reading owner and five guest languages (nine on the sample). Other languages run through the same code but were only tried by hand; small languages may be poor.
- **Language checks are by script.** They catch "Nepali came back in English", not French versus Spanish.
- **The ideas data and the shipped translations have not been reviewed by a person.**
- **Model size.** 4.6 GB to download, 3.6 GB in use: side-loadable from a laptop or SD card, not something to fetch over occasional 3G.

## Next steps

1. Package app and model for an Android phone; test with TalkBack and a Nepali voice, with a real owner.
2. Collect real messages with consent and re-run the evaluation.
3. Let her share a message into Gauri from her SMS or WhatsApp app.
4. Have a person review the ideas library and the shipped translations.
5. Improve recall for paraphrased non-English messages, measured on a new set.
6. A model that runs inside the browser, so a hosted page can be truly local too.

Out of scope by design: sending messages, bookings, payments, accounts, cloud sync, analytics.

## Project layout

```
index.html, guest.html, flow.html   the app, the simulated guest phone, both side by side
src/main.ts                         screens and interaction
src/ai/                             prompts, Ollama client, analysis pipeline, guardrails, label translation
src/ideas/                          matching, candidates, guardrails and pipeline for "What can I improve?"
src/lang.ts, i18n.ts, messages.ts   languages, labels, the 7-day inbox
data/                               sample and evaluation sets, ideas data, shipped labels
scripts/                            evaluation, data generation and checks, model and preview helpers
tests/, src/ideas/*.test.ts         105 tests
```

## License

MIT. See [LICENSE](LICENSE).
