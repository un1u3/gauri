#!/usr/bin/env python3
"""How well does the local model write Nepali? English → Nepali on FLORES-200 devtest, scored with chrF++.

  python3 scripts/eval_flores.py DIR [N]     (needs: pip install sacrebleu)

DIR holds eng_Latn.devtest and npi_Deva.devtest from the FLORES-200 dataset (CC BY-SA 4.0, not kept
in this repo). N sentences are taken evenly across the file (default 60). Build-time only: the app
itself never downloads anything.
"""
import json, statistics, sys, time, urllib.request
import sacrebleu

folder, n = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 60
src = open(f"{folder}/eng_Latn.devtest", encoding="utf-8").read().splitlines()
ref = open(f"{folder}/npi_Deva.devtest", encoding="utf-8").read().splitlines()
picks = [i * len(src) // n for i in range(n)]
MODEL = "gemma4-e2b-text"  # same weights as gemma4:e2b, without the unused image/audio part

def translate(text):
    body = {"model": MODEL, "stream": False, "think": False, "options": {"temperature": 0, "seed": 7, "num_ctx": 8192},
            "format": {"type": "object", "properties": {"nepali": {"type": "string"}}, "required": ["nepali"]},
            "messages": [{"role": "system", "content": "Translate the English sentence into Nepali in Devanagari script. Output JSON only."},
                         {"role": "user", "content": text}]}
    req = urllib.request.Request("http://localhost:11434/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.loads(json.load(urllib.request.urlopen(req, timeout=300))["message"]["content"])["nepali"].strip()

hyps, secs = [], []
for k, i in enumerate(picks, 1):
    t = time.time()
    hyps.append(translate(src[i]))
    secs.append(time.time() - t)
    if k % 10 == 0:
        print(f"{k}/{n}", flush=True)
refs = [ref[i] for i in picks]
chrf = sacrebleu.corpus_chrf(hyps, [refs], word_order=2)
per = sorted(zip((sacrebleu.sentence_chrf(h, [r], word_order=2).score for h, r in zip(hyps, refs)), picks, hyps))
deva = sum(any("ऀ" <= c <= "ॿ" for c in h) for h in hyps)
print(f"\nchrF++ = {chrf.score:.1f} on {n} sentences ({MODEL}); output in Devanagari: {deva}/{n}; median {statistics.median(secs):.0f}s per sentence")
print(f"sentence chrF++: lowest {per[0][0]:.0f}, median {per[len(per) // 2][0]:.0f}, highest {per[-1][0]:.0f}")
for score, i, h in (per[0], per[len(per) // 2], per[-1]):
    print(f"\n[{score:.0f}] EN:  {src[i]}\n     OUT: {h}\n     REF: {ref[i]}")
json.dump({"chrf_pp": round(chrf.score, 1), "n": n, "model": MODEL, "devanagari": deva, "median_seconds": round(statistics.median(secs)),
           "sentence_low_median_high": [round(per[0][0]), round(per[len(per) // 2][0]), round(per[-1][0])]}, open("flores_results.json", "w"))
