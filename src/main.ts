import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "./style.css";
import sample from "../data/synthetic_messages.json";
import { analyse, draftThanks } from "./ai/analyse";
import { translateLabels } from "./ai/translate";
import { applyGuardrails, hasEnoughFeedback, languagesOf, NotSureError, notEnoughFeedback } from "./ai/guardrails";
import { OllamaError } from "./ai/ollama";
import { runChecks, type Check } from "./checks";
import { icon } from "./icons";
import { hasLabels, KEYS, setPacks, translate, type Key } from "./i18n";
import { COMMON_LANGS, isRtl, langName, languagesIn, UNKNOWN } from "./lang";
import { fromJson, fromPaste } from "./messages";
import { MOCK_ANALYSIS, MOCK_DRAFTS } from "./mock";
import { clearAll, load, save } from "./store";
import type { Draft, Lang, Message, Point } from "./types";
import { hasVoice, speak, stopSpeaking } from "./voice";

type Screen = "summary" | "messages" | "follow" | "settings" | "checks";

let state = load();
let screen: Screen = "summary";
let busySince: number | null = null; // analysis running since (ms)
let error: string | null = null;
let noVoice = false;
let entering = false;
let checks: Check[] | null = null;
const open = new Set<string>(); // expanded source lists
const drafting = new Set<string>(); // message ids being drafted
const editing = new Set<string>(); // draft ids being edited
const edited = new Set<string>();

let translating: [number, number] | null = null; // label translation progress

const owner = () => state.settings.ownerLang;
// Language the app's own labels are shown in: the owner's (when labels exist for it), else English.
const uiLang = (): Lang => (state.settings.ui === "own" && hasLabels(owner()) ? owner() : "en");
const t = (key: Key, ...args: (string | number)[]) => translate(uiLang(), key, ...args);
const cfg = () => ({ baseUrl: "/ollama", model: state.settings.model, minMessages: state.settings.minMessages, ownerLang: owner() });
const nameOf = (l: Lang) => (l === UNKNOWN ? t("unknownLang") : langName(l));
// A language named inside a sentence of the app: in the app's language, so it reads as one sentence.
const nameInUi = (l: Lang) => (l === uiLang() ? langName(l) : langName(l, uiLang()));

// ---------- tiny DOM helpers ----------
type Child = Node | string | null | false | undefined;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "value" || k === "checked" || k === "selected") (el as any)[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  if (attrs.lang && tag !== "option") el.setAttribute("dir", "auto"); // right-to-left languages lay out correctly
  el.append(...children.filter((c): c is Node | string => !!c));
  return el;
}
const button = (id: string, emoji: string, label: string, onclick: () => void, attrs: Record<string, unknown> = {}) =>
  h("button", { type: "button", id, onclick, ...attrs }, icon(emoji), label);

const live = h("div", { id: "live", class: "sr-only", "aria-live": "polite", role: "status" });
function announce(text: string) {
  live.textContent = "";
  live.lang = uiLang();
  setTimeout(() => (live.textContent = text), 50);
}

function commit() {
  save(state);
  render();
}

// ---------- actions ----------
async function runAnalysis() {
  error = null;
  const n = state.messages.length;
  if (!hasEnoughFeedback(n, state.settings.minMessages)) {
    state.analysis = notEnoughFeedback(n, state.settings.model, owner()); // rule 4: the model is not called
    announce(t("notEnough", n, state.settings.minMessages));
    return commit();
  }
  busySince = Date.now();
  render();
  announce(t("analysing"));
  const timer = setInterval(() => {
    const el = document.getElementById("elapsed");
    if (el) el.textContent = t("elapsed", Math.round((Date.now() - busySince!) / 1000));
  }, 1000);
  try {
    state.analysis = state.settings.demo
      ? applyGuardrails(MOCK_ANALYSIS, state.messages, { model: "demo", seconds: 0, lang: "ne" })
      : await analyse(state.messages, cfg());
    const a = state.analysis;
    announce(t("ready", a.loved.length + a.wished.length + (a.upgrade ? 1 : 0)));
  } catch (e) {
    error = errorText(e);
    announce(error);
  }
  clearInterval(timer);
  busySince = null;
  commit();
}

