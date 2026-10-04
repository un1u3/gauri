// Demo only: a simulated guest's phone. What the guest "sends" here is written straight into Gauri's
// on-device store, so the flow guest → owner can be shown on one screen. No SMS is sent or received:
// in real use the guest's message is shared or pasted into Gauri. Messages made here are marked synthetic.
import "@fontsource/noto-sans-devanagari/400.css";
import "./guest.css";
import { detectLang, langName, writtenIn } from "./lang";
import { fromPaste } from "./messages";
import { load, save, STORE_KEY } from "./store";
import type { Lang } from "./types";

// Invented guests. `card` is the note printed on the farm card each guest is given, in their language.
type Guest = { name: string; from: string; number: string; lang: Lang; card: string; ideas: string[] };
const GUESTS: Guest[] = [
  { name: "Emma", from: "United Kingdom", number: "+44 7700 900123", lang: "en",
    card: "Namaste! Thank you for staying at our farm. Tell us what you liked and what we could do better. Your message may be read by the owner to improve her tours. It stays on her phone.",
    ideas: ["We felt like part of the family, thank you!", "The shower was cold. A bucket of warm water would help a lot.", "Roasting our own coffee by the fire was the best part."] },
  { name: "Min-jun", from: "South Korea", number: "+82 10-5550-0142", lang: "ko",
    card: "나마스테! 저희 농장에 머물러 주셔서 감사합니다. 좋았던 점과 아쉬웠던 점을 알려 주세요. 보내신 메시지는 주인이 서비스를 개선하기 위해 읽을 수 있으며, 주인의 휴대폰에만 보관됩니다.",
    ideas: ["가족처럼 따뜻하게 대해 주셔서 감사합니다.", "밤에 방이 너무 추웠어요. 담요가 하나 더 있으면 좋겠어요.", "가이드가 떠난 뒤에는 말이 통하지 않아 아쉬웠어요."] },
  { name: "Yuki", from: "Japan", number: "+81 90-5550-0177", lang: "ja",
    card: "ナマステ!私たちの農場にお泊まりいただきありがとうございました。良かった点、改善してほしい点を教えてください。メッセージはオーナーがサービス向上のために読むことがあり、オーナーの携帯電話の中だけに保存されます。",
    ideas: ["畑の野菜を使ったごはんが本当においしかったです。", "お湯が出なくて、シャワーが冷たかったです。", "コーヒー畑の散歩がとても楽しかったです。"] },
  { name: "Camille", from: "France", number: "+33 6 55 50 01 21", lang: "fr",
    card: "Namasté ! Merci d'avoir séjourné dans notre ferme. Dites-nous ce que vous avez aimé et ce que nous pourrions améliorer. Votre message peut être lu par la propriétaire pour améliorer son accueil. Il reste sur son téléphone.",
    ideas: ["Un accueil très chaleureux, comme en famille.", "La route est très difficile et la maison est dure à trouver.", "Le petit-déjeuner est arrivé trop tard pour notre départ."] },
  { name: "Rahul", from: "India", number: "+91 98555 01234", lang: "hi",
    card: "नमस्ते! हमारे फ़ार्म पर ठहरने के लिए धन्यवाद। बताइए आपको क्या अच्छा लगा और हम क्या बेहतर कर सकते हैं। आपका संदेश मालकिन अपनी सेवा सुधारने के लिए पढ़ सकती हैं। यह उनके फ़ोन में ही रहता है।",
    ideas: ["घर का बना खाना बहुत स्वादिष्ट था।", "नहाने के लिए गरम पानी नहीं था।", "रास्ता बहुत खराब था, घर ढूँढना मुश्किल था।"] },
  { name: "Li Wei", from: "China", number: "+86 138 5550 0199", lang: "zh",
    card: "Namaste!感谢您入住我们的农场。请告诉我们您喜欢什么,以及我们哪里可以做得更好。您的留言可能会被主人阅读,用于改进服务,并只保存在她的手机上。",
    ideas: ["主人一家非常热情,像家人一样。", "晚上房间很冷,希望多一条被子。", "没有热水洗澡。"] },
];

const ICON = {
  back: '<path d="m15 5-7 7 7 7"/>', call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  more: '<path d="M12 5v.01M12 12v.01M12 19v.01"/>', plus: '<path d="M12 5v14M5 12h14"/>', send: '<path d="M4 12 20 4l-5 16-3-7z"/>',
};
const icon = (name: keyof typeof ICON) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.textContent = text;
  return e;
};

