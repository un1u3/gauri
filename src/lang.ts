// Language helpers. Nothing here is specific to one language: names and scripts come from
// the browser's built-in Intl data, which works offline for any language code.
import type { Lang, Message } from "./types";

export const UNKNOWN = "und";

// Languages offered in the pickers, with their names in their own script. Browsers do not
// carry own-script names for every language, so these are written out; any other code
// (for example from imported data) is still accepted and named through Intl.
const AUTONYMS: Record<Lang, string> = {
  ne: "नेपाली", en: "English", hi: "हिन्दी", zh: "中文", ko: "한국어", ja: "日本語", fr: "Français", de: "Deutsch", es: "Español",
  it: "Italiano", pt: "Português", nl: "Nederlands", ru: "Русский", ar: "العربية", he: "עברית", tr: "Türkçe", th: "ไทย",
  vi: "Tiếng Việt", id: "Indonesia", ms: "Melayu", bn: "বাংলা", mr: "मराठी", ta: "தமிழ்", te: "తెలుగు", ur: "اردو", fa: "فارسی",
  mai: "मैथिली", bho: "भोजपुरी", new: "नेपाल भाषा", dz: "རྫོང་ཁ", bo: "བོད་སྐད", si: "සිංහල", my: "မြန်မာ", pl: "Polski", sv: "Svenska",
  da: "Dansk", fi: "Suomi", el: "Ελληνικά", uk: "Українська", cs: "Čeština", sw: "Kiswahili",
};
export const COMMON_LANGS: Lang[] = Object.keys(AUTONYMS);

// Name of a language, by default in that language itself ("한국어", "Français"), or in `inLang`.
export function langName(code: Lang, inLang?: Lang): string {
  if (code === UNKNOWN) return "?";
  if (!inLang && AUTONYMS[code]) return AUTONYMS[code];
  try {
    const name = new Intl.DisplayNames([inLang ?? code], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(inLang ?? code) + name.slice(1);
  } catch {
    return code;
  }
}

// Writing system a language normally uses, e.g. ne → "Deva", ar → "Arab", fr → "Latn".
export function scriptOf(code: Lang): string | undefined {
  try {
    return code === UNKNOWN ? undefined : new Intl.Locale(code).maximize().script;
  } catch {
    return undefined;
  }
}

// English name of that writing system, or "" for Latin (used in prompts: "Nepali in Devanagari script").
export function scriptHint(code: Lang): string {
  const s = scriptOf(code);
  return !s || s === "Latn" ? "" : ` in ${new Intl.DisplayNames(["en"], { type: "script" }).of(s === "Kore" ? "Hang" : s)} script`;
}

// Locale script codes that are mixtures → the Unicode scripts that identify them.
const SCRIPT_PARTS: Record<string, string[]> = { Hans: ["Han"], Hant: ["Han"], Jpan: ["Hiragana", "Katakana"], Kore: ["Hangul"] };

// True if the text contains at least one character of the language's writing system.
// This catches "the Nepali field came back in English"; it cannot tell French from English.
export function writtenIn(text: string, lang: Lang): boolean {
  if (!text.trim()) return false;
  const s = scriptOf(lang);
  if (!s) return true;
  try {
    return new RegExp((SCRIPT_PARTS[s] ?? [s]).map((n) => `\\p{Script=${n}}`).join("|"), "u").test(text);
  } catch {
    return true;
  }
}

// Guess a message's language from its script. Only a first guess: the owner can change it per message.
const BY_SCRIPT: [RegExp, Lang][] = [
  [/\p{Script=Hangul}/u, "ko"], [/\p{Script=Hiragana}|\p{Script=Katakana}/u, "ja"], [/\p{Script=Han}/u, "zh"],
  [/\p{Script=Devanagari}/u, "ne"], [/\p{Script=Arabic}/u, "ar"], [/\p{Script=Cyrillic}/u, "ru"], [/\p{Script=Thai}/u, "th"],
  [/\p{Script=Bengali}/u, "bn"], [/\p{Script=Tamil}/u, "ta"], [/\p{Script=Telugu}/u, "te"], [/\p{Script=Hebrew}/u, "he"],
  [/\p{Script=Greek}/u, "el"], [/\p{Script=Tibetan}/u, "bo"], [/\p{Script=Myanmar}/u, "my"], [/\p{Script=Sinhala}/u, "si"],
  [/\p{Script=Latin}/u, "en"],
];
export function guessLang(text: string): Lang {
  return BY_SCRIPT.find(([re]) => re.test(text))?.[1] ?? UNKNOWN;
}

// A real language code: well-formed and known to the browser's language data ("xx" is not).
export const isLangCode = (x: unknown): x is Lang => typeof x === "string" && /^[a-z]{2,3}$/.test(x) && (x === UNKNOWN || langName(x, "en").toLowerCase() !== x);
export const isRtl = (code: Lang) => ["ar", "he", "fa", "ur", "ps", "sd", "yi"].includes(code);
export const languagesIn = (messages: Message[]): Lang[] => [...new Set(messages.map((m) => m.lang))];