function errorText(e: unknown): string {
  if (e instanceof NotSureError) return t("errNotSure");
  if (e instanceof OllamaError) return e.message === "model_missing" ? t("errModel", state.settings.model) : t("errOllama");
  throw e;
}

function addMessages(added: Message[]) {
  state.messages.push(...added);
  announce(t("added", added.length));
  commit();
}

function deleteMessage(id: string) {
  state.messages = state.messages.filter((m) => m.id !== id);
  state.drafts = state.drafts.filter((d) => d.message_id !== id);
  state.analysis = null; // a summary must never cite a message that is gone
  announce(t("deleted"));
  commit();
}

async function makeDraft(m: Message) {
  error = null;
  drafting.add(m.id);
  render();
  try {
    const d: Draft = state.settings.demo
      ? { id: `d-${m.id}-${Date.now()}`, message_id: m.id, lang: m.lang, ...(MOCK_DRAFTS[m.lang] ?? MOCK_DRAFTS.en), own_lang: "ne", status: "pending" }
      : await draftThanks(m, cfg());
    state.drafts.unshift(d);
    announce(t("draftReady"));
  } catch (e) {
    error = errorText(e);
    announce(error);
  }
  drafting.delete(m.id);
  commit();
}

// Copying is the only thing an approved draft can do. Gauri has no way to send it.
async function copyDraft(d: Draft) {
  try {
    await navigator.clipboard.writeText(d.text);
  } catch {
    // Clipboard API needs https or localhost; fall back to selecting the text.
    const ta = h("textarea", { value: d.text });
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  announce(t("copied"));
  document.getElementById(`copied-${d.id}`)!.textContent = t("copied");
}

function listen() {
  const a = state.analysis!;
  // Headings are read only if the app has labels in the summary's language.
  const say = (key: Key) => (hasLabels(a.lang) ? [`${translate(a.lang, key)}.`] : []);
  const lines = [
    ...say("summaryTitle"),
    ...say("loved"), ...a.loved.map((p) => p.point_own),
    ...say("wished"), ...a.wished.map((p) => p.point_own),
    ...(a.upgrade ? [...say("upgrade"), a.upgrade.point_own] : []),
    ...(a.uncertain.length ? [...say("uncertain"), ...a.uncertain.map((u) => u.note_own)] : []),
    ...say("footer"),
  ];
  noVoice = !speak(lines.join(" "), a.lang);
  if (noVoice) {
    announce(t("noVoice", nameInUi(a.lang)));
    render();
  }
}

async function translateApp() {
  error = null;
  translating = [0, KEYS.length];
  render();
  try {
    const pack = await translateLabels(cfg(), (done, total) => { translating = [done, total]; render(); });
    const n = Object.keys(pack).length;
    if (n) state.packs[owner()] = pack; // labels that failed their check stay in English
    setPacks(state.packs);
    translating = null;
    commit();
    announce(t("translated", n, KEYS.length));
  } catch (e) {
    translating = null;
    error = errorText(e);
    announce(error);
    render();
  }
}

// ---------- screens ----------
// Round language badge, like a profile picture: the first letters of the language's own name.
// Decoration: the language name is always written next to it.
const SHORT: Record<string, string> = { en: "EN", ko: "한", hi: "हि", zh: "中", ne: "ने" };
function avatar(l: Lang, cls = ""): HTMLElement {
  const name = langName(l);
  const short = SHORT[l] ?? (l === UNKNOWN ? "?" : /^\p{Script=Latin}/u.test(name) ? l.toUpperCase() : [...name][0]);
  // Other languages get a stable colour from their code (dark enough for white text).
  const hue = [...l].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) % 360;
  return h("span", { class: `avatar ${l} ${cls}`, lang: l, "aria-hidden": "true", style: SHORT[l] ? null : `background:hsl(${hue} 55% 32%)` }, short);
}
const chip = (emoji: string, ...children: Child[]) => h("span", { class: "meta" }, icon(emoji), ...children);
const alertBox = () => error && h("p", { class: "notice warn", role: "alert" }, icon("⚠️"), error);

