# Gauri (गौरी)

**Gauri helps a small farm-stay owner learn from her guests' messages, in her own language, on her own device, with no internet.** Nepali is the default; neither the owner's language nor the guests' languages are fixed.

Built for the World Bank "Small AI for Development" hackathon (tourism).

## What it does

1. Guests send a short message after their visit, in their own language — any language. They arrive in Gauri's inbox; in this prototype that is simulated (see "How messages get in").
2. The owner presses one button. A small model running on the device reads the messages from the last 7 days and shows her, **in her language** (Nepali by default): what guests loved, what they wished for, and one suggested upgrade.
3. **Every point links to the exact messages behind it** and shows which languages those messages were in.
4. Gauri drafts a thank-you / come-back message in each guest's language and shows its meaning in the owner's language. The owner approves, edits or discards. Approved drafts are **copied**; Gauri never sends anything.
5. With too little evidence, Gauri says so instead of guessing.
6. Everything works with a screen reader (TalkBack), and the summary can be read aloud in the owner's language.
7. **"What can I improve?"** Each point in the summary has an ideas button. Gauri shows up to three ideas she could try, explained for her situation: ideas from guidebooks with their source and exact quote, and Gauri's own drafted ideas, clearly labelled as not from a guidebook.
8. The app's own buttons and labels are hand-written in Nepali and English. For any other language, the on-device model translates them once (1–2 minutes), each label is checked, and the result is saved on the device.

**Why AI and not a spreadsheet:** the messages arrive in many languages and scripts, and the owner reads one of them. A spreadsheet can store them; it cannot tell her that a Korean, a Hindi and a Chinese message are all saying "breakfast was too late".

## Who it's for

Noor runs a coffee farm-stay in Nepal's mid-hills. Six or seven visitors a month find her by word of mouth. She reads Nepali but not her guests' languages. She has no Wi-Fi and occasional 3G, and uses the household smartphone mostly at weekends. Her guests leave happy, but she never learns why, what they wished were different, or how to turn a good visit into a return visit or a referral.

## How to run

