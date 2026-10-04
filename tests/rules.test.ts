// Static checks for hard rules 1, 2 and 5: nothing in the shipped code talks to the
// outside world, and no code path can send a message on the owner's behalf.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const shipped = [...files("src"), "index.html"].map((p) => ({ p, text: readFileSync(p, "utf8") }));

describe("rule 1+2: offline, local model only", () => {
  it("no external URL in shipped code", () => {
    for (const { p, text } of shipped) {
      const urls = text.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
      const external = urls.filter((u) => !/^http:\/\/localhost:11434/.test(u) && !/^http:\/\/www\.w3\.org\//.test(u));
      expect(external, p).toEqual([]);
    }
  });
  it("the proxy points at local Ollama", () => {
    expect(readFileSync("vite.config.ts", "utf8")).toContain('target: "http://localhost:11434"');
  });
  it("the Devanagari font is bundled, not fetched", () => {
    expect(readFileSync("src/main.ts", "utf8")).toContain("@fontsource/noto-sans-devanagari");
  });
});

describe("rule 5: never act on the owner's behalf", () => {
  it("no sending code exists", () => {
    for (const { p, text } of shipped) {
      expect(text, p).not.toMatch(/sms:|mailto:|wa\.me|whatsapp:\/\/|sendBeacon|navigator\.share|WebSocket|XMLHttpRequest/);
    }
  });
});
