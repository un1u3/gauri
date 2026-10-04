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

// Guess a message's language: first by script, then, where one script serves several languages,
// by a few very common words of each. Nobody is asked to correct this, so it has to be right by itself.
const BY_SCRIPT: [RegExp, Lang][] = [
  [/\p{Script=Hangul}/u, "ko"], [/\p{Script=Hiragana}|\p{Script=Katakana}/u, "ja"], [/\p{Script=Han}/u, "zh"],
  [/\p{Script=Devanagari}/u, "ne"], [/\p{Script=Arabic}/u, "ar"], [/\p{Script=Cyrillic}/u, "ru"], [/\p{Script=Thai}/u, "th"],
  [/\p{Script=Bengali}/u, "bn"], [/\p{Script=Tamil}/u, "ta"], [/\p{Script=Telugu}/u, "te"], [/\p{Script=Hebrew}/u, "he"],
  [/\p{Script=Greek}/u, "el"], [/\p{Script=Tibetan}/u, "bo"], [/\p{Script=Myanmar}/u, "my"], [/\p{Script=Sinhala}/u, "si"],
  [/\p{Script=Latin}/u, "en"],
];
const words = (list: string) => new Set(list.split(" "));
const COMMON_WORDS: Record<string, Record<Lang, Set<string>>> = {
  en: {
    en: words("the and was were is are we our very with for you thank thanks not but had have this that it to of in a at so there"),
    fr: words("le la les des est et un une nous très pas pour avec était merci dans que sur du au on se ce nos notre étaient"),
    de: words("der die das und ist nicht wir war sehr ein eine für mit danke auch im den zu es wäre gewesen waren durch"),
    es: words("el los las que es y un una muy para nos con gracias pero del fue por en la está sus nuestro como"),
    it: words("il lo gli che è e un una molto per con grazie non era della di la siamo abbiamo stato"),
    pt: words("o os as que é e um uma muito para com obrigado obrigada não foi da do em nós estava"),
  },
  ne: {
    hi: words("है हैं था थी थे के की में नहीं और हम हमें बहुत लिए आप भी से पर लगा का ने हुई गया अगर होता होती अच्छा यह वह कि कर"),
    ne: words("छ छन् थियो थिए भयो को मा लाई हो र पनि हामी धेरै भए हुन्छ लाग्यो छैन तपाईं सँग ले गरी भने"),
  },
};
// Nepali joins its small words to the noun ("घरमा", "पाहुनालाई"); Hindi writes them separately.
const NEPALI_ENDING = /(लाई|हरू|हरु|मा|ले|को|छ|यो|नुभयो|ियो)$/;

// The language the words point to, or null when they do not decide it.
export function guessByWords(text: string, scriptDefault: Lang): Lang | null {
  const lists = COMMON_WORDS[scriptDefault];
  if (!lists) return null;
  const tokens = text.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  const score: Record<Lang, number> = {};
  for (const [lang, list] of Object.entries(lists)) score[lang] = tokens.filter((w) => list.has(w)).length;
  if (scriptDefault === "ne") score.ne += tokens.filter((w) => w.length > 2 && NEPALI_ENDING.test(w)).length;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 && ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
}

// `sure` is false when only the script was recognised and that script serves several languages
// (a very short Latin or Devanagari message).
export function detectLang(text: string): { lang: Lang; sure: boolean } {
  const byScript = BY_SCRIPT.find(([re]) => re.test(text))?.[1] ?? UNKNOWN;
  const byWords = guessByWords(text, byScript);
  return { lang: byWords ?? byScript, sure: byWords !== null || !(byScript in COMMON_WORDS) };
}

export const guessLang = (text: string): Lang => detectLang(text).lang;

export const isLangCode = (x: unknown): x is Lang => typeof x === "string" && /^[a-z]{2,3}$/.test(x) && (x === UNKNOWN || langName(x, "en").toLowerCase() !== x);
export const isRtl = (code: Lang) => ["ar", "he", "fa", "ur", "ps", "sd", "yi"].includes(code);
export const languagesIn = (messages: Message[]): Lang[] => [...new Set(messages.map((m) => m.lang))];