Needs Node 20+ and [Ollama](https://ollama.com).

```bash
ollama pull gemma4:e2b     # once; 4.6 GB download
npm install
npm run model:text         # recommended: text-only copy of the model, about 1 GB less memory
npm run dev                # open http://localhost:5173
```

In the app: **सेटिङ (Settings)** → "टोलीका लागि" (For the team) at the bottom → "नमुना सन्देश राख्नुहोस्" (Load sample messages: 40 realistic reviews in 9 languages) → **सारांश (Summary)** → "प्रतिक्रिया विश्लेषण गर्नुहोस्" (Analyse feedback). Or open `/flow.html` and send messages from the simulated guest phone. Analysis takes one to two minutes on a laptop CPU. The **EN** button in the top bar switches the interface to English and back.

To use another language: **सेटिङ (Settings)** → "मेरो भाषा" (My language) → pick one. Summaries and meanings follow it immediately. If the app has no labels in that language yet, it translates its own buttons on the device straight away (2–3 minutes, with progress shown; the app is in English meanwhile) and then switches. After that, switching is instant.

`npm run model:text` makes `gemma4-e2b-text` from the files already downloaded: the same weights without the 1 GB image/audio part, which Gauri never uses. Gauri uses that copy automatically when it exists and the full model when it does not. On a 6 GB laptop with a browser open, the full model was killed for lack of memory during analysis; the text-only copy ran and gave the same dev score (1.650).

Other commands:

```bash
npm test                     # 105 tests: guardrails, offline rule, data, import, prompts, any-language, ideas
npm run eval                 # real model on the dev set
npm run eval -- --set test   # real model on the held-out test set, rewrites EVAL.md
npm run eval:ideas           # ideas feature: matching accuracy + real model on 5 points
python3 scripts/check_data.py  # structure checks for the ideas data files
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
 guardrails in code
        │
        ▼
 second look: which shown point does each uncited message support, or none? (adds citations only)
        │
        ▼
 summary in the owner's language, every point with its source messages
```

The guardrails (`src/ai/guardrails.ts`) are applied to every model output before anything is displayed:

| Rule | What the code does |
|---|---|
| Not enough data | Fewer than `MIN_MESSAGES` (default 8) → no analysis, and the model is not called. |
| No invented sources | Citation IDs that do not exist are removed. |
| No single-guest "trends" | A point needs ≥ 2 real messages. With 1 it moves to "निश्चित छैन — आफैं हेर्नुहोस्" (Not sure — please check yourself). With 0 it is dropped. |
| Grounded suggestion | An upgrade with < 2 citations is not shown as a suggestion. |
| Validated output only | Output must match the schema, and text for the owner must really be in her language's script (Devanagari for Nepali, Arabic script for Arabic, and so on, for any language). One retry, then an error. |
| Translated labels | Each label translated by the model must be non-empty, keep its `{0}` placeholders and use the right script; a label that fails stays in English. |
| Languages per point | Computed in code from the cited messages, never taken from the model. |
| Second look | May only add messages that exist and are not yet cited, and only to a point already shown. It cannot create a point or remove a citation. |

The **जाँच (Checks)** screen (from Settings) runs these rules on fixed inputs in the browser and shows PASS/FAIL for each.

**Colours come from the farm, not from a tech palette:** coffee-leaf green for actions, ripe-cherry red as the accent (red is green's complement, so it stands out without shouting), roasted-bean brown for text, the cream of lokta paper for backgrounds, and marigold as the highlight. Every text and background pair is checked for a contrast of at least 4.5:1, and no meaning depends on colour alone.

The interface is laid out as a phone app (app bar with a one-tap language switch, bottom tab bar with count badges, a home feed with stats and language avatars, post-style cards, inline SVG icons) and ships a web-app manifest, so on a phone it can be added to the home screen and opens full-screen.

Stack: Vite + plain TypeScript, no UI framework, Vitest, localStorage, the browser's built-in speech synthesis. The only network target is the local Ollama, through the dev-server proxy (`/ollama` → `http://localhost:11434`). The Devanagari font is bundled. A test fails the build if any external URL or any sending code appears in the app.

## How messages get in: an SMS inbox for the last 7 days

The owner does not type or import messages. The Messages screen is an inbox of what guests sent by SMS in the **last 7 days**, and the summary is made from exactly those messages, so nothing is analysed that she cannot see. Older messages stay on the phone until she deletes them (one button), but are not shown and not analysed.

**What is real and what is not, in this prototype:** reading the phone's SMS inbox is not built. Messages reach the inbox from the simulated guest phone below, or from the set-up tools under Settings → "For the team" (paste, JSON file, bundled sample). The sample is dated across the last 7 days when it is loaded.

**A trade-off to know about:** the brief describes a monthly summary for a farm with 6–7 visitors a month. With a 7-day window and a minimum of 8 messages, a real farm that size would usually see "not enough feedback yet". The window is one constant (`WINDOW_DAYS` in `src/messages.ts`).

## Showing the flow: a simulated guest phone

For demos there are two extra pages, both reachable from Settings → "टोलीका लागि" (For the team), a closed section at the bottom that also holds the model name, the minimum-messages threshold and demo mode. Those are set-up and demo tools, so they are kept out of the owner's way:

- **`/guest.html`** — a guest's phone, laid out like a phone's messaging app. Pick a guest (Korean, Japanese, French, Hindi, Chinese, English), type or tap a message in that language and press send.
- **`/flow.html`** — the guest's phone and Gauri side by side, so the whole path fits on one screen.

A message sent there appears in Gauri at once: a "नयाँ सन्देश आयो" (new message) notice, the count on the Messages tab, and the guest listed under thank-yous. The thread opens with the consent note from the farm card, in the guest's language.

**This is a simulation.** No SMS is sent or received; the guest page writes into the same on-device store that Gauri reads, and messages made this way carry the "synthetic" badge. In real use a guest's SMS or WhatsApp message would be shared or pasted into Gauri (reading the inbox directly is on the roadmap, not built). Gauri still never sends anything: the thread is one-way.

## "What can I improve?" (सुधारका उपाय)

```
summary point ──► keyword match to a problem (code, no model) ──► nothing matches? ──► "ask your homestay association or guide"
        │
        ▼
 up to 5 candidate ideas (code): guidebook ideas first, then Gauri's drafted ideas
        │
        ▼
 local model: choose up to 3 of THESE and explain each for her situation ──fails──► the original ideas, with a notice
        │
        ▼
 guardrails in code ──► idea cards, each with its source label
```

- **The model only chooses and rewords.** It is given at most five ideas with ids and may pick up to three. An id it makes up is dropped.
- **Its text is checked.** An explanation containing a digit, a money word, or a legal or medical word is never shown; that card shows the original idea instead. Over-long text is cut at a sentence end. Text must be in the owner's language.
- **Sources are never hidden.** A guidebook idea shows its title, page and the exact quote in English. A drafted idea says "गौरीको सुझाव — गाइडबुकबाट होइन" (Gauri's idea — not from a guidebook). Ideas that need internet or English say so.
- **Unreviewed ideas are labelled.** Every idea in the data is still marked "जाँच बाँकी" (not yet checked): none has been reviewed by a person yet.
- **Her situation** (rooms, district, Wi-Fi, smartphone access, budget, languages, helpers) is set under Settings → "मेरो होमस्टे" and given to the model in words.
- **It works with the model off.** Matching and candidates are code, so the original ideas still appear.

Results (`npm run eval:ideas`, details in EVAL.md): matching put 13 of 15 hand-written points under the right problem area, and all 11 distinct points the model wrote in our evaluation runs got ideas. On 5 points the real model answered 5 of 5 in a median of 11 seconds, every shown idea was one of the candidates, and 0 of its 9 explanations were rejected by the guardrails. Not measured: whether the explanations are good advice.

## Any language

Nothing in the code is tied to a particular language.

- **Guests:** a message's language is a plain language code. It is guessed from the script (Japanese, Arabic, Cyrillic, Thai and others, not only the original five) and can be changed per message to any of 41 listed languages; other codes in imported files are kept. Language names come from the browser's built-in data, so no language files are shipped.
- **Owner:** "My language" in Settings sets the language of summaries, draft meanings, read-aloud and labels. Labels are hand-written in Nepali and English; complete AI-translated sets for Hindi, Chinese and Korean ship with the app (`data/label_packs.json`, not yet checked by a native speaker), so those switch instantly. For any other language the on-device model translates the labels, saving each batch as it goes: if the model stops part-way, what is done is kept and the rest is retried. The prompt, the output schema and the guardrail's script check are all built from that setting.
- **Right-to-left** languages (Arabic, Hebrew, Urdu, Persian) are laid out right-to-left.
- **What stays the same for Nepali:** for a Nepali-reading owner the prompt is byte-for-byte the one that was evaluated (a test enforces this), and the dev score after this change is unchanged (1.650).

Tried on the real model, not scored: a Hindi-, French-, Spanish- and English-reading owner each got a summary in their language from 46 messages that included Japanese, French, Spanish, Arabic, German and Russian ones, and those messages were cited under the right points. Labels were translated into Spanish and Hindi in about 75–105 seconds with all 107 labels passing their checks.

## Data

| Dataset | Source | License | Size | Use |
|---|---|---|---|---|
| `data/sample_reviews.json` + `sample_reviews_truth.json` | **Synthetic**, written by the team; modelled on what public write-ups and studies say homestay guests in Nepal praise and complain about (sources below). No real review text was copied. | MIT (this repo) | 40 messages in 9 languages (en, ne, hi, zh, ko, ja, fr, de, es); 7 themes, 3 single mentions | The sample loaded in the app and used for demo mode |
| `data/synthetic_messages.json` + `synthetic_truth.json` | **Synthetic**, written by the team (`scripts/make_synthetic.py`) | MIT (this repo) | 40 messages, 8 per language | Dev set: tuning the prompt |
| `data/synthetic_test.json` + `synthetic_test_truth.json` | **Synthetic**, written by the team, different wording and guests | MIT (this repo) | 40 messages, 8 per language | Held-out test set: final numbers only |
| `data/problem_catalog.json` | Written with a large AI model at build time, for this project | MIT (this repo) | 100 problems in 15 areas | Matching a summary point to ideas |
| `data/ideas_library.json` | Quotes from public guides: PNG Guesthouse Development Guidebook, ASEAN Homestay Standard, APEC community tourism manual, Airbnb host articles, Caritas Nepal, Kantipur | Short quotations with source and page; the guides belong to their publishers | 30 ideas | Guidebook ideas |
| `data/drafted_ideas.json` | **AI-drafted** at build time, not from any source | MIT (this repo) | 100 ideas | "Gauri's idea" cards |
| `data/synthetic_final.json` + `synthetic_final_truth.json` | **Synthetic**, written by the team after the first two sets had been looked at | MIT (this repo) | 40 messages, 8 per language | Second held-out set, run once |
| `data/label_packs.json` | The app's 152 labels in Hindi, Chinese and Korean, translated by a large AI model at build time; **not checked by a native speaker** | MIT (this repo) | 3 languages | Instant switching to those languages |
| `data/real_messages.json` | Real guest comments, with consent, names removed | — | **0 (empty slot)** | Import works; no real data collected yet |

The sample reviews follow patterns found by web search in: a Helvetas Nepal article on homestay water and sanitation (hot water is boiled on request; squat toilets), travel write-ups of Ghale Gaun, Sirubari and Panauti ("treated like family", eating together, home cooking, cooking momos), satisfaction studies on NepJOL (language barrier without a guide, facilities, access), and Community Homestay Network coffee-farm experiences. We read search summaries of these, not full review archives, and no reviewer is quoted.

Each of the three evaluation sets has four planted themes spread across languages (loved the cooking class, loved the coffee farm walk, breakfast too late, farm hard to find), one single mention (Wi-Fi) that must *not* become a point, and 14 neutral messages. Every synthetic message is flagged `synthetic: true` and shown with a "बनावटी / synthetic" badge.

The ideas data is English only and **has not yet been checked by a person** (`data/review_sheet.csv` is the checklist). Only two of the 30 guidebook ideas are from Nepal.

**What the data does not cover:** real Nepali farm-stay guests at any scale; **any guest language beyond English, Korean, Hindi, Chinese and Nepali, and any owner language other than Nepali** (these work, but were only tried by hand, not scored); Romanized Nepali ("khana mitho thiyo"); mother tongues such as Gurung, Tamang or Newar; voice input; very short or sarcastic messages; mixed-language messages; messages that hold two themes at once. The synthetic messages were written by the same people who built the tool, so they are cleaner and more on-topic than real ones will be.

## Evaluation results

Held-out **test set**, text-only `gemma4:e2b` (3.6 GB on disk), mean of 2 runs, laptop CPU with 6 GB RAM. Full table and discussion in [EVAL.md](EVAL.md).

| Metric | Result |
|---|---|
| Planted themes found | 4 of 4 (100%) |
| Per-language recall en / ko / hi / zh / ne | 80% / 80% / 100% / 100% / 100% |
| Citation precision (cited message really expresses the theme) | 100% |
| Single Wi-Fi mention kept out of the points | yes, both runs (listed as "not sure" in 1 of 2; left out in the other) |
| Displayed citations that exist | 100% (enforced in code) |
| Fewest citations on any displayed point | 4 |
| 5 messages → "not enough feedback", no model call | yes |
| Seconds per analysis | 56 |
| SCORE (max 1.75) | **1.525** |

**On a fresh set nobody had seen results for** (`data/synthetic_final.json`, run once, nothing changed afterwards): SCORE **1.425**, themes 4 of 4, per-language recall 100 / 100 / 60 / 100 / 90, precision 98%. This is the cleanest number we have. Hindi was the weak language here, not Korean, and one Hindi message was cited under the wrong point in one run: which language is under-counted varies from set to set.

**On the realistic sample set** (`data/sample_reviews.json`, 7 themes, 9 languages, longer and mixed messages; run after everything else, no tuning on it): SCORE **1.036**. The model found 5 to 6 of the 7 themes; the two it struggled with (the rough road, with 3 messages, and talking without the guide) were put under "not sure" in some runs instead of being shown as points. Precision 99%, no single-guest remark shown as a point, about 110 seconds. More themes and more languages are clearly harder for a model this size, and it fails in the cautious direction.

**How we got there** ([LOOP_LOG.md](LOOP_LOG.md)): we measured on the dev set, changed one thing at a time, and kept only what helped.

| Version | dev SCORE | test SCORE | Korean recall on test |
|---|---|---|---|
| First prompt | 1.475 | not run | not run |
| After the prompt loop (1 of 3 changes kept) | 1.650 | 1.350 | 20% |
| With the second look (final) | 1.750 | **1.525** | **80%** |

The first test run exposed a language bias: only 1 of 5 Korean theme messages was cited. The fix was a **second look**: after the summary, the model is asked about each not-yet-cited message, one simple question at a time, which shown point it supports or none. Only real, uncited messages can be added, and precision stayed at 100%. Caveat: the earlier test misses had been inspected before this fix was built, so the test set is no longer strictly unseen (details in EVAL.md).

## Responsible AI

- **Human in the loop.** Gauri informs; it never acts. There is no sending code in the app (a test checks this). Drafts must be approved, and approval only enables a Copy button.
- **Citations.** Every point opens the original messages it is based on, with their language. A point without two real sources is not shown as a point.
- **Uncertain states.** "Not enough feedback yet", "Not sure — please check yourself" and "Not sure — try again" are real screens, and they are marked by wording, icon and border, not colour alone.
- **Consent.** The farm card guests receive says: *"Your message may be read by the owner to improve her tours. It stays on her phone."* The same note is shown in Settings.
- **Data stays on the device** (localStorage). The owner can delete any message, or everything, in one tap. Deleting a message also removes the summary that cited it.
- **Language bias, measured and reduced.** Per-language recall is reported for every run. The first held-out run showed Korean guests under-counted (20% recall against 80–100% for the others); the second look raised that to 80%. On a fresh set Korean was fully cited but Hindi was at 60%, so no language is reliably safe; the per-point language list keeps the gap visible to the owner.
- **Known hallucination risk.** The guardrails check *sources*, not *wording*. In an earlier test run the suggestion said "earlier breakfast, perhaps around 9 AM"; guests had said breakfast came after nine. That is why every point opens its source messages and the screen ends with "यो सुझाव मात्र हो। निर्णय तपाईंको।" (This is only a suggestion. The decision is yours.)
- **Inclusivity.** Nepali by default, simple wording, icons paired with text, 48 px touch targets, three text sizes, semantic HTML with `lang` on every piece of text so TalkBack picks the right voice, an `aria-live` announcement when the summary is ready, and read-aloud. If the phone has no voice for the owner's language, Gauri says so instead of reading it with the wrong voice. The owner's language can be any language, including right-to-left ones.

## Limitations and trade-offs

- **The prototype runs on a laptop.** The model itself runs on Android phones; packaging the app and model for a phone is the next step and is not done.
- **Model size.** `gemma4:e2b` is 4.6 GB to download as measured here (the published figure we planned around was ~2.6 GB); 3.5 GB of that is the text model Gauri uses and 1 GB is an image/audio part it does not. It can be side-loaded from an SD card or a laptop, but it is not something to download over occasional 3G, and it needs a phone with enough memory.
- **Nepali voice depends on the phone.** Read-aloud uses the phone's installed text-to-speech. On the development laptop there was no Nepali voice, so only the "no Nepali voice" message was exercised; reading aloud is untested on a real phone.
- **TalkBack itself is untested.** Accessibility was checked by automated audit (labels, `lang` attributes, target sizes, live region, keyboard use), not yet with TalkBack on a phone.
- **Not deterministic.** The same input can give slightly different citation lists between runs, even at temperature 0.
- **Prompt-sensitive.** Two reasonable prompt additions each made results much worse (see LOOP_LOG.md). A small model needs measuring, not guessing.
- **Memory is tight.** On the 6 GB development laptop the full model was killed by the system during analysis once a browser and an editor were open. The text-only copy fits, with about 1 GB to spare; close other apps before a demo.
- **Ideas are unreviewed and matched by keywords.** A point worded unusually may get no ideas (2 of 15 in our check), and in a non-Nepali owner language the fallback cards are in English.
- **Synthetic evaluation only.** No real guest messages have been tested.
- **Other languages are unmeasured.** All scores are for a Nepali-reading owner and five guest languages. Other languages run through exactly the same code, but how well a 4.6B-parameter model reads or writes a given language varies, and for small languages (Maithili, Bhojpuri, Nepal Bhasa, Dzongkha) it may be poor.
- **The language check is by script.** It catches "the Nepali text came back in English", but cannot tell French from Spanish, or Nepali from Hindi; for Latin-script languages it only rejects text identical to the English.
- **AI-translated labels can be wrong.** In a Hindi trial one label put "{0} of {1}" in the wrong order. Translated labels are marked as AI-translated in Settings; Nepali and English labels are hand-written.
- **Message language is worked out by Gauri, and the owner is not asked to correct it** (she cannot read those languages). It goes by script, then by a few very common words for languages that share a script (English, French, German, Spanish, Italian, Portuguese; Hindi and Nepali). That is right on all 160 bundled sample messages, which we wrote ourselves; real messages will be harder, and a language outside those lists that uses Latin or Devanagari script (Dutch, Marathi, Maithili) will be labelled as English or Nepali. The model still reads the text itself, and thank-you drafts follow the detected language.
- **Editing a draft** changes only the guest-language text; the Nepali meaning is then marked as possibly out of date, since the owner cannot verify the edit herself.
- **Setup defaults used** (no team answers at build time): 6 GB RAM laptop, one model loaded; no Android phone with a Nepali voice; no real guest comments.

## Next steps

1. Package for Android (model + app on the phone, no laptop).
2. Collect real messages with consent, fill `data/real_messages.json`, and re-run the evaluation.
3. Recall for paraphrased non-English messages still varies by set (Hindi 60% on the fresh set); try a per-message pass over all messages, measured on a new set.
4. Test with TalkBack and a Nepali voice on a real phone, with a real owner.
5. Romanized Nepali and mother-tongue messages.
6. Score more guest and owner languages (the code is language-neutral; the evidence is not yet).

Changed from the original plan at the team's request: the fixed list of five languages was replaced by any-language support.

Out of scope by design: sending SMS/WhatsApp, reading the phone's inbox, voice input, bookings, payments, accounts, cloud sync, analytics.

## License

MIT. See [LICENSE](LICENSE).
