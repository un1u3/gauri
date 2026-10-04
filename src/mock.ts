// Demo mode only (backup video when the model cannot run). This is a saved, unedited output of
// gemma4:e2b on data/sample_reviews.json; it still goes through the guardrails, so it only shows
// points whose cited messages are actually on the device.
import type { RawAnalysis, RawDraft } from "./types";

export const MOCK_ANALYSIS: RawAnalysis = {
  "loved": [
    {
      "point_en": "Picking coffee cherries and roasting them over the fire with the family was unforgettable.",
      "point_own": "परिवारसँग मिलेर कफी चेरी टिप्नु र आगोमा भुट्नु अविस्मरणीय थियो।",
      "message_ids": [
        "r09",
        "r37",
        "r22",
        "r36",
        "r28"
      ]
    },
    {
      "point_en": "The food made with garden vegetables was delicious and filling.",
      "point_own": "बाटोमा पाएको तरकारीले बनाएको खाना मिठो र पेट भरिदिने थियो।",
      "message_ids": [
        "r11",
        "r23",
        "r24",
        "r29",
        "r32"
      ]
    },
    {
      "point_en": "The hosts treated guests like family and provided a very warm welcome.",
      "point_own": "मेजबानहरूले अतिथिहरूलाई परिवार जस्तै व्यवहार गरे र धेरै न्यानो स्वागत गरे।",
      "message_ids": [
        "r03",
        "r12",
        "r18",
        "r20",
        "r35",
        "r40",
        "r06"
      ]
    }
  ],
  "wished": [
    {
      "point_en": "Guests wished for hot water for showering.",
      "point_own": "अतिथिहरूले नुहाउनका लागि तातो पानी चाहन्थे।",
      "message_ids": [
        "r15",
        "r19",
        "r26",
        "r30",
        "r32"
      ]
    },
    {
      "point_en": "Guests wished for more blankets/extra bedding because the nights were cold.",
      "point_own": "अतिथिहरूले धेरै चिसो भएकाले थप कम्बल चाहन्थे।",
      "message_ids": [
        "r02",
        "r17",
        "r25",
        "r31"
      ]
    }
  ],
  "upgrade": [
    {
      "point_en": "Upgrade: Provide hot water for showers.",
      "point_own": "अपग्रेड: नुहाउनका लागि तातो पानी उपलब्ध गराउनुहोस्।",
      "message_ids": [
        "r15",
        "r19",
        "r26",
        "r30",
        "r32"
      ]
    }
  ],
  "uncertain": [
    {
      "note_en": "The method of communication with the host after the guide left was difficult (could only use gestures).",
      "note_own": "गाइड गएपछि मेजबानसँग कुराकानी गर्न गाह्रो थियो (केवल इशारा प्रयोग गर्न सकिन्थ्यो)।\nmessage_ids\": [\"r01\", \"r05\", \"r33\"]"
    },
    {
      "note_en": "The difficulty in finding the house/road conditions were mentioned.",
      "note_own": "घर फेला पार्नको कठिनाई/सडकको अवस्था उल्लेख गरिएको छ।\nmessage_ids\": [\"r10\", \"r13\", \"r34\"]"
    },
    {
      "note_en": "Payment method was cash only, which was inconvenient for some.",
      "note_own": "भुक्तानी विधि नगद मात्र थियो, जुन केहीका लागि असुविधाजनक थियो।\nmessage_ids\": [\"r27\"]"
    }
  ]
};

const NE = "तपाईं आउनुभएकोमा धेरै धन्यवाद। फेरि आउनुहोला, साथीहरूलाई पनि भन्नुहोला।";
// Saved in Nepali, for the sample languages; other guest languages get the English one.
export const MOCK_DRAFTS: Record<string, RawDraft> = {
  en: { text: "Thank you so much for visiting us. Please come again, and tell your friends about us.", text_own: NE },
  ko: { text: "방문해 주셔서 정말 감사합니다. 또 오세요, 친구분들께도 알려 주세요.", text_own: NE },
  hi: { text: "हमारे यहाँ आने के लिए बहुत धन्यवाद। फिर आइएगा, और अपने दोस्तों को भी बताइएगा।", text_own: NE },
  zh: { text: "非常感谢您的到来。欢迎再来,也请告诉您的朋友。", text_own: NE },
  ja: { text: "お越しいただき、本当にありがとうございました。またぜひいらしてください。お友達にもお伝えください。", text_own: NE },
  fr: { text: "Merci beaucoup pour votre visite. Revenez nous voir, et parlez de nous à vos amis.", text_own: NE },
  de: { text: "Vielen Dank für Ihren Besuch. Kommen Sie gern wieder und erzählen Sie Ihren Freunden von uns.", text_own: NE },
  es: { text: "Muchas gracias por su visita. Vuelvan pronto y cuéntenles a sus amigos sobre nosotros.", text_own: NE },
  ne: { text: NE, text_own: NE },
};
