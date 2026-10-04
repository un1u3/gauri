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

# Written after the first two sets had been looked at, to have one set nobody has seen results for.
FINAL = [
    ("en", "T1", "We spent an afternoon in the kitchen learning to make momos with our host. Best memory of Nepal."),
    ("en", "T2", "Seeing where coffee actually comes from, walking between the bushes with the family, was special."),
    ("en", "T3", "One thing: breakfast was not ready until quite late and we had to rush to catch our ride."),
    ("en", "T4", "The directions we were given were confusing and we walked the wrong way for a long time."),
    ("en", "T4", "Maybe put a marker at the junction? We nearly gave up looking for the house."),
    ("en", "-", "Greetings from London! We are back home now."),
    ("en", "-", "My phone battery died on the way so I have no pictures, sadly."),
    ("en", "-", "Is the farm open during Dashain?"),
    ("ko", "T1", "호스트 가족과 같이 저녁을 만들어 본 요리 체험이 가장 기억에 남습니다."),
    ("ko", "T2", "커피나무 사이를 걸으며 농장을 구경한 게 참 좋았어요."),
    ("ko", "T2", "커피 농장 산책 덕분에 커피 한 잔이 어디서 오는지 알게 됐어요."),
    ("ko", "T3", "아침을 너무 늦게 먹게 되어서 일정이 밀렸어요."),
    ("ko", "T4", "가는 길 안내가 없어서 한참 헤맸습니다."),
    ("ko", "-", "덕분에 잘 쉬다 갑니다."),
    ("ko", "-", "돌아오는 길에 비가 많이 왔어요."),
    ("ko", "-", "다음에는 부모님을 모시고 가고 싶어요."),
    ("hi", "T1", "आंटी के साथ मोमो बनाना सीखा, कुकिंग क्लास में बहुत मज़ा आया।"),
    ("hi", "T1", "रसोई में साथ बैठकर खाना बनाना सीखना हमारे बच्चों को बहुत पसंद आया।"),
    ("hi", "T2", "कॉफ़ी के बाग़ में सुबह की सैर बहुत सुकून देने वाली थी।"),
    ("hi", "T3", "सुबह का खाना बहुत देर से तैयार हुआ, हमारी बस छूटते-छूटते बची।"),
    ("hi", "T4", "घर ढूँढने में बहुत परेशानी हुई, रास्ते में कहीं कोई निशान नहीं था।"),
    ("hi", "-", "हम सकुशल लखनऊ पहुँच गए।"),
    ("hi", "-", "आपके गाँव की हवा बहुत साफ़ है।"),
    ("hi", "-", "अगली बार कब आ सकते हैं?"),
    ("zh", "T1", "和女主人一起下厨学做菜,是我们最开心的时光。"),
    ("zh", "T2", "跟着主人逛咖啡园,第一次看到咖啡树,很有意思。"),
    ("zh", "T3", "早餐准备得太慢了,我们差点赶不上车。"),
    ("zh", "T3", "希望早饭能早一点,我们七点就要出发。"),
    ("zh", "T5", "如果有无线网络就更好了。"),
    ("zh", "-", "我们已经到博卡拉了,一切顺利。"),
    ("zh", "-", "路上风景很美。"),
    ("zh", "-", "请代我向您的家人问好。"),
    ("ne", "T1", "दिदीले भान्सामा बसाएर सेल रोटी पकाउन सिकाउनुभयो, खुब रमाइलो भयो।"),
    ("ne", "T1", "खाना पकाउन सिक्ने कार्यक्रम हाम्रो परिवारलाई सबैभन्दा मन पर्‍यो।"),
    ("ne", "T2", "कफीको बोटबिरुवा हेर्दै बारीमा डुल्दा आनन्द आयो।"),
    ("ne", "T3", "बिहानको खाना तयार हुन निकै ढिलो भयो, हामी हतारमा हिँड्नुपर्‍यो।"),
    ("ne", "T4", "घर खोज्दा खोज्दा हैरान भइयो, बाटो देखाउने केही थिएन।"),
    ("ne", "-", "हामी सकुशल घर आइपुग्यौं, धन्यवाद।"),
    ("ne", "-", "यसपालि चिसो अलि बढी रहेछ।"),
    ("ne", "-", "दसैंमा फेरि भेटौंला।"),
]
# The sample shown in the app ("Load sample messages") and used for demo mode. Still invented by the
# team — no real guest wrote these and no review text was copied — but modelled on what public
# write-ups and studies of Nepali village homestays say guests praise and complain about
# (README, "Data"). Nine languages; some messages hold praise and a wish together, like real reviews.
SAMPLE_THEMES = {
    "R1": ("loved", "Treated like family / warm hospitality"),
    "R2": ("loved", "Home-cooked food from the farm"),
    "R3": ("loved", "Coffee farm walk, roasting and tasting"),
    "R4": ("wished", "No hot water for washing"),
    "R5": ("wished", "Room cold at night"),
    "R6": ("wished", "Could not talk with the hosts without the guide"),
    "R7": ("wished", "Rough road / house hard to find"),
    "S1": ("single", "Wants Wi-Fi (one guest only)"),
    "S2": ("single", "Could not pay by card (one guest only)"),
    "S3": ("single", "Squat toilet outside the house (one guest only)"),
}
SAMPLE = [
    ("en", "R1", "We were treated like family from the first cup of tea. Aama even walked us to the bus on our last morning."),
    ("en", "R2+R4", "The dal bhat with greens from the garden was the best food of our whole trip. Only wish: the shower was cold, a bucket of warm water would have been perfect."),
    ("en", "R3", "Picking coffee cherries and then roasting them over the fire with the family was unforgettable."),
    ("en", "R4", "Beautiful place, but there was no hot water at all and it was hard to wash after a long hike."),
    ("en", "R6", "Once our guide left we could not really talk to our hosts. We had so many questions about the farm."),
    ("en", "R7", "The last hour of road was very rough and our driver had trouble finding the house."),
    ("en", "S1", "It would help to have Wi-Fi, I needed to send one work email."),
    ("en", "R5", "Nights were colder than we expected and the blanket was thin."),
    ("en", "-", "Back in Kathmandu now. Thank you again!"),
    ("ne", "R1", "आफ्नै घर जस्तो माया पाइयो। आमाले छोराछोरीलाई जस्तै ख्याल गर्नुभयो।"),
    ("ne", "R2", "करेसाबारीको सागसब्जी र घरको घिउ हालेको दालभात असाध्यै मीठो थियो।"),
    ("ne", "R3", "कफी बारी घुमाएर आफ्नै हातले भुटेको कफी खुवाउनुभयो, नयाँ अनुभव भयो।"),
    ("ne", "R5", "राति निकै जाडो भयो, ओढ्ने अलि पातलो थियो।"),
    ("ne", "R4", "नुहाउन तातो पानी भए अझ राम्रो हुन्थ्यो।"),
    ("ne", "-", "फेरि आउने मन छ, छिट्टै भेटौंला।"),
    ("hi", "R1", "परिवार ने हमें मेहमान नहीं, अपने घर के लोगों की तरह रखा। बहुत अपनापन मिला।"),
    ("hi", "R2", "घर का बना खाना, खासकर दाल-भात और अचार, लाजवाब था।"),
    ("hi", "R4", "नहाने के लिए गरम पानी नहीं था, ठंड में मुश्किल हुई।"),
    ("hi", "R7", "रास्ता बहुत खराब था और घर ढूँढने में काफ़ी समय लगा।"),
    ("hi", "R3", "कॉफ़ी के बाग़ में घूमना और वहीं की ताज़ी कॉफ़ी पीना बहुत अच्छा लगा।"),
    ("zh", "R1", "主人一家把我们当成家人,非常热情。"),
    ("zh", "R2", "用自家菜园的菜做的饭特别好吃,每顿都吃得很饱。"),
    ("zh", "R4", "没有热水洗澡,晚上洗冷水很冷。"),
    ("zh", "R6", "向导走了以后,我们和主人没法交流,只能靠手势。"),
    ("zh", "S2", "只能付现金,不能刷卡,有点不方便。"),
    ("ko", "R3", "커피 농장을 돌아보고 직접 볶은 커피를 마신 것이 가장 좋았습니다."),
    ("ko", "R1", "가족처럼 대해 주셔서 떠날 때 눈물이 났어요."),
    ("ko", "R5", "밤에 방이 많이 추웠어요. 이불이 더 있었으면 좋겠어요."),
    ("ko", "R6", "말이 통하지 않아서 궁금한 것을 물어볼 수 없었던 점이 아쉬웠어요."),
    ("ja", "R2", "畑でとれた野菜を使った家庭料理がとてもおいしかったです。"),
    ("ja", "R3", "コーヒー畑を歩いて、自分で豆を焙煎する体験が楽しかったです。"),
    ("ja", "R4", "お湯が出なかったので、シャワーが冷たくて大変でした。"),
    ("ja", "R1", "家族の一員のように迎えてくれて、本当に温かいおもてなしでした。"),
    ("fr", "R1+R6", "Un accueil très chaleureux, on se sentait comme en famille. Dommage que nous n'ayons pas pu parler avec nos hôtes sans le guide."),
    ("fr", "R2", "Les repas faits maison avec les légumes du jardin étaient délicieux."),
    ("fr", "R7", "La route pour arriver est longue et très cahoteuse, et la maison est difficile à trouver."),
    ("de", "R3", "Die Führung durch die Kaffeefarm und das gemeinsame Rösten am Feuer waren das Highlight."),
    ("de", "R5", "Nachts war es im Zimmer sehr kalt, eine zweite Decke wäre gut gewesen."),
    ("es", "R1", "La familia nos trató como a sus propios hijos. ¡Volveremos!"),
    ("es", "S3", "El baño es de tipo turco y está fuera de la casa; nos costó acostumbrarnos."),
]


