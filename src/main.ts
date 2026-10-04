import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "./style.css";
import sample from "../data/synthetic_messages.json";
import { analyse, draftThanks } from "./ai/analyse";
import { applyGuardrails, hasEnoughFeedback, languagesOf, NotSureError, notEnoughFeedback } from "./ai/guardrails";
import { OllamaError } from "./ai/ollama";
import { runChecks, type Check } from "./checks";
import { icon } from "./icons";
import { translate, type Key } from "./i18n";
import { fromJson, fromPaste } from "./messages";
import { MOCK_ANALYSIS, MOCK_DRAFTS } from "./mock";
import { clearAll, load, save } from "./store";
import { LANGS, LANG_NAMES, type Draft, type Lang, type Message, type Point } from "./types";
import { hasNepaliVoice, speakNepali, stopSpeaking } from "./voice";

type Screen = "summary" | "messages" | "follow" | "settings" | "checks";

let state = load();
let screen: Screen = "summary";
let busySince: number | null = null; // analysis running since (ms)
let error: string | null = null;
let noVoice = false;
let checks: Check[] | null = null;
const open = new Set<string>(); // expanded source lists
const drafting = new Set<string>(); // message ids being drafted
const editing = new Set<string>(); // draft ids being edited
const edited = new Set<string>();

const t = (key: Key, ...args: (string | number)[]) => translate(state.settings.ui, key, ...args);
const cfg = () => ({ baseUrl: "/ollama", model: state.settings.model, minMessages: state.settings.minMessages });

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
  el.append(...children.filter((c): c is Node | string => !!c));
  return el;
}
const button = (id: string, emoji: string, label: string, onclick: () => void, attrs: Record<string, unknown> = {}) =>
  h("button", { type: "button", id, onclick, ...attrs }, icon(emoji), label);

const live = h("div", { id: "live", class: "sr-only", "aria-live": "polite", role: "status" });
function announce(text: string) {
  live.textContent = "";
  live.lang = state.settings.ui;
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
    state.analysis = notEnoughFeedback(n, state.settings.model); // rule 4: the model is not called
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
      ? applyGuardrails(MOCK_ANALYSIS, state.messages, { model: "demo", seconds: 0 })
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
      ? { id: `d-${m.id}-${Date.now()}`, message_id: m.id, lang: m.lang, ...MOCK_DRAFTS[m.lang], status: "pending" }
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
  const lines = [
    "मासिक सारांश।",
    "पाहुनालाई मन परेको।", ...a.loved.map((p) => p.point_ne),
    "पाहुनाले चाहेको।", ...a.wished.map((p) => p.point_ne),
    ...(a.upgrade ? ["सुझाव।", a.upgrade.point_ne] : []),
    ...(a.uncertain.length ? ["निश्चित छैन, आफैं हेर्नुहोस्।", ...a.uncertain.map((u) => u.note_ne)] : []),
    "यो सुझाव मात्र हो। निर्णय तपाईंको।",
  ];
  noVoice = !speakNepali(lines.join(" "));
  if (noVoice) {
    announce(t("noVoice"));
    render();
  }
}

// ---------- screens ----------
function pointItem(p: Point, key: string): HTMLElement {
  const langs = languagesOf(p, state.messages);
  const isOpen = open.has(key);
  const cited = p.message_ids.map((id) => state.messages.find((m) => m.id === id)).filter((m): m is Message => !!m);
  return h("li", { class: "point" },
    h("p", { lang: "ne", class: "big" }, p.point_ne),
    state.settings.ui === "en" && h("p", { lang: "en" }, p.point_en),
    h("button", { type: "button", id: `src-${key}`, class: "link", "aria-expanded": String(isOpen), "aria-controls": `list-${key}`, onclick: () => { isOpen ? open.delete(key) : open.add(key); render(); } },
      icon(isOpen ? "▼" : "▶"), t("basedOn", cited.length), " · ",
      ...langs.flatMap((l, i) => [i ? ", " : "", h("span", { lang: l }, LANG_NAMES[l])])),
    isOpen && h("ul", { id: `list-${key}`, class: "sources" }, ...cited.map(messageLine)),
  );
}

const messageLine = (m: Message) =>
  h("li", {}, h("span", { class: "tag", lang: m.lang }, LANG_NAMES[m.lang]), " ", h("span", { lang: m.lang }, m.text));

