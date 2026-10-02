// POST /.netlify/functions/humanize   body: { email: string, intensity?: 'light'|'standard'|'aggressive' }
// Returns: { humanized: string, concise: string, notes: string[], model: string }

import { callClaude, json, stripWrappers, MODEL } from "./lib/claude.js";
import {
  HUMANIZER_SYSTEM,
  INTENSITY_NOTES,
  hardRuleViolations,
} from "./lib/style.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const email = (payload.email || "").trim();
  const intensity = ["light", "standard", "aggressive"].includes(
    payload.intensity,
  )
    ? payload.intensity
    : "standard";
  if (!email) return json(400, { error: "email is required" });
  if (email.length > 12000)
    return json(400, { error: "Email too long (12k char limit)" });

  const notes = [];
  try {
    // Generate main humanized version
    const userMessage = `${INTENSITY_NOTES[intensity]}\n\nRewrite this email. Output only the rewritten email.\n\n<email>\n${email}\n</email>`;
    const { text: humanized, notes: mainNotes } = await humanizeText(
      userMessage,
      0.8,
    );
    notes.push(...mainNotes);

    // Generate concise version (always AGGRESSIVE + compress instruction)
    const conciseMessage = `${INTENSITY_NOTES.aggressive}\n\nMake this email DRAMATICALLY shorter while keeping ALL key points, the main ask, and credibility signals. Cut filler, combine ideas, use shorter sentences. Output only the rewritten email.\n\n<email>\n${humanized}\n</email>`;
    const { text: concise, notes: conciseNotes } = await humanizeText(
      conciseMessage,
      0.75,
      true,
    );
    notes.push(...conciseNotes.map((n) => `Concise: ${n}`));

    return json(200, { humanized, concise, notes, model: MODEL });
  } catch (err) {
    return json(502, { error: err.message || "Claude request failed" });
  }
};

// Shared with reply.js. Two attempts: if the first output trips a hard rule, ask for a fix pass.
export async function humanizeText(
  userMessage,
  temperature = 0.8,
  isConcise = false,
) {
  const notes = [];
  let out = await callClaude({
    system: HUMANIZER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    temperature,
  });
  const violations = hardRuleViolations(out);
  if (violations.length) {
    notes.push(`Fix pass triggered: ${violations.join(", ")}`);
    out = await callClaude({
      system: HUMANIZER_SYSTEM,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: out },
        {
          role: "user",
          content: `Your draft still breaks these rules: ${violations.join("; ")}. Fix only those and output the full email again, nothing else.`,
        },
      ],
      temperature: 0.7,
    });
  }
  return { text: stripWrappers(out), notes }; 
}
