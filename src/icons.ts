// Line icons drawn inline (no icon font, no network). Keyed by the emoji used in the code,
// so call sites stay readable: icon("🔍").
const P: Record<string, string> = {
  "🔍": '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  "⏳": '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  "⚠️": '<path d="M12 4 2.5 20h19L12 4zM12 10v5M12 17.5v.5"/>',
  "✋": '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
  "🎬": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  "🔊": '<path d="M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  "⏹": '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  "🔇": '<path d="M4 9v6h4l5 4V5L8 9H4zM16 9l5 6M21 9l-5 6"/>',
  "❤️": '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  "💭": '<path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
  "💡": '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  "❓": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.7M12 17v.5"/>',
  "🤝": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  "➕": '<path d="M12 5v14M5 12h14"/>',
  "📂": '<path d="M3 6h6l2 2h10v11H3z"/>',
  "🧪": '<path d="M9 3h6M10 3v6l-5 10a1.5 1.5 0 0 0 1.4 2h11.2A1.5 1.5 0 0 0 19 19l-5-10V3M7.5 15h9"/>',
  "🗑": '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  "✏️": '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/>',
  "💾": '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  "✅": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  "❌": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  "📋": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  "🙏": '<path d="M4 5h16v11H9l-5 4z"/><path d="M12 13s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z"/>',
  "📝": '<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3"/>',
  "📱": '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  "🛡": '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3z"/><path d="m9 12 2 2 4-4"/>',
  "⬅": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  "▶": '<path d="m9 6 6 6-6 6"/>',
  "▼": '<path d="m6 9 6 6 6-6"/>',
  "🌱": '<path d="M12 21v-8M12 13c0-4-3-6-7-6 0 4 3 6 7 6zM12 15c0-3 2.5-5 7-5 0 3.5-2.5 5-7 5z"/>',
  "📊": '<path d="M5 20v-8M12 20V4M19 20v-5"/>',
  "💬": '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  "📅": '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  "🌐": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  "✨": '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  "🔤": '<path d="M3 18 8 6l5 12M5 14h6M16 18v-5a2.5 2.5 0 0 1 5 0v5M21 15.5h-3a1.5 1.5 0 0 0 0 3h3"/>',
  "🤖": '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 10h4v4h-4zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  "🔢": '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  "ℹ️": '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  "👤": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  "🔒": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  "📘": '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>',
  "⚙️": '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};

// Icons are decoration next to a text label, so screen readers skip them.
export function icon(name: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>`;
  return span;
}
