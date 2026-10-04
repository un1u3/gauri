#!/usr/bin/env python3
"""Checks the ideas data (problem catalog, sourced library, AI-drafted ideas, review sheet).

  python3 scripts/check_data.py [--sources DIR]

DIR holds the source pages as plain text plus manifest.json ({source_url: file}); it is
not part of the repo. Without it, check 4 (quotes appear verbatim in the source) is SKIPPED.

All data is English only (team decision): the app writes in the owner's language on the device.
"""
import csv, json, os, re, sys

TAGS = ["directions", "language", "food_timing", "food", "rooms", "bathroom_water", "hygiene", "activities", "culture", "safety",
        "pricing_payment", "booking_enquiries", "online_presence", "reviews_referrals", "seasonal_operations"]
FILES = {"problems": "data/problem_catalog.json", "library": "data/ideas_library.json", "drafted": "data/drafted_ideas.json", "sheet": "data/review_sheet.csv"}
LIBRARY_FIELDS = ["id", "tags", "idea_en", "where", "needs_internet", "needs_english", "cost", "skills_needed", "source_title", "source_url", "page", "quote", "review"]
COSTS = {"unknown", "low", "medium", "none-per-source"}
MONEY = re.compile(r"\b(rs|rupees?|price[sd]?|costs?)\b|[$₹]|रु|रुपैयाँ", re.I)
BANNED = re.compile(r"\b(licen[sc]e[sd]?|tax(es)?|laws?|legal|medicines?|doctors?|cures?|guarantee[sd]?)\b", re.I)
PENDING = {"status": "pending", "checked_by": None, "checked_on": None, "note": None}

results = []
def check(n, name, problems):
    results.append((n, name, problems))

def words(s):
    return set(re.findall(r"[a-z']+", s.lower()))

def norm(t):  # whitespace and curly quotes only
    t = t.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+([,.;:])", r"\1", re.sub(r"\s+", " ", t)).strip()

# 1. files exist and parse
bad, data = [], {}
for key, path in FILES.items():
    if not os.path.exists(path):
        bad.append(f"missing {path}")
    elif path.endswith(".json"):
        try:
            data[key] = json.load(open(path, encoding="utf-8"))
        except ValueError as e:
            bad.append(f"{path}: {e}")
check(1, "4 files exist, 3 JSON files parse", bad)
if bad:
    print("\n".join(bad)); sys.exit(1)
problems, library, drafted = data["problems"], data["library"], data["drafted"]

# 2. problem catalog
bad = []
ids = [p["id"] for p in problems]
if ids != [f"P{i:03d}" for i in range(1, 101)]: bad.append(f"ids are not exactly P001–P100 in order ({len(ids)} problems)")
per_tag = {t: [p for p in problems if p["tag"] == t] for t in TAGS}
bad += [f"{p['id']}: invalid tag {p['tag']}" for p in problems if p["tag"] not in TAGS]
bad += [f"tag {t}: {len(ps)} problems (need 5–9)" for t, ps in per_tag.items() if not 5 <= len(ps) <= 9]
loved = sum(p["type"] == "loved" for p in problems)
if loved < 25: bad.append(f"only {loved} loved problems (need ≥ 25)")
for p in problems:
    if p["type"] not in ("wished", "loved"): bad.append(f"{p['id']}: type {p['type']}")
    if set(p) != {"id", "tag", "type", "problem_en", "keywords_en"}: bad.append(f"{p['id']}: fields {sorted(p)}")
    kw = p["keywords_en"]
    if not 6 <= len(kw) <= 12 or any(k != k.lower() for k in kw): bad.append(f"{p['id']}: needs 6–12 lowercase keywords, has {len(kw)}")
for t, ps in per_tag.items():
    for i, a in enumerate(ps):
        for b in ps[i + 1:]:
            wa, wb = words(a["problem_en"]), words(b["problem_en"])
            if len(wa & wb) / min(len(wa), len(wb)) >= 0.7: bad.append(f"{a['id']} and {b['id']} share ≥ 70% of their words")
check(2, f"100 problems, 15 tags, 5–9 per tag, {loved} loved (≥ 25), no near-duplicates", bad)

# 3. library schema
bad = []
lib_ids = [e["id"] for e in library]
if len(set(lib_ids)) != len(lib_ids): bad.append("duplicate library ids")
for e in library:
    bad += [f"{e['id']}: missing {f}" for f in LIBRARY_FIELDS if f not in e]
    bad += [f"{e['id']}: invalid tag {t}" for t in e.get("tags", []) if t not in TAGS]
    for q in ("quote", "quote_2"):
        if q in e and len(e[q].split()) > 30: bad.append(f"{e['id']}: {q} has {len(e[q].split())} words (> 30)")
    if e.get("review") != PENDING: bad.append(f"{e['id']}: review must be pending and empty")
    if e.get("cost") not in COSTS: bad.append(f"{e['id']}: cost {e.get('cost')!r}")
    if not isinstance(e.get("needs_internet"), bool) or not isinstance(e.get("needs_english"), bool): bad.append(f"{e['id']}: needs_* must be true/false")
check(3, f"{len(library)} library entries: all fields, valid tags, quotes ≤ 30 words, review pending", bad)

