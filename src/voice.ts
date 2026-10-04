// Read-aloud with the browser's built-in speech (offline when the phone has a voice for the language).
import type { Lang } from "./types";

const voiceFor = (lang: Lang) => (typeof speechSynthesis === "undefined" ? undefined : speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang)));

export const hasVoice = (lang: Lang) => !!voiceFor(lang);

// Returns false (and stays silent) rather than reading the text with another language's voice.
export function speak(text: string, lang: Lang): boolean {
  const voice = voiceFor(lang);
  if (!voice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice.lang;
  u.voice = voice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
  return true;
}

export const stopSpeaking = () => typeof speechSynthesis !== "undefined" && speechSynthesis.cancel();
