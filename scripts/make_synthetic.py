#!/usr/bin/env python3
"""Writes the synthetic guest messages and their ground truth.

All messages are invented by the team (no real guests). Each row is
(language, theme, text); theme "-" is neutral / off-topic. Message order is
shuffled with a fixed seed so languages and themes arrive mixed, as they would
on a phone. Run: python3 scripts/make_synthetic.py
"""
import json, random

THEMES = {
    "T1": ("loved", "Loved the cooking class"),
    "T2": ("loved", "Loved the coffee farm walk"),
    "T3": ("wished", "Breakfast was too late"),
    "T4": ("wished", "Farm hard to find / directions"),
    "T5": ("single", "Wants Wi-Fi (one guest only, must end up uncertain)"),
}

DEV = [
    ("en", "T1", "The cooking class was the best part of our stay. We made dal bhat and momos together!"),
    ("en", "T1", "Loved learning to cook with Noor in her kitchen. I will try the recipes at home."),
    ("en", "T2", "The walk through the coffee farm was wonderful. I had never seen coffee cherries before."),
    ("en", "T3", "Lovely place, but breakfast was served too late. We wanted to start hiking by 7."),
    ("en", "T4", "It was really hard to find the farm. There is no sign on the road and the map pin was wrong."),
    ("en", "-", "Thank you for everything. We reached Pokhara safely."),
    ("en", "-", "The weather was cloudy so we could not see the mountains. Maybe next time."),
    ("en", "-", "My daughter still talks about your goat."),
    ("ko", "T1", "요리 수업이 정말 즐거웠어요. 직접 만든 달밧이 최고였습니다."),
    ("ko", "T2", "커피 농장을 걸으며 설명을 들은 시간이 가장 좋았어요."),
    ("ko", "T2", "커피 나무 사이를 산책하고 직접 열매를 따 본 것이 인상 깊었습니다."),
    ("ko", "T3", "아침 식사가 너무 늦게 나왔어요. 일찍 출발해야 해서 아쉬웠습니다."),
    ("ko", "T4", "농장을 찾기가 어려웠어요. 길 안내 표지판이 있으면 좋겠습니다."),
    ("ko", "T5", "와이파이가 있으면 좋겠어요."),
    ("ko", "-", "감사합니다. 사진을 많이 찍었어요."),
    ("ko", "-", "버스가 많이 흔들렸지만 잘 도착했습니다."),
    ("hi", "T1", "खाना बनाने की क्लास बहुत मज़ेदार थी। हमने खुद दाल-भात बनाना सीखा।"),
    ("hi", "T2", "कॉफ़ी के खेत में घूमना बहुत अच्छा लगा। कॉफ़ी कैसे उगती है, यह पहली बार देखा।"),
    ("hi", "T2", "कॉफ़ी बागान की सैर सबसे यादगार रही।"),
    ("hi", "T3", "नाश्ता बहुत देर से मिला। हमें सुबह जल्दी निकलना था।"),
    ("hi", "T4", "फ़ार्म ढूँढना मुश्किल था। रास्ते में कोई बोर्ड नहीं था, हम दो बार भटक गए।"),
    ("hi", "-", "आपका बहुत धन्यवाद। हम दिल्ली पहुँच गए हैं।"),
    ("hi", "-", "बारिश की वजह से हम ज़्यादा बाहर नहीं जा सके।"),
    ("hi", "-", "क्या आप दिसंबर में खुले रहते हैं?"),
    ("zh", "T1", "烹饪课太有意思了,我们亲手做了尼泊尔扁豆饭。"),
    ("zh", "T1", "最喜欢和主人一起做饭的课程,学会了做馍馍。"),
    ("zh", "T2", "在咖啡园里散步很棒,主人讲解了咖啡是怎么种的。"),
    ("zh", "T3", "早餐上得太晚了,我们本来想早点出发去徒步。"),
    ("zh", "T4", "农场很难找,路上没有指示牌,我们迷路了半个小时。"),
    ("zh", "-", "谢谢您的招待,我们已经平安回到加德满都。"),
    ("zh", "-", "山里的晚上比想象的冷。"),
    ("zh", "-", "我拍了很多照片,回去给朋友看。"),
    ("ne", "T1", "खाना पकाउने कक्षा एकदमै रमाइलो भयो। आफैंले दालभात पकाउन सिकियो।"),
    ("ne", "T1", "दिदीसँग भान्सामा बसेर खाना बनाउन सिक्दा धेरै मज्जा आयो।"),
    ("ne", "T2", "कफी बारीमा घुम्न पाउँदा खुसी लाग्यो। कफी कसरी फल्छ भनेर पहिलो पटक देखें।"),
    ("ne", "T3", "बिहानको खाजा धेरै ढिलो आयो। हामीलाई बिहानै हिँड्नु थियो।"),
    ("ne", "T4", "फार्म भेट्टाउन गाह्रो भयो। बाटोमा कुनै बोर्ड थिएन।"),
    ("ne", "-", "धन्यवाद दिदी। हामी राम्रोसँग घर पुग्यौं।"),
    ("ne", "-", "यसपालि पानी धेरै पर्‍यो।"),
    ("ne", "-", "अर्को महिना साथीहरू पनि आउन सक्छन् कि भनेर सोध्दै छु।"),
]

