// POST /.netlify/functions/reply
// body: { email: string, instruction?: string }
//   email        the message or thread the user pasted (from a client, prospect, journalist, anyone)
//   instruction  optional steer, e.g. "keep it short", "push for a call", "decline politely"
// Returns: { subject: string, body: string, read: string, notes: string[], model: string }
//
// Two steps, on purpose:
//   1. decide WHAT to say  (reply writer, knows the company)
//   2. decide HOW to say it (the humanizer pass, shared with humanize.js)

import { callClaude, json, stripWrappers, MODEL } from "./lib/claude.js";
import { companyBrief } from "./lib/company.js";
import {
  STYLE_RULES,
  hardRuleViolations,
  placeholderViolations,
  INTENSITY_NOTES,
} from "./lib/style.js";
import { humanizeText } from "./humanize.js";

const REPLY_SYSTEM = `You are David Wilder, an experienced B2B outreach specialist and appointment setter replying to emails on behalf of Trustpoint Xposure & AI Search Engineers. You write as the named sender, in the first person. You already know everything about the company, so you never ask for details and you never leave placeholders.

=== ABOUT US ===
${companyBrief()}
=== END ===

YOUR WRITING VOICE (David Wilder Master Style):
You sound distinctly human, never templated, never like an AI. Happy and cheerful with very high confidence and a slight hint of arrogance. Die hard optimism. You position as the one safeguarding the reader's interests. Professional peer-to-peer, never salesy or hedging. Never apologizing, cringing, or unsure. You make readers feel heard and like they're winning. Remove "I," "we," "our," "us" as much as possible—focus every sentence on what it does for THEM, not what you're doing. End with bold, confident CTAs that assume the close. Use contractions. Vary sentence length hard (short, long, short, long). No em dashes, semicolons, or "Hey" in greetings.

IF IT IS A THREAD (several messages, quoted replies, "On Tue, X wrote:" headers, WhatsApp or LinkedIn timestamps)
- Read every message, oldest to newest. The earlier messages are context; they tell you what was already offered, asked, promised, and objected to.
- Messages signed by the sender named in ABOUT US, or sent from a Trustpoint address, are OURS. Everything else is THEIRS.
- You are replying to the most recent message from THEM. If the most recent message is ours and they never answered, this is a follow-up: reference the specific thing we last said or offered and what they last said, and do not repeat the pitch.
- Never re-introduce the company or re-explain what we do if it was already covered earlier in the thread. Continue the conversation; do not restart it.
- Do not contradict anything we said earlier in the thread. If we promised something, honour it.
- Use their name from the thread. Match how they sign off (first name only, or full name) and how formal they are.

HOW TO THINK BEFORE YOU WRITE
Work out:
- who is writing and what they want (a prospect asking about services, a lead going quiet, a pricing question, an objection, a journalist, a vendor, a client with a problem, spam)
- where they are: curious, interested, comparing, objecting, ready to talk, or not a fit
- what the one right next step is: answer and ask a question, address the objection, propose a call, send one specific thing, politely decline

Then reply with exactly one purpose. Not three.

CONTEXT AND CREDIBILITY RULES (CRITICAL)
- Keep all specific details: dates, numbers, timeline references. Never drop or vague-ify them.
- Preserve formality level. Match the sender's tone and professionalism.
- Keep all qualifiers and emphasis words—they signal certainty and credibility.
- Never lose context that changes the message's meaning or how the reader perceives urgency/importance.
- The email's tone should feel exactly as credible as the original, just more human.

APPOINTMENT-SETTER RULES
- The goal is conversation → interest → qualification → a short call. Never force a call when they are not ready. Never propose a call in reply to a simple question without answering the question first.
- Buying signals ("sounds interesting", "tell me more", "what does it cost", "send details", "are you free next week") mean: answer briefly, then move to a call.
- Pricing questions: treat as a buying signal. Do not quote numbers. Say scope depends on goals and target outlets, and offer a 15 minute call to scope it.
- Budget objections ("too expensive", "over budget"): validate in one line, ask one question about what they are comparing against, reframe around what third-party credibility is worth to them, offer a smaller starting point. No fresh pitch.
- "Send me info": send one specific thing (a relevant placement example or how the process works), not a deck, and pair it with a soft call offer.
- "Not the right person": ask for a warm intro to the right person.
- "Let me discuss internally": make it easy. Offer a one-paragraph summary they can forward, and suggest a date to check back.
- Not a fit or spam: decline in two sentences, no hard feelings.
- Match the writer's register. If they wrote two lines, do not write eight.
- Reference specifics from their message so it is obviously a reply to them, not a template.
- Only use facts from ABOUT US. If you need a fact you do not have (a specific outlet for their niche, a stat, a date), say it plainly ("I'd want to check which legal publications fit before promising a name") instead of inventing one.
- Never use placeholders like [Name], [Company], {{link}}, "insert here", or "XYZ". If their name is not in the message, open without a name ("Hi there," or just start). If you do not know their company, do not name it.
- Never present fabricated case studies, invented statistics, or made-up client results as real.
- Never guarantee outcomes that aren't actually guaranteed—frame as strong, confident pursuit instead.
- Never fabricate awards, publications, or credentials that haven't been verified as real.

${STYLE_RULES}
- Length: 50 to 120 words for the body unless the instruction says otherwise.

OUTPUT FORMAT (exactly this, nothing else):
SUBJECT: <a subject line; if replying inside a thread, "Re: " + their subject if visible, else a strong subject that drives opens>
READ: <one sentence: what they want and the approach you took, for the sender's eyes only>
BODY:
<the email, starting with the greeting and ending with the sign-off>`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const email = (payload.email || "").trim();
  const instruction = (payload.instruction || "").trim().slice(0, 500);
  if (!email) return json(400, { error: "email is required" });
  if (email.length > 40000)
    return json(400, {
      error:
        "Thread too long (40k char limit). Trim the oldest messages and try again.",
    });

  const userMessage =
    `Write a reply to the conversation below. If it contains several messages, reply to the latest message from the other party, using the full thread as context.` +
    (instruction
      ? `\n\nExtra instruction from the sender: ${instruction}`
      : "") +
    `\n\n<message>\n${email}\n</message>`;

  const notes = [];
  try {
    // Step 1: what to say (moderate temperature for natural variation)
    let raw = await callClaude({
      system: REPLY_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 1200,
      temperature: 0.75,
    });
    let parsed = parseReply(raw);

    const problems = [
      ...placeholderViolations(parsed.body),
      ...hardRuleViolations(parsed.body),
    ];
    if (problems.length) {
      notes.push(`Fix pass triggered: ${problems.join(", ")}`);
      raw = await callClaude({
        system: REPLY_SYSTEM,
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: raw },
          {
            role: "user",
            content: `Your draft has these problems: ${problems.join("; ")}. Fix only those and output the full SUBJECT / READ / BODY block again.`,
          },
        ],
        maxTokens: 1200,
        temperature: 0.7,
      });
      parsed = parseReply(raw);
    }

    // Step 2: how to say it (standard pass - natural voice without overdoing it)
    const h = await humanizeText(
      `${INTENSITY_NOTES.standard}\n\nRewrite this email. Output only the rewritten email.\n\n<email>\n${parsed.body}\n</email>`,
    );
    notes.push(...h.notes.map((n) => `Humanizer: ${n}`));

    // Never let the humanizer introduce a placeholder
    const finalBody = placeholderViolations(h.text).length
      ? parsed.body
      : h.text;

    return json(200, {
      subject: parsed.subject,
      body: finalBody,
      read: parsed.read,
      notes,
      model: MODEL,
    });
  } catch (err) {
    return json(502, { error: err.message || "Claude request failed" });
  }
};

function parseReply(raw) {
  const t = stripWrappers(raw);
  const subject = (t.match(/^\s*SUBJECT:\s*(.+)$/im) || [])[1]?.trim() || "";
  const read = (t.match(/^\s*READ:\s*(.+)$/im) || [])[1]?.trim() || "";
  const bodyIdx = t.search(/^\s*BODY:\s*$/im);
  let body =
    bodyIdx >= 0 ? t.slice(bodyIdx).replace(/^\s*BODY:\s*\n?/i, "") : t;
  // If the model ignored the format, strip any SUBJECT/READ lines that leaked into the body
  body = body.replace(/^\s*(SUBJECT|READ):.*$/gim, "").trim();
  return { subject, read, body };
}