// For judges: the English version under each owner-language text.
const showEnglish = () => uiLang() === "en" && state.analysis?.lang !== "en";

function pointItem(p: Point, key: string, emoji: string): HTMLElement {
  const langs = languagesOf(p, state.messages);
  const isOpen = open.has(key);
  const cited = p.message_ids.map((id) => state.messages.find((m) => m.id === id)).filter((m): m is Message => !!m);
  return h("li", { class: `point ${key.replace(/\d+$/, "")}` },
    h("div", { class: "point-head" },
      h("span", { class: "badge" }, icon(emoji)),
      h("div", {},
        h("p", { lang: state.analysis!.lang, class: "big" }, p.point_own),
        showEnglish() && h("p", { lang: "en", class: "small" }, p.point_en))),
    h("button", { type: "button", id: `src-${key}`, class: "link", "aria-expanded": String(isOpen), "aria-controls": `list-${key}`, onclick: () => { isOpen ? open.delete(key) : open.add(key); render(); } },
      h("span", { class: "pile" }, ...langs.map((l) => avatar(l, "mini"))),
      h("span", { class: "link-text" }, t("basedOn", cited.length), " · ", ...langs.flatMap((l, i) => [i ? ", " : "", h("span", { lang: l }, nameOf(l))])),
      icon(isOpen ? "▼" : "▶")),
    isOpen && h("ul", { id: `list-${key}`, class: "sources" }, ...cited.map((m) =>
      h("li", {}, avatar(m.lang), h("div", { class: "bubble" }, h("span", { class: "who", lang: m.lang }, nameOf(m.lang)), h("span", { lang: m.lang }, m.text))))),
  );
}

function section(titleKey: Key, emoji: string, points: Point[], prefix: string, emptyKey: Key): HTMLElement {
  return h("section", {},
    h("h2", { class: `sec ${prefix}` }, icon(emoji), t(titleKey), points.length > 0 && h("span", { class: "count" }, String(points.length))),
    points.length ? h("ul", { class: "points" }, ...points.map((p, i) => pointItem(p, `${prefix}${i}`, emoji))) : h("p", { class: "empty" }, t(emptyKey)),
  );
}

