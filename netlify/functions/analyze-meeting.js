// POST /.netlify/functions/analyze-meeting
// body: { transcript: string, customPrompt?: string }
//   transcript       the meeting/call transcript to analyze
//   customPrompt     optional instructions (e.g., "mention our API", "include calendar link")
// Returns: { subject: string, body: string, analysis: object, read: string, notes: string[], model: string }
//
// Three steps:
//   1. ANALYZE: Extract lead behavior, pain points, goals, mission from transcript
//   2. GENERATE: Create follow-up email combining analysis + custom prompt
//   3. HUMANIZE: Apply David Wilder voice and natural humanization

import { callClaude, json, stripWrappers, MODEL } from './lib/claude.js'
import { companyBrief } from './lib/company.js'
import { STYLE_RULES, hardRuleViolations, placeholderViolations, INTENSITY_NOTES } from './lib/style.js'
import { humanizeText } from './humanize.js'

const ANALYSIS_SYSTEM = `You are an expert sales analyst specializing in understanding prospect behavior from call transcripts. Your job is to extract actionable insights from meeting transcripts.

Analyze the meeting transcript and extract:
1. LEAD BEHAVIOR: How did they communicate? Energy level? Engagement type? What questions did they ask?
2. PAIN POINTS: What problems, challenges, or frustrations did they mention or hint at?
3. GOALS: What are they trying to achieve? What outcomes matter to them?
4. MISSION/VALUES: What seems to drive their business or priorities? What do they care about?
5. OBJECTIONS: Any hesitations or concerns raised?
6. BUYING SIGNALS: Interest level indicators? Next step readiness?
7. TONE: Formal, casual, technical, business-oriented? How formal should the follow-up be?

IMPORTANT: Be specific. Quote the transcript when possible. Don't generalize.

Output as JSON:
{
  "behavior": "...",
  "painPoints": [...],
  "goals": [...],
  "missionValues": "...",
  "objections": [...],
  "buyingSignals": [...],
  "tone": "...",
  "summary": "..."
}`

const FOLLOWUP_SYSTEM = `You are David Wilder, an experienced B2B outreach specialist writing a follow-up email after a meeting with a prospect. Your job is to reference the meeting insights and create a personalized, credible follow-up that moves the conversation forward.

=== ABOUT US ===
${companyBrief()}
=== END ===

=== MEETING ANALYSIS ===
{analysis}
=== END ===

YOUR TASK:
1. Reference something specific from the call (a pain point they mentioned, a goal they shared, a question they asked)
2. Show you were listening and understood their situation
3. If there's a custom prompt, incorporate it naturally (don't force it)
4. End with a clear next step
5. Sound like David Wilder: confident, direct, peer-to-peer, optimistic

CONTEXT AND CREDIBILITY RULES:
- Keep the formality level matching their tone from the call
- Don't oversell or make false promises
- Be specific and reference the call
- Make them feel heard and understood
- Assume confidence in the next step

YOUR WRITING VOICE (David Wilder Master Style):
You sound distinctly human, never templated, never like an AI. Happy and cheerful with very high confidence. Professional peer-to-peer, never salesy. Remove "I," "we," "our," "us" as much as possible—focus on what it does for THEM. End with bold, confident CTAs that assume the close. Use contractions. No em dashes, semicolons, or "Hey" in greetings.

${STYLE_RULES}

OUTPUT FORMAT (exactly this, nothing else):
SUBJECT: <subject line for the follow-up>
READ: <one sentence: what you're doing, for the sender's eyes only>
BODY:
<the email>`

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' })

  let payload
  try { payload = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON' }) }

  const transcript = (payload.transcript || '').trim()
  const customPrompt = (payload.customPrompt || '').trim().slice(0, 500)
  if (!transcript) return json(400, { error: 'transcript is required' })
  if (transcript.length > 50000) return json(400, { error: 'Transcript too long (50k char limit). Trim and try again.' })

  const notes = []
  try {
    // Step 1: ANALYZE the meeting transcript
    notes.push('Analyzing meeting transcript...')
    let analysisRaw = await callClaude({
      system: ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: `Analyze this meeting transcript:\n\n${transcript}` }],
      maxTokens: 1500,
      temperature: 0.7,
    })

    let analysis = {}
    try {
      analysis = JSON.parse(analysisRaw)
    } catch {
      notes.push('Analysis parsing: extracting from text response')
      analysis = {
        behavior: analysisRaw,
        painPoints: [],
        goals: [],
        missionValues: '',
        objections: [],
        buyingSignals: [],
        tone: 'professional',
        summary: analysisRaw
      }
    }

    // Step 2: GENERATE follow-up email using analysis
    notes.push('Generating follow-up email...')
    const followupPrompt = customPrompt ? `\n\nCUSTOM INSTRUCTION FROM SENDER:\n${customPrompt}` : ''

    const generationSystem = FOLLOWUP_SYSTEM.replace('{analysis}', JSON.stringify(analysis, null, 2))

    let raw = await callClaude({
      system: generationSystem,
      messages: [{
        role: 'user',
        content: `Using the meeting analysis above, write a follow-up email to this prospect.${followupPrompt}\n\nBe specific, reference the call, and make them feel heard.`
      }],
      maxTokens: 1200,
      temperature: 0.75,
    })
    let parsed = parseReply(raw)

    // Check for rule violations
    const problems = [...placeholderViolations(parsed.body), ...hardRuleViolations(parsed.body)]
    if (problems.length) {
      notes.push(`Fix pass: ${problems.join(', ')}`)
      raw = await callClaude({
        system: generationSystem,
        messages: [
          { role: 'user', content: `Using the meeting analysis above, write a follow-up email to this prospect.${followupPrompt}` },
          { role: 'assistant', content: raw },
          { role: 'user', content: `Your draft has these problems: ${problems.join('; ')}. Fix only those and output the full SUBJECT / READ / BODY block again.` },
        ],
        maxTokens: 1200,
        temperature: 0.7,
      })
      parsed = parseReply(raw)
    }

    // Step 3: HUMANIZE the email
    notes.push('Humanizing email...')
    const h = await humanizeText(
      `${INTENSITY_NOTES.standard}\n\nRewrite this email. Output only the rewritten email.\n\n<email>\n${parsed.body}\n</email>`
    )
    notes.push(...h.notes.map(n => `Humanizer: ${n}`))

    // Never let the humanizer introduce a placeholder
    const finalBody = placeholderViolations(h.text).length ? parsed.body : h.text

    return json(200, {
      subject: parsed.subject,
      body: finalBody,
      analysis,
      read: parsed.read,
      notes,
      model: MODEL
    })
  } catch (err) {
    return json(502, { error: err.message || 'Claude request failed' })
  }
}

function parseReply(raw) {
  const t = stripWrappers(raw)
  const subject = (t.match(/^\s*SUBJECT:\s*(.+)$/im) || [])[1]?.trim() || ''
  const read = (t.match(/^\s*READ:\s*(.+)$/im) || [])[1]?.trim() || ''
  const bodyIdx = t.search(/^\s*BODY:\s*$/im)
  let body = bodyIdx >= 0 ? t.slice(bodyIdx).replace(/^\s*BODY:\s*\n?/i, '') : t
  body = body.replace(/^\s*(SUBJECT|READ):.*$/gim, '').trim()
  return { subject, read, body }
}
