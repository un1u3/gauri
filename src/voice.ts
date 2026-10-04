// Read-aloud with the browser's built-in speech (offline when the phone has a Nepali voice).
const nepaliVoice = () => (typeof speechSynthesis === "undefined" ? undefined : speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ne")));

export const hasNepaliVoice = () => !!nepaliVoice();

// Returns false (and stays silent) rather than reading Nepali with the wrong voice.
export function speakNepali(text: string): boolean {
  const voice = nepaliVoice();
  if (!voice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ne-NP";
  u.voice = voice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
  return true;
}

export const stopSpeaking = () => typeof speechSynthesis !== "undefined" && speechSynthesis.cancel();