function summaryScreen(): Child[] {
  const a = state.analysis;
  const n = state.messages.length, min = state.settings.minMessages;
  const present = languagesIn(state.messages);
  const stat = (emoji: string, value: number, label: Key) => h("li", {}, icon(emoji), h("strong", {}, String(value)), h("span", {}, t(label)));
  const out: Child[] = [
    h("h1", { tabindex: "-1" }, t("summaryTitle")),
    h("div", { class: "hero" },
      h("p", { class: "hero-title" }, icon("✨"), t("heroTitle")),
      h("ul", { class: "stats" },
        stat("💬", n, "statMessages"),
        stat("🌐", present.length, "statLangs"),
        stat("👤", state.messages.filter((m) => m.contact).length, "statContacts")),
      button("analyse", "🔍", t("analyse"), runAnalysis, { class: "cta", disabled: busySince !== null })),
    present.length > 0 && h("div", { class: "stories" },
      h("p", { class: "label" }, t("guestLangs")),
      h("ul", {}, ...present.map((l) =>
        h("li", {}, h("span", { class: "ring" }, avatar(l, "story")), h("span", { class: "story-name", lang: l }, nameOf(l)), h("span", { class: "story-n" }, String(state.messages.filter((m) => m.lang === l).length)))))),
  ];
  if (busySince !== null) {
    out.push(
      h("div", { class: "notice busy" }, h("p", {}, icon("⏳"), t("analysing")), h("p", { id: "elapsed", class: "small" }, t("elapsed", Math.round((Date.now() - busySince) / 1000)))),
      ...[0, 1, 2].map(() => h("div", { class: "skeleton", "aria-hidden": "true" }, h("span", {}), h("span", {}), h("span", {}))));
    return out;
  }
  out.push(alertBox());
  if (!hasEnoughFeedback(n, min) || a?.status === "not_enough_feedback") {
    out.push(h("div", { class: "notice" }, h("p", { class: "big" }, icon("✋"), t("notEnough", n, min)), h("p", {}, t("notEnoughHelp")),
      h("div", { class: "meter", "aria-hidden": "true" }, h("span", { style: `width:${Math.min(100, (n / min) * 100)}%` }))));
    return out;
  }
  if (!a) {
    out.push(h("p", { class: "empty" }, icon("ℹ️"), t("noAnalysis")));
    return out;
  }
  if (a.model === "demo") out.push(h("p", { class: "notice warn" }, icon("🎬"), t("demoOn")));
  out.push(
    h("div", { class: "row" },
      button("listen", "🔊", t("listen"), listen, { class: "tonal" }),
      button("stop", "⏹", t("stop"), stopSpeaking)),
    noVoice && h("p", { class: "notice warn", role: "alert" }, icon("🔇"), t("noVoice", nameInUi(a.lang))),
    section("loved", "❤️", a.loved, "loved", "none"),
    section("wished", "💭", a.wished, "wished", "none"),
    section("upgrade", "💡", a.upgrade ? [a.upgrade] : [], "upgrade", "noUpgrade"),
    a.uncertain.length > 0 && h("section", { class: "uncertain" },
      h("h2", { class: "sec" }, icon("❓"), t("uncertain")),
      h("ul", {}, ...a.uncertain.map((u) => h("li", {},
        u.reason && h("p", { class: "small" }, icon("👤"), t(u.reason === "single_guest" ? "onlyOne" : "weakUpgrade"), ":"),
        h("p", { lang: a.lang }, u.note_own),
        showEnglish() && h("p", { lang: "en", class: "small" }, u.note_en))))),
    h("footer", {},
      h("p", { class: "big" }, icon("🤝"), t("footer")),
      h("p", { class: "small" }, icon("🤖"), t("info", a.model, a.seconds, a.n_messages))),
  );
  return out;
}

// Header of a feed card: language avatar, who, and small facts with icons.
const postHead = (m: Message, title: Child) =>
  h("div", { class: "post-head" }, avatar(m.lang),
    h("div", {},
      h("strong", {}, title),
      h("span", { class: "metas" },
        chip("🌐", h("span", { lang: m.lang }, nameOf(m.lang))),
        chip("📅", m.received_at),
        m.synthetic && h("span", { class: "tag" }, icon("🧪"), t("synthetic")))));

// Every language can be picked; one that came in with imported data is kept in the list too.
const langOptions = (current: Lang, withUnknown = true) =>
  [...new Set([current, ...COMMON_LANGS, ...languagesIn(state.messages), ...(withUnknown ? [UNKNOWN] : [])])]
    .filter((l) => withUnknown || l !== UNKNOWN)
    .map((l) => h("option", { value: l, lang: l === UNKNOWN ? null : l, selected: l === current }, l === UNKNOWN ? `? ${t("unknownLang")}` : `${langName(l)} (${l})`));