let guest = GUESTS[Number(sessionStorage.getItem("gauri.guest") ?? 0)] ?? GUESTS[0];
const sentAt = new Map<string, string>(); // message id → time shown next to the bubble (this session only)
const root = document.querySelector("#guest")!;

// The guest presses Send: the message goes into Gauri's store on this device. Nothing leaves the device.
function send(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  const state = load();
  const [message] = fromPaste(clean, state.messages);
  message.contact = guest.number;
  // Worked out from the text itself. Only when the words do not decide it (a very short message) is the
  // selected guest's language used, and only if the script fits.
  const guess = detectLang(clean);
  message.lang = !guess.sure && writtenIn(clean, guest.lang) ? guest.lang : guess.lang;
  message.synthetic = true; // typed in a demo, not a real guest's message
  state.messages.push(message);
  save(state); // Gauri, open in another window or frame, hears this through the browser's storage event
  sentAt.set(message.id, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  render(true);
}

function render(justSent = false) {
  const mine = load().messages.filter((m) => m.contact === guest.number);
  root.replaceChildren();

  const bar = el("div", { class: "demo-bar" });
  bar.append(el("label", { for: "who" }, "Demo guest:"));
  const pick = el("select", { id: "who" });
  GUESTS.forEach((g, i) => pick.append(Object.assign(el("option", { value: String(i) }, `${g.name} · ${g.from} · ${langName(g.lang)}`), { selected: g === guest })));
  pick.onchange = () => { guest = GUESTS[Number(pick.value)]; sessionStorage.setItem("gauri.guest", pick.value); render(); };
  bar.append(pick, el("span", {}, "Simulated phone for the demo. No real SMS is sent; the message goes to Gauri on this device."));

  const head = el("header", { class: "head" });
  head.innerHTML = `<span class="ic">${icon("back")}</span><span class="avatar" aria-hidden="true">N</span><div class="who"><strong>Noor's Farm-stay</strong><small>+977 98-5550-0100</small></div><span class="ic">${icon("call")}</span><span class="ic">${icon("more")}</span>`;

  const thread = el("main", { class: "thread", "aria-live": "polite" });
  thread.append(el("div", { class: "day" }, new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })));
  const card = el("div", { class: "card-note", lang: guest.lang, dir: "auto" });
  card.append(el("b", { lang: "en" }, "From the card you were given at the farm"), guest.card);
  thread.append(card);
  if (!mine.length) thread.append(el("p", { class: "empty" }, "Write to the farm in your own language."));
  for (const m of mine) {
    const row = el("div", { class: "row" });
    row.append(el("span", { class: "time" }, sentAt.get(m.id) ?? m.received_at), el("div", { class: "bubble", lang: m.lang, dir: "auto" }, m.text));
    thread.append(row);
  }
  if (mine.length) thread.append(el("div", { class: "status" }, "✓ Delivered to Gauri on the owner's phone"));

  const chips = el("div", { class: "chips", role: "group", "aria-label": "Suggested messages" });
  const box = el("textarea", { id: "msg", rows: "1", placeholder: "Text message", lang: guest.lang, dir: "auto", "aria-label": "Message to the farm" });
  const go = el("button", { class: "send", type: "submit", "aria-label": "Send" });
  go.innerHTML = icon("send");
  go.disabled = true;
  box.oninput = () => (go.disabled = !box.value.trim());
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(box.value); } };
  for (const idea of guest.ideas.filter((t) => !mine.some((m) => m.text === t))) {
    const chip = el("button", { type: "button", lang: guest.lang, dir: "auto" }, idea);
    chip.onclick = () => { box.value = idea; go.disabled = false; box.focus(); };
    chips.append(chip);
  }
  const form = el("form", { class: "composer" });
  const plus = el("span", { class: "ic" });
  plus.innerHTML = icon("plus");
  form.append(plus, box, go);
  form.onsubmit = (e) => { e.preventDefault(); send(box.value); };

  root.append(bar, head, thread, chips, form);
  thread.scrollTop = thread.scrollHeight;
  if (justSent) document.querySelector<HTMLTextAreaElement>("#msg")!.focus();
}

// If the owner deletes a message in Gauri, it disappears here too.
window.addEventListener("storage", (e) => { if (e.key === STORE_KEY) render(); });
render();
