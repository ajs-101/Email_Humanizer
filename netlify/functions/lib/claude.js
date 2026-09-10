// Shared Claude wrapper for all functions.

export const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5";

export async function callClaude({
  system,
  messages,
  maxTokens = 1500,
  temperature = 0.8,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the server");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      // Cache the (large, static) system prompt so repeat calls are cheap.
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

export const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function stripWrappers(text) {
  let t = (text || "").trim();
  t = t
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
  t = t
    .replace(
      /^(here('s| is) (the |your |a )?(rewritten|humanized|reply|response|draft)( email| version)?[:.]?\s*\n+)/i,
      "",
    )
    .trim();
  return t;
}
