#!/usr/bin/env python3
"""Shows what the last eval run missed (used by the inner loop to pick the next change).
Usage: python3 scripts/misses.py [dev|test]"""
import json, sys
which = sys.argv[1] if len(sys.argv) > 1 else "dev"
files = {"test": ("synthetic_test.json", "synthetic_test_truth.json"), "final": ("synthetic_final.json", "synthetic_final_truth.json")}.get(which, ("synthetic_messages.json", "synthetic_truth.json"))
msgs = {m["id"]: m for m in json.load(open(f"data/{files[0]}"))}
themes = json.load(open(f"data/{files[1]}"))["themes"]
for i, run in enumerate(json.load(open("eval_results.json"))[which]["runs"], 1):
    a = run["analysis"]
    print(f"--- run {i}: SCORE {run['SCORE']:.3f}  t5_in_uncertain={run['t5_in_uncertain']}")
    for kind in ("loved", "wished"):
        for p in a[kind]:
            print(f"  {kind}: {p['point_en']} {p['message_ids']}")
    print("  upgrade:", a["upgrade"] and a["upgrade"]["point_en"])
    for u in a["uncertain"]:
        print("  uncertain:", u["note_en"])
    cited = {k: {i for p in a[k] for i in p["message_ids"]} for k in ("loved", "wished")}
    for t in themes:
        if t["type"] == "single":
            continue
        for mid in t["message_ids"]:
            if mid not in cited[t["type"]]:
                print(f"  MISSED {t['id']} [{mid}] ({msgs[mid]['lang']}) {msgs[mid]['text']}")