function section(titleKey: Key, emoji: string, points: Point[], prefix: string, emptyKey: Key): HTMLElement {
  return h("section", {},
    h("h2", { class: `sec ${prefix}` }, icon(emoji), t(titleKey)),
    points.length ? h("ul", { class: "points" }, ...points.map((p, i) => pointItem(p, `${prefix}${i}`))) : h("p", {}, t(emptyKey)),
  );
}

function summaryScreen(): Child[] {
  const a = state.analysis;
  const n = state.messages.length, min = state.settings.minMessages;
  const out: Child[] = [
    h("h1", { tabindex: "-1" }, t("summaryTitle")),
    h("div", { class: "hero" },
      h("p", {}, icon("💬"), t("count", n)),
      button("analyse", "🔍", t("analyse"), runAnalysis, { class: "primary wide", disabled: busySince !== null })),
  ];
  if (busySince !== null) {
    out.push(h("div", { class: "notice busy" }, h("p", {}, icon("⏳"), t("analysing")), h("p", { id: "elapsed" }, t("elapsed", Math.round((Date.now() - busySince) / 1000)))));
    return out;
  }
  if (error) out.push(h("p", { class: "notice warn", role: "alert" }, icon("⚠️"), error));
  if (!hasEnoughFeedback(n, min) || a?.status === "not_enough_feedback") {
    out.push(h("div", { class: "notice" }, h("p", { class: "big" }, icon("✋"), t("notEnough", n, min)), h("p", {}, t("notEnoughHelp"))));
    return out;
  }
  if (!a) {
    out.push(h("p", {}, t("noAnalysis")));
    return out;
  }
  if (a.model === "demo") out.push(h("p", { class: "notice warn" }, icon("🎬"), t("demoOn")));
  out.push(
    h("div", { class: "row" },
      button("listen", "🔊", t("listen"), listen),
      button("stop", "⏹", t("stop"), stopSpeaking)),
    noVoice && h("p", { class: "notice warn", role: "alert" }, icon("🔇"), t("noVoice")),
    section("loved", "❤️", a.loved, "loved", "none"),
    section("wished", "💭", a.wished, "wished", "none"),
    section("upgrade", "💡", a.upgrade ? [a.upgrade] : [], "upgrade", "noUpgrade"),
    a.uncertain.length > 0 && h("section", { class: "uncertain" },
      h("h2", { class: "sec" }, icon("❓"), t("uncertain")),
      h("ul", {}, ...a.uncertain.map((u) => h("li", {}, h("p", { lang: "ne" }, u.note_ne), state.settings.ui === "en" && h("p", { lang: "en" }, u.note_en))))),
    h("footer", {},
      h("p", { class: "big" }, icon("🤝"), t("footer")),
      h("p", { class: "small" }, t("info", a.model, a.seconds, a.n_messages))),
  );
  return out;
}

function messagesScreen(): Child[] {
  const paste = h("textarea", { id: "paste", rows: "4" });
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
    h("h1", { tabindex: "-1" }, t("messagesTitle")),
    h("p", {}, t("count", state.messages.length)),
    error && h("p", { class: "notice warn", role: "alert" }, icon("⚠️"), error),
    h("label", { for: "paste" }, t("paste")),
    paste,
    button("add", "➕", t("add"), () => paste.value.trim() && addMessages(fromPaste(paste.value, state.messages)), { class: "primary" }),
    h("label", { for: "file" }, icon("📂"), t("importFile")),
    file,
    button("sample", "🧪", t("loadSample"), () => addMessages(fromJson(sample, state.messages))),
    state.messages.length === 0 && h("p", {}, t("noMessages")),
    h("ul", { class: "cards" }, ...state.messages.map((m) =>
      h("li", {},
        h("p", { lang: m.lang }, m.text),
        h("p", { class: "small" }, m.received_at, m.synthetic && h("span", { class: "tag" }, icon("🧪"), t("synthetic"))),
        h("div", { class: "row" },
          h("label", { for: `lang-${m.id}` }, t("language")),
          h("select", { id: `lang-${m.id}`, onchange: (e: Event) => { m.lang = (e.target as HTMLSelectElement).value as Lang; commit(); } },
            ...LANGS.map((l) => h("option", { value: l, lang: l, selected: l === m.lang }, LANG_NAMES[l]))),
          button(`del-${m.id}`, "🗑", t("del"), () => deleteMessage(m.id), { "aria-label": t("delMsg", m.id) })),
      ))),
  ];
}

