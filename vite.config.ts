import { defineConfig } from "vitest/config";

// Hard rule 2: the only network target is the local Ollama, reached through this proxy (no CORS).
const ollama = { "/ollama": { target: "http://localhost:11434", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/ollama/, ""), timeout: 600000, proxyTimeout: 600000 } };

export default defineConfig({
  server: { host: true, proxy: ollama },
  preview: { host: true, proxy: ollama },
  // Three pages: the app, the simulated guest phone, and both side by side (demo).
  build: { rollupOptions: { input: { main: "index.html", guest: "guest.html", flow: "flow.html" } } },
  test: { include: ["tests/**/*.test.ts", "src/**/*.test.ts"] },
});