function messagesScreen(): Child[] {
  const paste = h("textarea", { id: "paste", rows: "3" });
  const file = h("input", { type: "file", id: "file", accept: ".json,application/json", onchange: async () => {
    error = null;
    try {
      addMessages(fromJson(JSON.parse(await file.files![0].text()), state.messages));
    } catch {
      error = t("importBad");
      announce(error);
      render();
    }
  } });
  return [
    h("h1", { tabindex: "-1" }, t("messagesTitle"), h("span", { class: "count" }, String(state.messages.length))),
    alertBox(),
    h("div", { class: "card composer" },
      h("label", { for: "paste" }, icon("✏️"), t("paste")),
      paste,
      button("add", "➕", t("add"), () => paste.value.trim() && addMessages(fromPaste(paste.value, state.messages)), { class: "primary wide" }),
      h("label", { for: "file" }, icon("📂"), t("importFile")),
      file,
      button("sample", "🧪", t("loadSample"), () => addMessages(fromJson(sample, state.messages)), { class: "tonal wide" })),
    state.messages.length === 0 && h("p", { class: "empty" }, icon("💬"), t("noMessages")),
    h("ul", { class: "cards" }, ...state.messages.map((m) =>
      h("li", {},
        postHead(m, m.contact ?? t("guest")),
        h("p", { lang: m.lang, class: "post-text" }, m.text),
        h("div", { class: "actions" },
          button(`del-${m.id}`, "🗑", t("del"), () => deleteMessage(m.id), { "aria-label": t("delMsg", m.id), class: "ghost danger-text" }),
          h("label", { for: `lang-${m.id}` }, icon("🌐"), t("language")),
          h("select", { id: `lang-${m.id}`, onchange: (e: Event) => { m.lang = (e.target as HTMLSelectElement).value as Lang; commit(); } },
            ...langOptions(m.lang))),
      ))),
  ];
}

function draftCard(d: Draft): HTMLElement {
  const m = state.messages.find((x) => x.id === d.message_id)!;
  const setStatus = (s: Draft["status"]) => () => { d.status = s; editing.delete(d.id); commit(); };
  const box = h("textarea", { id: `edit-${d.id}`, rows: "4", lang: d.lang, value: d.text });
  const approved = d.status === "approved";
  return h("li", { class: approved ? "approved" : "" },
    postHead(m, m.contact ?? t("guest")),
    h("h3", {}, icon("💬"), t("theirMessage")),
    h("p", { lang: m.lang, class: "quote" }, m.text),
    h("h3", {}, icon("🌱"), t("meaning")),
    h("p", { lang: d.own_lang, class: "big reply" }, d.text_own),
    edited.has(d.id) && h("p", { class: "small" }, icon("✏️"), t("edited")),
    h("h3", {}, icon("🌐"), t("guestText")),
    editing.has(d.id)
      ? h("div", {}, h("label", { for: `edit-${d.id}` }, t("editLabel")), box,
          button(`save-${d.id}`, "💾", t("saveEdit"), () => { d.text = box.value.trim() || d.text; edited.add(d.id); editing.delete(d.id); commit(); }, { class: "primary wide" }))
      : h("p", { lang: d.lang, class: "reply" }, d.text),
    approved && h("p", { class: "status" }, icon("✅"), h("strong", {}, t("approved"))),
    approved && button(`copy-${d.id}`, "📋", t("copy"), () => copyDraft(d), { class: "primary wide" }),
    approved && h("p", { id: `copied-${d.id}`, class: "small" }),
    h("div", { class: "actions three" },
      !approved && button(`approve-${d.id}`, "✅", t("approve"), setStatus("approved"), { class: "ghost ok-text" }),
      button(`edit-btn-${d.id}`, "✏️", t("edit"), () => { d.status = "pending"; editing.add(d.id); commit(); }, { class: "ghost" }),
      button(`discard-${d.id}`, "🗑", t("discard"), setStatus("discarded"), { class: "ghost danger-text" })),
  );
}

function followScreen(): Child[] {
  const drafts = state.drafts.filter((d) => d.status !== "discarded");
  const waiting = state.messages.filter((m) => m.contact && !drafts.some((d) => d.message_id === m.id));
  return [
    h("h1", { tabindex: "-1" }, t("followTitle")),
    h("p", { class: "notice safe" }, icon("🔒"), t("neverSends")),
    alertBox(),
    h("h2", { class: "sec" }, icon("📝"), t("drafts"), drafts.length > 0 && h("span", { class: "count" }, String(drafts.length))),
    drafts.length ? h("ul", { class: "cards" }, ...drafts.map(draftCard)) : h("p", { class: "empty" }, t("noDrafts")),
    h("h2", { class: "sec" }, icon("👤"), t("guests"), waiting.length > 0 && h("span", { class: "count" }, String(waiting.length))),
    waiting.length
      ? h("ul", { class: "cards" }, ...waiting.map((m) =>
          h("li", {},
            postHead(m, m.contact),
            h("p", { lang: m.lang, class: "post-text" }, m.text),
            drafting.has(m.id)
              ? h("p", { class: "notice busy" }, icon("⏳"), t("drafting"))
              : button(`draft-${m.id}`, "🙏", t("draft"), () => makeDraft(m), { "aria-label": `${t("draft")}: ${m.contact}`, class: "tonal wide" }))))
      : h("p", { class: "empty" }, t("noGuests")),
  ];
}