function draftCard(d: Draft): HTMLElement {
  const m = state.messages.find((x) => x.id === d.message_id);
  const setStatus = (s: Draft["status"]) => () => { d.status = s; editing.delete(d.id); commit(); };
  const box = h("textarea", { id: `edit-${d.id}`, rows: "4", lang: d.lang, value: d.text });
  return h("li", {},
    h("p", { class: "small" }, t("to"), ": ", m?.contact ?? "", " · ", h("span", { lang: d.lang }, LANG_NAMES[d.lang])),
    h("h3", {}, t("meaning")),
    h("p", { lang: "ne", class: "big" }, d.text_ne),
    edited.has(d.id) && h("p", { class: "small" }, icon("✏️"), t("edited")),
    h("h3", {}, t("guestText")),
    editing.has(d.id)
      ? h("div", {}, h("label", { for: `edit-${d.id}` }, t("editLabel")), box,
          button(`save-${d.id}`, "💾", t("saveEdit"), () => { d.text = box.value.trim() || d.text; edited.add(d.id); editing.delete(d.id); commit(); }, { class: "primary" }))
      : h("p", { lang: d.lang }, d.text),
    d.status === "approved"
      ? h("div", {},
          h("p", {}, icon("✅"), h("strong", {}, t("approved"))),
          h("div", { class: "row" },
            button(`copy-${d.id}`, "📋", t("copy"), () => copyDraft(d), { class: "primary" }),
            button(`edit-btn-${d.id}`, "✏️", t("edit"), () => { d.status = "pending"; editing.add(d.id); commit(); }),
            button(`discard-${d.id}`, "🗑", t("discard"), setStatus("discarded"))),
          h("p", { id: `copied-${d.id}` }))
      : h("div", { class: "row" },
          button(`approve-${d.id}`, "✅", t("approve"), setStatus("approved"), { class: "primary" }),
          button(`edit-btn-${d.id}`, "✏️", t("edit"), () => { editing.add(d.id); render(); }),
          button(`discard-${d.id}`, "🗑", t("discard"), setStatus("discarded"))),
  );
}

function followScreen(): Child[] {
  const drafts = state.drafts.filter((d) => d.status !== "discarded");
  const waiting = state.messages.filter((m) => m.contact && !drafts.some((d) => d.message_id === m.id));
  return [
    h("h1", { tabindex: "-1" }, t("followTitle")),
    h("p", { class: "notice" }, icon("✋"), t("neverSends")),
    error && h("p", { class: "notice warn", role: "alert" }, icon("⚠️"), error),
    h("h2", {}, t("drafts")),
    drafts.length ? h("ul", { class: "cards" }, ...drafts.map(draftCard)) : h("p", {}, t("noDrafts")),
    h("h2", {}, t("guests")),
    waiting.length
      ? h("ul", { class: "cards" }, ...waiting.map((m) =>
          h("li", {},
            h("p", { lang: m.lang }, m.text),
            h("p", { class: "small" }, m.contact, " · ", h("span", { lang: m.lang }, LANG_NAMES[m.lang])),
            drafting.has(m.id)
              ? h("p", {}, icon("⏳"), t("drafting"))
              : button(`draft-${m.id}`, "🙏", t("draft"), () => makeDraft(m), { "aria-label": `${t("draft")}: ${m.contact}` }))))
      : h("p", {}, t("noGuests")),
  ];
}

