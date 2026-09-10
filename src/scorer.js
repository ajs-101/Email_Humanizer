// Local, deterministic "AI-likeness" scorer. Runs in the browser, no API calls.
// Returns a 0-100 score (higher = more AI-sounding) plus the list of flags found.

const AI_PHRASES = [
  'i hope this email finds you well', 'i hope this finds you well', 'i hope you are doing well',
  'i hope you\'re doing well', 'i trust this email finds you', 'as per my last email',
  'per my previous email', 'i wanted to reach out', 'i am reaching out', 'i\'m reaching out',
  'just circling back', 'touching base', 'i wanted to follow up', 'following up on my previous',
  'please do not hesitate', 'don\'t hesitate to reach out', 'feel free to reach out',
  'feel free to contact', 'looking forward to hearing from you', 'i look forward to hearing',
  'thank you for your time and consideration', 'at your earliest convenience',
  'in today\'s fast-paced', 'in today\'s digital landscape', 'in the ever-evolving',
  'it\'s important to note', 'it is worth noting', 'i wanted to take a moment',
  'i came across your', 'i noticed that your', 'unlock the potential', 'take your business to the next level',
  'game-changer', 'game changer', 'cutting-edge', 'cutting edge', 'state-of-the-art',
  'best-in-class', 'world-class', 'seamlessly', 'seamless', 'leverage', 'leveraging',
  'synergy', 'streamline', 'robust', 'holistic', 'empower', 'elevate', 'delve', 'tapestry',
  'navigate the complexities', 'landscape', 'testament to', 'underscore', 'pivotal',
  'furthermore', 'moreover', 'additionally', 'in conclusion', 'in summary', 'ultimately',
  'rest assured', 'i would be more than happy', 'i\'d be more than happy',
  'would love to connect', 'quick question for you', 'i\'ll keep this short', 'i\'ll keep this brief',
  'warm regards', 'kind regards', 'best regards', 'i appreciate your time',
  'let me know if you have any questions', 'if you have any questions, please',
  'excited to share', 'thrilled to', 'delighted to', 'i\'m excited', 'we are excited',
  'revolutionize', 'transform your', 'supercharge', 'skyrocket', 'boost your',
  'here\'s the deal', 'has your name on it', 'sitting on the sidelines', 'moving fast right now',
  'window doesn\'t stay open', 'window won\'t stay open', 'window won\'t last', 'where things actually stand',
  'let\'s get it rolling', 'get the ball rolling', 'gone back and forth',
]

const SPAM_WORDS = [
  'free', 'guarantee', 'guaranteed', 'no obligation', 'risk-free', 'risk free', 'act now',
  'limited time', 'urgent', 'exclusive deal', 'click here', 'buy now', 'order now',
  '100%', 'earn money', 'make money', 'double your', 'increase sales', 'winner', 'congratulations',
  'no cost', 'lowest price', 'special promotion', 'discount', 'cash', 'credit', 'offer expires',
  'don\'t miss', 'once in a lifetime', 'amazing', 'incredible', 'unbelievable',
]

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map(s => s.trim())
    .filter(s => s.split(' ').length >= 2)
}

function stdDev(nums) {
  if (nums.length < 2) return 0
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const v = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length
  return Math.sqrt(v)
}

export function scoreEmail(raw) {
  const text = (raw || '').trim()
  if (!text) return { score: 0, flags: [], words: 0, sentences: 0, burstiness: 0 }

  const lower = text.toLowerCase()
  const words = text.split(/\s+/).filter(Boolean)
  const sentences = splitSentences(text)
  const lens = sentences.map(s => s.split(/\s+/).length)
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0
  const burst = stdDev(lens)
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)

  const flags = []
  let score = 0

  // 1. AI phrases — the strongest signal
  const phraseHits = AI_PHRASES.filter(p => lower.includes(p))
  phraseHits.forEach(p => flags.push({ type: 'phrase', label: `AI phrase: "${p}"`, weight: 8 }))
  score += Math.min(72, phraseHits.length * 8)

  // 2. Spam trigger words
  const spamHits = SPAM_WORDS.filter(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
  spamHits.forEach(w => flags.push({ type: 'spam', label: `Spam trigger: "${w}"`, weight: 3 }))
  score += Math.min(15, spamHits.length * 3)

  // 3. Em dashes / semicolons (classic LLM punctuation)
  const emDashes = (text.match(/—|--/g) || []).length
  if (emDashes > 0) {
    flags.push({ type: 'punct', label: `${emDashes} em dash${emDashes > 1 ? 'es' : ''}`, weight: 5 * emDashes })
    score += Math.min(12, emDashes * 5)
  }
  const semis = (text.match(/;/g) || []).length
  if (semis > 0) {
    flags.push({ type: 'punct', label: `${semis} semicolon${semis > 1 ? 's' : ''}`, weight: 3 })
    score += Math.min(6, semis * 3)
  }

  // 4. Greeting rule: no hyphen or colon in greeting line
  const firstLine = text.split('\n')[0].trim()
  if (/^(hi|hey|hello|dear)\b.*[:\-–—]/i.test(firstLine)) {
    flags.push({ type: 'greeting', label: 'Greeting uses a colon or hyphen', weight: 6 })
    score += 6
  }

  // 5. Low burstiness (uniform sentence lengths) — hallmark of AI
  if (sentences.length >= 3) {
    if (burst < 2.5) { flags.push({ type: 'rhythm', label: 'Sentences are all the same length', weight: 12 }); score += 12 }
    else if (burst < 4) { flags.push({ type: 'rhythm', label: 'Low sentence-length variation', weight: 6 }); score += 6 }
    if (avgLen > 20) { flags.push({ type: 'rhythm', label: `Long sentences (avg ${avgLen.toFixed(0)} words)`, weight: 6 }); score += 6 }
  }

  // 6. Uniform paragraphs
  if (paragraphs.length >= 3) {
    const pLens = paragraphs.map(p => p.split(/\s+/).length)
    if (stdDev(pLens) < 4) { flags.push({ type: 'rhythm', label: 'Paragraphs are all the same size', weight: 6 }); score += 6 }
  }

  // 7. Length: cold emails should stay short
  if (words.length > 150) { flags.push({ type: 'length', label: `${words.length} words (aim under 120)`, weight: 6 }); score += 6 }
  else if (words.length > 120) { flags.push({ type: 'length', label: `${words.length} words (aim under 120)`, weight: 3 }); score += 3 }

  // 8. No contractions at all in a longer email reads stiff
  if (words.length > 40 && !/\b\w+'(s|t|re|ve|ll|d|m)\b/i.test(text)) {
    flags.push({ type: 'tone', label: 'No contractions (reads stiff)', weight: 5 }); score += 5
  }

  // 9. Doesn't end on a question
  // Strip trailing sign-off lines (short lines like "Thanks," / "Ahmed" / "Best,\nAhmed\nCEO, AISE")
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  while (lines.length > 1 && lines[lines.length - 1].split(/\s+/).length <= 4 && !/\?$/.test(lines[lines.length - 1])) lines.pop()
  const body = lines.join('\n')
  if (words.length > 25 && !/\?\s*$/.test(body)) {
    flags.push({ type: 'tone', label: 'Doesn\'t end with a question', weight: 4 }); score += 4
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    flags,
    words: words.length,
    sentences: sentences.length,
    burstiness: Number(burst.toFixed(1)),
  }
}

export function scoreLabel(score) {
  if (score >= 60) return { text: 'Sounds like AI', tone: 'bad' }
  if (score >= 30) return { text: 'Mixed signals', tone: 'mid' }
  return { text: 'Reads human', tone: 'good' }
}
