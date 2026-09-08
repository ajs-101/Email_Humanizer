// POST /.netlify/functions/humanize   body: { email: string, intensity?: 'light'|'standard'|'aggressive' }
// Returns: { humanized: string, notes: string[], model: string }

import { callClaude, json, stripWrappers, MODEL } from './lib/claude.js'
import { HUMANIZER_SYSTEM, INTENSITY_NOTES, hardRuleViolations } from './lib/style.js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' })

  let payload
  try { payload = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON' }) }

  const email = (payload.email || '').trim()
  const intensity = ['light', 'standard', 'aggressive'].includes(payload.intensity) ? payload.intensity : 'standard'
  if (!email) return json(400, { error: 'email is required' })
  if (email.length > 12000) return json(400, { error: 'Email too long (12k char limit)' })

  const userMessage = `${INTENSITY_NOTES[intensity]}\n\nRewrite this email. Output only the rewritten email.\n\n<email>\n${email}\n</email>`

  try {
    const { text, notes } = await humanizeText(userMessage)
    return json(200, { humanized: text, notes, model: MODEL })
  } catch (err) {
    return json(502, { error: err.message || 'Claude request failed' })
  }
}

// Shared with reply.js. Two attempts: if the first output trips a hard rule, ask for a fix pass.
export async function humanizeText(userMessage) {
  const notes = []
  let out = await callClaude({ system: HUMANIZER_SYSTEM, messages: [{ role: 'user', content: userMessage }] })
  const violations = hardRuleViolations(out)
  if (violations.length) {
    notes.push(`Fix pass triggered: ${violations.join(', ')}`)
    out = await callClaude({
      system: HUMANIZER_SYSTEM,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: out },
        { role: 'user', content: `Your draft still breaks these rules: ${violations.join('; ')}. Fix only those and output the full email again, nothing else.` },
      ],
    })
  }
  return { text: stripWrappers(out), notes }
}
