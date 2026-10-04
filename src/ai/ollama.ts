// The only network call in the app: the local Ollama server (hard rule 2).
import { MODEL_OPTIONS } from "./prompts";

export class OllamaError extends Error {}

// gemma4:e2b ships with a 1 GB image/audio part that Gauri never uses. `npm run model:text` makes a
// text-only copy from the same files (same weights, about 1 GB less memory). If that copy exists it is
// used; if not, the full model is used.
const TEXT_ONLY: Record<string, string> = { "gemma4:e2b": "gemma4-e2b-text" };
const missing = new Set<string>();
export let lastModel = ""; // the model that actually answered the last call

async function post(baseUrl: string, model: string, system: string, user: string, schema: object): Promise<Response> {
  try {
    return await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false, // thinking mode off for speed; gemma4:e2b honours this flag
        format: schema,
        options: MODEL_OPTIONS,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
  } catch {
    throw new OllamaError("unreachable");
  }
}

export async function chat(baseUrl: string, model: string, system: string, user: string, schema: object): Promise<string> {
  const slim = TEXT_ONLY[model];
  let used = slim && !missing.has(slim) ? slim : model;
  let res = await post(baseUrl, used, system, user, schema);
  if (res.status === 404 && used === slim) {
    missing.add(slim); // not created on this machine: use the full model from now on
    used = model;
    res = await post(baseUrl, used, system, user, schema);
  }
  // 404 = model not pulled; anything else (incl. the dev proxy's 5xx) = Ollama not running.
  if (!res.ok) throw new OllamaError(res.status === 404 ? "model_missing" : "unreachable");
  lastModel = used;
  return (await res.json()).message.content;
}