def build(rows, prefix, seed, month, themes=THEMES):
    rows = rows[:]
    random.Random(seed).shuffle(rows)
    messages, truth = [], {t: [] for t in themes}
    for i, (lang, theme, text) in enumerate(rows, 1):
        mid = f"{prefix}{i:02d}"
        messages.append({
            "id": mid, "text": text, "lang": lang,
            "received_at": f"2026-{month:02d}-{1 + (i * 28) // (len(rows) + 1):02d}",
            # Made-up contacts for about half the guests; not real phone numbers.
            "contact": f"guest-{mid}@example.invalid" if i % 2 else None,
            "synthetic": True,
        })
        for t in theme.split("+"):  # a message may express two themes
            if t in truth:
                truth[t].append(mid)
    return messages, {"themes": [{"id": t, "type": themes[t][0], "name": themes[t][1], "message_ids": ids} for t, ids in truth.items()]}


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write("\n")


for rows, prefix, seed, month, name in [(DEV, "m", 1, 8, "synthetic"), (TEST, "t", 2, 9, "synthetic_test"), (FINAL, "f", 3, 10, "synthetic_final")]:
    messages, truth = build(rows, prefix, seed, month)
    dump(f"data/{'synthetic_messages' if name == 'synthetic' else name}.json", messages)
    dump(f"data/{name}_truth.json", truth)
    print(name, len(messages), {t["id"]: len(t["message_ids"]) for t in truth["themes"]})

messages, truth = build(SAMPLE, "r", 4, 9, SAMPLE_THEMES)
dump("data/sample_reviews.json", messages)
dump("data/sample_reviews_truth.json", truth)
print("sample_reviews", len(messages), {t["id"]: len(t["message_ids"]) for t in truth["themes"]})
