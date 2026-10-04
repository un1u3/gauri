// Demo mode only (backup video when the model cannot run). This is a saved output of
// gemma4:e2b on data/synthetic_messages.json; it still goes through the guardrails,
// so it only shows points whose cited messages are actually on the device.
import type { RawAnalysis, RawDraft } from "./types";

export const MOCK_ANALYSIS: RawAnalysis = {
  loved: [
    { point_en: "Walk through the coffee farm was wonderful.", point_own: "कफी खेतमा घुम्नु धेरै राम्रो थियो।", message_ids: ["m02", "m08", "m09", "m11", "m19", "m23"] },
    { point_en: "Learning to cook with Noor was loved.", point_own: "नूरसँग खाना पकाउन सिक्नु मन पर्‍यो।", message_ids: ["m04", "m18", "m31", "m37", "m40"] },
  ],
  wished: [
    { point_en: "Breakfast was served too late.", point_own: "बिहानको खाना धेरै ढिलो आयो।", message_ids: ["m03", "m20", "m24", "m29"] },
    { point_en: "There should be signage on the road to find the farm.", point_own: "फार्म भेट्न बाटोमा संकेत (बोर्ड) हुनुपर्छ।", message_ids: ["m12", "m26", "m34", "m38", "m39"] },
  ],
  upgrade: [{ point_en: "Install road signage to help guests find the farm.", point_own: "पाहुनालाई फार्म भेट्न सजिलो होस् भनेर बाटोमा बोर्ड राख्नुहोस्।", message_ids: ["m12", "m26", "m34", "m38", "m39"] }],
  uncertain: [{ note_en: "Wi-Fi would be nice.", note_own: "वाई-फाई भए राम्रो हुनेछ।", reason: "single_guest" }],
};

const NE = "तपाईं आउनुभएकोमा धेरै धन्यवाद। फेरि आउनुहोला, साथीहरूलाई पनि भन्नुहोला।";
// Saved in Nepali, for the five sample languages; other guest languages get the English one.
export const MOCK_DRAFTS: Record<string, RawDraft> = {
  en: { text: "Thank you so much for visiting us. Please come again, and tell your friends about us.", text_own: NE },
  ko: { text: "방문해 주셔서 정말 감사합니다. 또 오세요, 친구분들께도 알려 주세요.", text_own: NE },
  hi: { text: "हमारे यहाँ आने के लिए बहुत धन्यवाद। फिर आइएगा, और अपने दोस्तों को भी बताइएगा।", text_own: NE },
  zh: { text: "非常感谢您的到来。欢迎再来,也请告诉您的朋友。", text_own: NE },
  ne: { text: NE, text_own: NE },
};
