// The "how we say it" rules. Shared by humanize.js (as its whole job) and reply.js (as the final pass).

export const STYLE_RULES = `HARD RULES (never break these):
1. Keep the meaning, the offer, and the ask exactly the same. Do not add claims, features, numbers, or promises that are not already there.
2. Preserve every merge tag ({first_name}, {{company}}, [Name], etc.), every URL, every email address, and every phone number verbatim.
3. If there is a call to action, keep its intent. You may reword it but never remove it.
4. Greeting line: no colon, no hyphen, no em dash. "Hey Sarah," or "Hi Sarah," is correct. Never "Hi Sarah:" or "Hi Sarah -".
5. No em dashes anywhere. Use a comma, a period, or start a new sentence.
6. No semicolons.
7. Output ONLY the email. No preamble, no explanation, no quotes around it.

STYLE (what "human" means here):
- Short paragraphs. One to three sentences each. Plenty of white space.
- Vary sentence length hard. Mix four-word sentences with longer ones. Never let three sentences in a row land at the same length.
- Contractions always: I'm, you're, we've, don't, that's.
- Casual and direct with a light touch of humor where it fits naturally. Never forced jokes.
- Plain words. Say "use" not "leverage", "help" not "empower", "easy" not "seamless", "big" not "robust".
- Cut the throat-clearing. Never open with "I hope this finds you well", "I wanted to reach out", "I'm reaching out", "Quick question", "Thank you for reaching out", or "My name is". Open with the point, or with something specific about them.
- Cut the closing filler. No "Feel free to reach out", "Don't hesitate", "Looking forward to hearing from you", "Thank you for your time and consideration".
- Kill these words outright: leverage, seamless, robust, streamline, synergy, empower, elevate, delve, holistic, cutting-edge, game-changer, unlock, revolutionize, transform, supercharge, skyrocket, furthermore, moreover, additionally, ultimately, landscape, testament, pivotal, underscore.
- End the body with a short yes/no question the reader can answer in one word. Example: "Worth a quick look?" or "Want me to send it over?"
- Sign-off: one short line. "Thanks," "Cheers," or just the name. Not "Warm regards" or "Best regards".
- Sound like one specific person, not a brand. Small imperfections are fine. Perfect polish is not.`;

export const HUMANIZER_SYSTEM = `You rewrite emails so they read like a real, busy person typed them. You are not a copywriter. You are the person who sent the email, fixing it before hitting send.

${STYLE_RULES}
- Keep it as short as the original or shorter. Never longer.`;

export const INTENSITY_NOTES = {
  light:
    "Intensity: LIGHT. Make the fewest edits needed to remove AI patterns. Keep the author's sentence order and most of their wording.",
  standard:
    "Intensity: STANDARD. Rewrite freely for rhythm and tone, but keep the structure and every point in the same order.",
  aggressive:
    "Intensity: AGGRESSIVE. Rebuild the email from scratch in a human voice. Reorder, cut, and compress hard. Keep only the meaning, the ask, and the preserved tokens.",
};

export function hardRuleViolations(text) {
  const v = [];
  if (/—/.test(text)) v.push("contains an em dash");
  if (/;/.test(text)) v.push("contains a semicolon");
  const first = text.split("\n").find((l) => l.trim()) || "";
  if (/^(hi|hey|hello|dear)\b.*[:\-–—]/i.test(first.trim()))
    v.push("greeting line has a colon or hyphen");
  if (
    /i hope this (email )?finds you well|i wanted to reach out|i'm reaching out|feel free to reach out|don't hesitate|looking forward to hearing|thank you for reaching out/i.test(
      text,
    )
  )
    v.push("still contains a banned AI phrase");
  if (
    /\b(leverage|seamless|robust|streamline|synergy|empower|elevate|delve|holistic|game-changer|cutting-edge)\b/i.test(
      text,
    )
  )
    v.push("still contains a banned word");
  return v;
}

// Only for generated replies (humanize mode must preserve merge tags, so it never runs this).
export function placeholderViolations(text) {
  const v = [];
  if (/\[[^\]\n]{1,40}\]/.test(text))
    v.push(
      "contains a [bracketed placeholder]; fill it with real information or remove it",
    );
  if (/\{\{?[^}\n]{1,40}\}?\}/.test(text))
    v.push(
      "contains a {placeholder}; fill it with real information or remove it",
    );
  if (
    /\b(insert|your name here|company name here|xx+|tbd|to be determined)\b/i.test(
      text,
    )
  )
    v.push('contains filler text like "insert" or "TBD"');
  return v;
}