TEST = [
    ("en", "T1", "Cooking dinner together with the host was so much fun. The cooking lesson alone was worth the trip."),
    ("en", "T2", "Our favourite part was the tour of the coffee plants. We even picked some beans."),
    ("en", "T2", "Walking around the coffee farm at sunrise was magical."),
    ("en", "T3", "We waited a long time for breakfast. It only came after nine and we missed our jeep."),
    ("en", "T4", "Took us over an hour to locate the place. Please put up a signboard at the turn-off."),
    ("en", "-", "Safe travels to us! Thanks again."),
    ("en", "-", "The bus from Kathmandu was very crowded."),
    ("en", "-", "Do you have space for four people in March?"),
    ("ko", "T1", "주인분과 함께 음식을 만드는 수업이 제일 좋았습니다."),
    ("ko", "T1", "모모 만드는 법을 배운 요리 교실, 정말 재미있었어요!"),
    ("ko", "T2", "커피 밭 투어가 기억에 남아요. 커피가 어떻게 자라는지 처음 알았어요."),
    ("ko", "T3", "아침밥이 늦어서 트레킹 출발이 늦어졌어요."),
    ("ko", "T4", "오는 길을 찾기 힘들었습니다. 지도에 위치가 정확하지 않았어요."),
    ("ko", "-", "잘 지내다 갑니다. 건강하세요."),
    ("ko", "-", "밤에 별이 정말 많았어요."),
    ("ko", "-", "한국에 돌아왔습니다."),
    ("hi", "T1", "मालकिन के साथ रसोई में खाना पकाना सीखना सबसे अच्छा अनुभव था।"),
    ("hi", "T2", "कॉफ़ी के पौधों के बीच टहलना और फल तोड़ना बहुत पसंद आया।"),
    ("hi", "T3", "सुबह का नाश्ता नौ बजे के बाद आया, यह हमारे लिए बहुत देर थी।"),
    ("hi", "T3", "नाश्ता थोड़ा जल्दी मिल जाता तो अच्छा होता, हम ट्रेक के लिए लेट हो गए।"),
    ("hi", "T4", "जगह तक पहुँचने का रास्ता समझ नहीं आया। कोई साइनबोर्ड लगा दीजिए।"),
    ("hi", "T5", "अगर वाई-फ़ाई होता तो अच्छा रहता।"),
    ("hi", "-", "नमस्ते, हम घर पहुँच गए। धन्यवाद।"),
    ("hi", "-", "पहाड़ों में ठंड काफ़ी थी।"),
    ("zh", "T1", "跟着主人学做尼泊尔菜的课程非常有趣。"),
    ("zh", "T2", "参观咖啡种植园是这次旅行的亮点,还亲手摘了咖啡果。"),
    ("zh", "T3", "早饭九点多才有,对我们来说太迟了。"),
    ("zh", "T4", "地方不好找,没有路牌,司机也问了好几次路。"),
    ("zh", "T4", "找农场花了很长时间,希望路口能有个指示牌。"),
    ("zh", "-", "谢谢,我们已经到家了。"),
    ("zh", "-", "下雨了,所以没看到日出。"),
    ("zh", "-", "请问十二月还营业吗?"),
    ("ne", "T1", "आफ्नै हातले मःमः बनाउन सिकाउनुभयो, त्यो पकाउने कक्षा निकै रमाइलो लाग्यो।"),
    ("ne", "T1", "भान्सामा सँगै खाना पकाएको क्षण सबैभन्दा राम्रो थियो।"),
    ("ne", "T2", "कफी बगानको भ्रमण धेरै मन पर्‍यो। कफीको दाना टिप्न पनि पाइयो।"),
    ("ne", "T3", "बिहानको खाना अलि चाँडो भए हुन्थ्यो, नौ बजेपछि मात्र आयो।"),
    ("ne", "T4", "ठाउँ पत्ता लगाउन निकै गाह्रो भयो। मोडमा एउटा बोर्ड राखिदिनुस्।"),
    ("ne", "-", "नमस्ते दिदी, हामी काठमाडौं आइपुग्यौं।"),
    ("ne", "-", "बाटोमा बस बिग्रियो तर पुगियो।"),
    ("ne", "-", "फोटोहरू पठाउँदै छु।"),
]


def build(rows, prefix, seed, month):
    rows = rows[:]
    random.Random(seed).shuffle(rows)
    messages, truth = [], {t: [] for t in THEMES}
    for i, (lang, theme, text) in enumerate(rows, 1):
        mid = f"{prefix}{i:02d}"
        messages.append({
            "id": mid, "text": text, "lang": lang,
            "received_at": f"2026-{month:02d}-{1 + (i * 28) // (len(rows) + 1):02d}",
            # Made-up contacts for about half the guests; not real phone numbers.
            "contact": f"guest-{mid}@example.invalid" if i % 2 else None,
            "synthetic": True,
        })
        if theme in truth:
            truth[theme].append(mid)
    themes = [{"id": t, "type": THEMES[t][0], "name": THEMES[t][1], "message_ids": ids} for t, ids in truth.items()]
    return messages, {"themes": themes}


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write("\n")


for rows, prefix, seed, month, name in [(DEV, "m", 1, 8, "synthetic"), (TEST, "t", 2, 9, "synthetic_test")]:
    messages, truth = build(rows, prefix, seed, month)
    dump(f"data/{name if name == 'synthetic_test' else 'synthetic_messages'}.json", messages)
    dump(f"data/{name}_truth.json", truth)
    print(name, len(messages), {t["id"]: len(t["message_ids"]) for t in truth["themes"]})
