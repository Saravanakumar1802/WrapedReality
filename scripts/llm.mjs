/**
 * One small interface over the language models the build can use:
 *
 *   complete({ system, prompt, maxOutputTokens }) → { text, usage: { input, output } }
 *
 * Provider is chosen by LLM_PROVIDER, or the first key found in this order:
 *   GEMINI_API_KEY      Google AI Studio, free tier (default)
 *   OPENROUTER_API_KEY  OpenRouter ":free" models (backup)
 *   ANTHROPIC_API_KEY   Claude (paid)
 *
 * All calls are plain text in, plain text out: the moment step asks for one
 * compact line per moment, which costs far fewer output tokens than JSON.
 */
import { env, log, sleep } from "./util.mjs";

const RETRIES = 4;

/** Retries rate limits / overloads with backoff (free tiers return 429 when busy). */
async function withRetry(name, call) {
  for (let attempt = 0; ; attempt++) {
    const res = await call();
    if (res.ok) return res.json();
    const body = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRIES) throw new Error(`${name} HTTP ${res.status}: ${body.slice(0, 200)}`);
    const hinted = Number(body.match(/"retryDelay":\s*"(\d+)s"/)?.[1]);
    const wait = Number.isFinite(hinted) ? hinted * 1000 : 2000 * 2 ** attempt;
    log.info(`${name}: busy (HTTP ${res.status}), retrying in ${Math.round(wait / 1000)} s`);
    await sleep(wait);
  }
}

/** Google Gemini (AI Studio key). Free tier: Flash / Flash-Lite models. */
export function gemini({ apiKey = env("GEMINI_API_KEY"), model = env("GEMINI_MODEL") || "gemini-3.5-flash-lite" } = {}) {
  return {
    name: "gemini",
    model,
    async complete({ system, prompt, maxOutputTokens }) {
      const generationConfig = { maxOutputTokens, temperature: 0.2 };
      // Gemini 3 models think by default; this job doesn't need it (thinking tokens count against limits).
      if (/gemini-3/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
      const data = await withRetry("Gemini", () =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
          }),
        }),
      );
      const cand = data.candidates?.[0];
      if (!cand) throw new Error(`Gemini returned no answer (${data.promptFeedback?.blockReason ?? "unknown"})`);
      if (cand.finishReason === "MAX_TOKENS") throw new Error("answer cut off (max output tokens)");
      const u = data.usageMetadata ?? {};
      return {
        text: (cand.content?.parts ?? []).map((p) => p.text ?? "").join(""),
        usage: { input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) },
      };
    },
  };
}

/** OpenRouter (OpenAI-compatible). Free models end in ":free": 20/min, 50/day (1,000/day after a one-time $10 top-up). */
export function openrouter({
  apiKey = env("OPENROUTER_API_KEY"),
  model = env("OPENROUTER_MODEL") || "nvidia/nemotron-3.5-lightning:free",
} = {}) {
  return {
    name: "openrouter",
    model,
    async complete({ system, prompt, maxOutputTokens }) {
      const data = await withRetry("OpenRouter", () =>
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "x-title": "WrapedReality build" },
          body: JSON.stringify({
            model,
            max_tokens: maxOutputTokens,
            temperature: 0.2,
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
        }),
      );
      const choice = data.choices?.[0];
      if (!choice) throw new Error(`OpenRouter returned no answer (${data.error?.message ?? "unknown"})`);
      if (choice.finish_reason === "length") throw new Error("answer cut off (max output tokens)");
      return {
        text: choice.message?.content ?? "",
        usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

/** Claude (paid). Low effort: this is extraction, not deep reasoning. */
export function anthropic({ apiKey = env("ANTHROPIC_API_KEY"), model = env("ANTHROPIC_MODEL") || "claude-opus-5-5" } = {}) {
  let client = null;
  return {
    name: "anthropic",
    model,
    async complete({ system, prompt, maxOutputTokens }) {
      if (!client) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        client = new Anthropic({ apiKey });
      }
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxOutputTokens,
        // On a policy decline the API re-runs the request on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system,
        messages: [{ role: "user", content: prompt }],
      });
      if (response.stop_reason === "refusal") throw new Error("declined by the model");
      if (response.stop_reason === "max_tokens") throw new Error("answer cut off (max output tokens)");
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { text, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } };
    },
  };
}

const PROVIDERS = {
  gemini: [gemini, "GEMINI_API_KEY"],
  openrouter: [openrouter, "OPENROUTER_API_KEY"],
  anthropic: [anthropic, "ANTHROPIC_API_KEY"],
};

/** The configured model, or null when no key is set. */
export function createLLM() {
  const chosen = env("LLM_PROVIDER").toLowerCase();
  if (chosen) {
    const p = PROVIDERS[chosen];
    if (!p) throw new Error(`LLM_PROVIDER "${chosen}" is not one of: ${Object.keys(PROVIDERS).join(", ")}`);
    return env(p[1]) ? p[0]() : null;
  }
  for (const [make, key] of Object.values(PROVIDERS)) if (env(key)) return make();
  return null;
}