# 4. quotes appear verbatim in the fetched source text
src = sys.argv[sys.argv.index("--sources") + 1] if "--sources" in sys.argv else os.environ.get("GAURI_SOURCES")
if src and os.path.exists(os.path.join(src, "manifest.json")):
    manifest = json.load(open(os.path.join(src, "manifest.json")))
    texts = {url: norm(open(os.path.join(src, f), encoding="utf-8").read()) for url, f in manifest.items()}
    bad, n = [], 0
    for e in library:
        if e["source_url"] not in texts:
            bad.append(f"{e['id']}: source was not fetched"); continue
        for q in ("quote", "quote_2"):
            if q in e:
                n += 1
                if norm(e[q]) not in texts[e["source_url"]]: bad.append(f"{e['id']}: {q} not found verbatim")
    check(4, f"{n} quotes found verbatim in the fetched source text", bad)
else:
    check(4, "quote check SKIPPED (no --sources directory with manifest.json)", None)

# 5. library coverage per tag
lib_per_tag = {t: sum(t in e["tags"] for e in library) for t in TAGS}
empty = [t for t, n in lib_per_tag.items() if n == 0]
check(5, f"reviews_referrals has {lib_per_tag['reviews_referrals']} library entries (≥ 3); tags with 0 sourced entries: {', '.join(empty) or 'none'}",
      [] if lib_per_tag["reviews_referrals"] >= 3 else ["reviews_referrals has fewer than 3 library entries"])

# 6. drafted ideas
bad, flagged = [], []
if [d["problem_id"] for d in drafted] != ids: bad.append("drafted ideas do not cover P001–P100 exactly once, in order")
high = sum(d.get("review_priority") == "high" for d in drafted)
if high != 20: bad.append(f"{high} high-priority ideas (need exactly 20)")
for d in drafted:
    i = d["id"]
    if i != f"draft_{d['problem_id']}": bad.append(f"{i}: id does not match problem")
    if d.get("label") != "ai_drafted": bad.append(f"{i}: label")
    if any(k in d for k in ("source_url", "quote", "source_title")): bad.append(f"{i}: a drafted idea must not cite a source")
    if d.get("constraint_check") != {"no_internet": True, "no_english": True, "low_money": True, "fits_small_farm": True}: bad.append(f"{i}: constraint_check")
    if d.get("review_priority") not in ("high", "normal"): bad.append(f"{i}: review_priority")
    if d.get("review") != PENDING: bad.append(f"{i}: review must be pending and empty")
    if not d.get("why_it_fits"): bad.append(f"{i}: why_it_fits missing")
    text = d["idea_en"]
    if re.search(r"\d", text): bad.append(f"{i}: contains a digit")
    if MONEY.search(text): bad.append(f"{i}: money word '{MONEY.search(text).group()}'")
    if BANNED.search(text): flagged.append(f"{i}: banned-topic word '{BANNED.search(text).group()}' — rewrite")
check(6, "100 drafted ideas, 1 per problem, labelled, no source, constraints true, 20 high, no digits / money / banned-topic words", bad + flagged)

# 7. related ids exist
check(7, "every related_library_ids value exists in the library", [f"{d['id']}: unknown {r}" for d in drafted for r in d["related_library_ids"] if r not in lib_ids])

# 8. review sheet
rows = list(csv.DictReader(open(FILES["sheet"], encoding="utf-8", newline="")))
bad = []
if len(rows) != len(library) + 100: bad.append(f"{len(rows)} rows, expected {len(library) + 100}")
if {r["id"] for r in rows} != set(lib_ids) | {d["id"] for d in drafted}: bad.append("row ids do not match library + drafted ids")
kinds = [(r["kind"], r["priority"]) for r in rows]
if kinds != sorted(kinds, key=lambda k: 0 if k == ("drafted", "high") else 1 if k[0] == "library" else 2): bad.append("rows are not sorted: high drafted, library, other drafted")
if any(r["status"] or r["note"] for r in rows): bad.append("status / note must be left empty for the human")
if any(not r["check_this"] for r in rows): bad.append("check_this missing")
check(8, f"review sheet has {len(rows)} rows = {len(library)} library + 100 drafted, sorted, status and note empty", bad)

# English only: no Devanagari text and no *_ne fields in any of the four files
bad = [f"{path}: contains Devanagari text" for path in FILES.values() if re.search(r"[ऀ-ॿ]", open(path, encoding="utf-8").read())]
bad += [f"{path}: has a *_ne field" for path in FILES.values() if re.search(r"\b(problem|idea)_ne\b", open(path, encoding="utf-8").read())]
check("+", "English only: no Devanagari text, no *_ne fields", bad)

failed = False
for n, name, problems_found in results:
    status = "SKIP" if problems_found is None else "FAIL" if problems_found else "PASS"
    failed |= status == "FAIL"
    print(f"{status}  {n}. {name}")
    for p in problems_found or []:
        print(f"        - {p}")
print("\nproblems per tag: " + ", ".join(f"{t} {len(per_tag[t])}" for t in TAGS))
print("library per tag:  " + ", ".join(f"{t} {lib_per_tag[t]}" for t in TAGS))
sys.exit(1 if failed else 0)