function settingsScreen(): Child[] {
  const s = state.settings;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => { s[k] = v; commit(); };
  const field = (emoji: string, id: string, labelKey: Key, control: HTMLElement) => h("div", { class: "field" }, h("label", { for: id }, icon(emoji), t(labelKey)), control);
  const choice = (emoji: string, id: string, labelKey: Key, value: string, options: [string, string][], onchange: (v: string) => void) =>
    field(emoji, id, labelKey, h("select", { id, onchange: (e: Event) => onchange((e.target as HTMLSelectElement).value) }, ...options.map(([v, text]) => h("option", { value: v, selected: v === value }, text))));
  return [
    h("h1", { tabindex: "-1" }, t("settingsTitle")),
    alertBox(),
    h("h2", { class: "sec" }, icon("🔤"), t("secAppearance")),
    h("div", { class: "card" },
      field("🌐", "owner", "myLang", h("select", { id: "owner", onchange: (e: Event) => { s.ui = "own"; set("ownerLang", (e.target as HTMLSelectElement).value); } }, ...langOptions(s.ownerLang, false))),
      h("p", { class: "small" }, t("myLangHelp")),
      !hasLabels(s.ownerLang) && (translating
        ? h("div", { class: "notice busy" }, h("p", {}, icon("⏳"), t("translating", translating[0], translating[1])),
            h("div", { class: "meter", "aria-hidden": "true" }, h("span", { style: `width:${(translating[0] / translating[1]) * 100}%` })))
        : h("div", {}, button("translate", "✨", t("translateApp", nameInUi(s.ownerLang)), translateApp, { class: "primary wide" }), h("p", { class: "small" }, t("translateHelp")))),
      !!state.packs[s.ownerLang] && h("p", { class: "notice" }, icon("ℹ️"), t("aiLabels")),
      choice("🔤", "size", "textSize", s.textSize, [["normal", t("sizeNormal")], ["large", t("sizeLarge")], ["xlarge", t("sizeXlarge")]], (v) => set("textSize", v as typeof s.textSize))),
    h("h2", { class: "sec" }, icon("🤖"), t("secAi")),
    h("div", { class: "card" },
      field("🤖", "model", "model", h("input", { type: "text", id: "model", value: s.model, onchange: (e: Event) => set("model", (e.target as HTMLInputElement).value.trim() || s.model) })),
      field("🔢", "min", "minMessages", h("input", { type: "number", id: "min", min: "2", max: "100", value: String(s.minMessages), onchange: (e: Event) => set("minMessages", Math.max(2, Number((e.target as HTMLInputElement).value) || s.minMessages)) })),
      h("div", { class: "field check" },
        h("input", { type: "checkbox", id: "demo", checked: s.demo, onchange: (e: Event) => set("demo", (e.target as HTMLInputElement).checked) }),
        h("label", { for: "demo" }, icon("🎬"), t("demo")))),
    h("h2", { class: "sec" }, icon("🛡"), t("secPrivacy")),
    h("div", { class: "card" },
      h("h3", {}, icon("📝"), t("consentTitle")),
      h("p", {}, t("consent")),
      h("p", { class: "notice safe" }, icon("📱"), t("onDevice")),
      button("checks", "🛡", t("openChecks"), () => go("checks"), { class: "tonal wide" }),
      button("clear", "🗑", t("clear"), () => {
        if (!confirm(t("clearConfirm"))) return;
        state = clearAll();
        setPacks(state.packs);
        error = null;
        announce(t("cleared"));
        render();
      }, { class: "danger wide" })),
  ];
}

