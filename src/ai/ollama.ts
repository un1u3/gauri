// The only network call in the app: the local Ollama server (hard rule 2).
import { MODEL_OPTIONS } from "./prompts";

export class OllamaError extends Error {}

export async function chat(baseUrl: string, model: string, system: string, user: string, schema: object): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
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
  // 404 = model not pulled; anything else (incl. the dev proxy's 5xx) = Ollama not running.
  if (!res.ok) throw new OllamaError(res.status === 404 ? "model_missing" : "unreachable");
  return (await res.json()).message.content;
}
