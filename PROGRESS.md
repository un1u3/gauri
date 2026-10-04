# PROGRESS

Recovery: read this file, run `npm test`, continue from **Now**.

## Now
- Step 1 (scaffold). Started 10:05. Next: step 2 guardrails + synthetic data.

## Done (one line each, with check result)
- Step 0 (10:00–10:05): Ollama 0.32.1 up, `gemma4:e2b` answers. 3 prompts run: translation 17.6s (13s was model load), 6-message analysis 9.2s, Korean draft 5.2s. Nepali output readable.

## Decisions (and why)
- Kept Gemma for Nepali; no translation fallback. Sample: "अतिथिहरूले पकाउने कक्षा मन पराए। ... फार्म फेला पार्न गाह्रो थियो।" — readable, simple (step 0). Team can overrule.
- Setup defaults used (no team answer yet): no Android phone with Nepali voice known → no-voice fallback built; no real guest comments → synthetic only, real-data slot kept.
- `think: false` in every Ollama call: model reports the `thinking` capability and honours the flag (verified).
- `upgrade` is an array of 0–1 points in the model schema (avoids nested nulls); code turns it into `Point | null`.
- Commits go straight to `main` and are pushed after each passing step (the brief asks for it; freeze check is a fresh clone).

## Learned (rules discovered the hard way — follow these from now on)
- Laptop has 6.1 GB RAM, CPU only. With the model loaded ~1 GB is free: keep one model loaded, keep `num_ctx` small (8192 max), don't run eval and heavy builds together.
- `gemma4:e2b` is 4.6 GB on disk here (4.6B params, Q4_K_M), not ~2.6 GB as the brief says. Report the measured number in README/EVAL.
- The model wrote `text_ne` in English when asked for a Korean draft. Prompt must say "Nepali in Devanagari script", and code must reject `*_ne` fields with no Devanagari.
- In the 6-message sample it cited the English and Nepali cooking-class messages but missed the Korean one → per-language recall is a real issue to measure.

## Open questions for the team
1. Is there an Android phone with a Nepali TTS voice for testing?
2. Any real guest comments (with consent, names removed)? → `data/real_messages.json`
3. OK to keep Gemma's Nepali without a translation fallback?

## Known issues / cut list
- none yet