function settingsScreen(): Child[] {
  const s = state.settings;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => { s[k] = v; commit(); };
  const choice = (id: string, labelKey: Key, value: string, options: [string, string][], onchange: (v: string) => void) => [
    h("label", { for: id }, t(labelKey)),
    h("select", { id, onchange: (e: Event) => onchange((e.target as HTMLSelectElement).value) }, ...options.map(([v, text]) => h("option", { value: v, selected: v === value }, text))),
  ];
  return [
    h("h1", { tabindex: "-1" }, t("settingsTitle")),
    ...choice("ui", "uiLang", s.ui, [["ne", "नेपाली"], ["en", "English"]], (v) => set("ui", v as typeof s.ui)),
    ...choice("size", "textSize", s.textSize, [["normal", t("sizeNormal")], ["large", t("sizeLarge")], ["xlarge", t("sizeXlarge")]], (v) => set("textSize", v as typeof s.textSize)),
    h("div", { class: "row" },
      h("input", { type: "checkbox", id: "demo", checked: s.demo, onchange: (e: Event) => set("demo", (e.target as HTMLInputElement).checked) }),
      h("label", { for: "demo" }, t("demo"))),
    h("label", { for: "model" }, t("model")),
    h("input", { type: "text", id: "model", value: s.model, onchange: (e: Event) => set("model", (e.target as HTMLInputElement).value.trim() || s.model) }),
    h("label", { for: "min" }, t("minMessages")),
    h("input", { type: "number", id: "min", min: "2", max: "100", value: String(s.minMessages), onchange: (e: Event) => set("minMessages", Math.max(2, Number((e.target as HTMLInputElement).value) || s.minMessages)) }),
    h("h2", {}, icon("📝"), t("consentTitle")),
    h("p", {}, t("consent")),
    h("p", {}, icon("📱"), t("onDevice")),
    button("checks", "🛡", t("openChecks"), () => go("checks")),
    button("clear", "🗑", t("clear"), () => {
      if (!confirm(t("clearConfirm"))) return;
      state = clearAll();
      error = null;
      announce(t("cleared"));
      render();
    }, { class: "danger" }),
  ];
}

function checksScreen(): Child[] {
  return [
    h("h1", { tabindex: "-1" }, t("checksTitle")),
    h("p", {}, t("checksIntro")),
    button("run-checks", "🛡", t("runChecks"), async () => {
      checks = await runChecks();
      announce(t("checksDone", checks.length, checks.filter((c) => c.pass).length));
      render();
    }, { class: "primary" }),
    checks && h("p", { class: "big" }, t("checksDone", checks.length, checks.filter((c) => c.pass).length)),
    checks && h("ul", { class: "cards" }, ...checks.map((c) =>
      h("li", {}, h("strong", { class: c.pass ? "pass" : "fail" }, icon(c.pass ? "✅" : "❌"), t(c.pass ? "pass" : "fail")), " — ", state.settings.ui === "ne" ? c.ne : c.en))),
    button("back", "⬅", t("back"), () => go("settings")),
  ];
}

// ---------- shell ----------
const SCREENS: Record<Screen, () => Child[]> = { summary: summaryScreen, messages: messagesScreen, follow: followScreen, settings: settingsScreen, checks: checksScreen };
const NAV: [Screen, string, Key][] = [["summary", "📊", "navSummary"], ["messages", "💬", "navMessages"], ["follow", "🙏", "navFollow"], ["settings", "⚙️", "navSettings"]];

function go(to: Screen) {
  screen = to;
  error = null;
  render();
  document.querySelector<HTMLElement>("h1")!.focus();
}

const app = document.querySelector("#app")!;
function render() {
  const focused = document.activeElement?.id;
  document.documentElement.lang = state.settings.ui;
  document.documentElement.dataset.size = state.settings.textSize;
  app.replaceChildren(
    h("header", {},
      h("div", { class: "appbar" },
        h("p", { class: "brand", lang: "ne" }, icon("🌱"), "गौरी"),
        h("p", { class: "tagline" }, t("tagline"))),
      h("nav", { "aria-label": t("navLabel") },
        h("ul", {}, ...NAV.map(([s, emoji, key]) =>
          h("li", {}, button(`nav-${s}`, emoji, t(key), () => go(s), { "aria-current": s === screen || (s === "settings" && screen === "checks") ? "page" : null })))))),
    h("main", {}, ...SCREENS[screen]()),
  );
  document.title = `${t("app")} · ${document.querySelector("h1")!.textContent}`;
  if (focused) document.getElementById(focused)?.focus(); // keep keyboard / TalkBack position across re-renders
}

document.body.append(live);
if (typeof speechSynthesis !== "undefined") speechSynthesis.onvoiceschanged = () => { if (noVoice && hasNepaliVoice()) { noVoice = false; render(); } };
render();