function checksScreen(): Child[] {
  const passed = checks?.filter((c) => c.pass).length ?? 0;
  return [
    h("h1", { tabindex: "-1" }, t("checksTitle")),
    h("p", {}, t("checksIntro")),
    button("run-checks", "🛡", t("runChecks"), async () => {
      checks = await runChecks();
      announce(t("checksDone", checks.length, checks.filter((c) => c.pass).length));
      render();
    }, { class: "primary wide" }),
    checks && h("p", { class: "notice safe big" }, icon("🛡"), t("checksDone", checks.length, passed)),
    checks && h("ul", { class: "cards checks" }, ...checks.map((c) =>
      h("li", {}, h("strong", { class: c.pass ? "pass" : "fail" }, icon(c.pass ? "✅" : "❌"), t(c.pass ? "pass" : "fail")), h("span", {}, uiLang() === "ne" ? c.ne : c.en)))),
    button("back", "⬅", t("back"), () => go("settings"), { class: "wide" }),
  ];
}

// ---------- shell ----------
const SCREENS: Record<Screen, () => Child[]> = { summary: summaryScreen, messages: messagesScreen, follow: followScreen, settings: settingsScreen, checks: checksScreen };
const NAV: [Screen, string, Key][] = [["summary", "📊", "navSummary"], ["messages", "💬", "navMessages"], ["follow", "🙏", "navFollow"], ["settings", "⚙️", "navSettings"]];

function go(to: Screen) {
  screen = to;
  error = null;
  entering = true; // slide-in only when changing tab, not on every update
  render();
  entering = false;
  window.scrollTo(0, 0);
  document.querySelector<HTMLElement>("h1")!.focus();
}

const app = document.querySelector("#app")!;
function render() {
  const focused = document.activeElement?.id;
  const ui = uiLang();
  // The switch offers the other of the two: the owner's language or English (for judges).
  const other: Lang = state.settings.ui === "own" ? "en" : owner();
  document.documentElement.lang = ui;
  document.documentElement.dir = isRtl(ui) ? "rtl" : "ltr";
  document.documentElement.dataset.size = state.settings.textSize;
  const badges: Partial<Record<Screen, number>> = { messages: state.messages.length, follow: state.drafts.filter((d) => d.status === "pending").length };
  app.replaceChildren(
    h("header", {},
      h("div", { class: "appbar" },
        h("p", { class: "brand", lang: "ne" }, h("span", { class: "logo" }, icon("🌱")), "गौरी"),
        owner() !== "en" && h("button", { type: "button", id: "ui-toggle", class: "pill", "aria-label": langName(other), onclick: () => { state.settings.ui = state.settings.ui === "own" ? "en" : "own"; commit(); } },
          icon("🌐"), h("span", { lang: other }, SHORT[other] ?? other.toUpperCase()))),
      h("nav", { "aria-label": t("navLabel") },
        h("ul", {}, ...NAV.map(([s, emoji, key]) =>
          h("li", {}, h("button", { type: "button", id: `nav-${s}`, onclick: () => go(s), "aria-current": s === screen || (s === "settings" && screen === "checks") ? "page" : null },
            h("span", { class: "tab-icon" }, icon(emoji), !!badges[s] && h("span", { class: "dot" }, String(badges[s]))), t(key))))))),
    h("main", { class: entering ? `${screen} enter` : screen }, ...SCREENS[screen]()),
  );
  document.title = `${t("app")} · ${document.querySelector("h1")!.firstChild!.textContent}`;
  if (focused) document.getElementById(focused)?.focus(); // keep keyboard / TalkBack position across re-renders
}

document.body.append(live);
setPacks(state.packs);
if (typeof speechSynthesis !== "undefined") speechSynthesis.onvoiceschanged = () => { if (noVoice && state.analysis && hasVoice(state.analysis.lang)) { noVoice = false; render(); } };
render();
