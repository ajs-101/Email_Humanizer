import { useMemo, useState } from 'react'
import { scoreEmail, scoreLabel } from './scorer.js'

const SAMPLE_INBOUND = `Subject: Re: Getting your firm featured

Hi Ahmed,

Thanks for reaching out. We're a 12-attorney personal injury firm in Phoenix and honestly we've been burned by PR agencies before. Lots of promises, one article in a site nobody reads.

That said, the AI search angle is interesting. Two questions: what does something like this cost, and how do we know the placements are real outlets and not pay-to-play blogs?

Mark Delgado
Managing Partner, Delgado & Reyes`

const SAMPLE_HUMANIZE = `Hi Sarah,

I hope this email finds you well. I wanted to reach out because I came across your company and was impressed by your growth in the SaaS landscape.

We help businesses like yours leverage cutting-edge AI to streamline operations and unlock seamless growth. Our robust platform empowers teams to elevate their productivity.

I would love to schedule a quick call to discuss how we can help you take your business to the next level. Please don't hesitate to reach out if you have any questions.

Looking forward to hearing from you.

Best regards,
Ahmed`

const QUICK_INSTRUCTIONS = ['Keep it short', 'Push for a call', 'Answer, no pitch', 'Handle the objection', 'Decline politely']

function ScoreChip({ text }) {
  const s = useMemo(() => scoreEmail(text), [text])
  if (!text.trim()) return null
  const l = scoreLabel(s.score)
  return (
    <span className={`score ${l.tone}`} title={`${s.words} words · ${s.sentences} sentences · burstiness ${s.burstiness}`}>
      <span className="score-dot">{s.score}</span>
      <span className="score-label">{l.text}</span>
    </span>
  )
}

export default function Humanizer({ onLogout }) {
  const [mode, setMode] = useState('reply') // 'reply' | 'humanize'
  const [input, setInput] = useState('')
  const [instruction, setInstruction] = useState('')
  const [intensity, setIntensity] = useState('standard')
  const [result, setResult] = useState(null) // { subject, body, read } for reply; { body } for humanize
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const inScore = useMemo(() => scoreEmail(input), [input])
  const words = input.trim() ? input.trim().split(/\s+/).length : 0
  const isReply = mode === 'reply'

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1800) }

  const switchMode = (m) => { setMode(m); setResult(null); setError('') }

  const run = async () => {
    if (!input.trim() || busy) return
    setBusy(true); setError(''); setResult(null)
    try {
      const url = isReply ? '/.netlify/functions/reply' : '/.netlify/functions/humanize'
      const payload = isReply ? { email: input, instruction } : { email: input, intensity }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      setResult(isReply ? { subject: data.subject, body: data.body, read: data.read } : { body: data.humanized })
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!result) return
    const text = result.subject ? `Subject: ${result.subject}\n\n${result.body}` : result.body
    try { await navigator.clipboard.writeText(text); flash('Copied to clipboard!') } catch { flash('Copy failed') }
  }

  const outWords = result?.body ? result.body.trim().split(/\s+/).length : 0

  return (
    <>
      <header className="glass topbar">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="20" height="20">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Trustpoint<span>Xposure</span></div>
            <div className="brand-sub">AI Email Humanizer &amp; Reply Engine</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="seg" role="tablist" aria-label="Mode">
            <button className={isReply ? 'on' : ''} onClick={() => switchMode('reply')}>Write a reply</button>
            <button className={!isReply ? 'on' : ''} onClick={() => switchMode('humanize')}>Humanize</button>
          </div>
          <button className="btn ghost sm" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main className="main">
        {/* ---------- input ---------- */}
        <section className="glass panel">
          <div className="panel-head">
            <div className="panel-title">{isReply ? 'Their email' : 'Your email'}</div>
            {!isReply && <ScoreChip text={input} />}
          </div>
          <textarea
            className="editor"
            placeholder={isReply ? 'Paste the email or thread you received...' : 'Paste the AI-written email here...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            spellCheck={false}
          />

          {isReply ? (
            <div className="instruct">
              <input
                className="input"
                placeholder="Optional: how should the reply go? e.g. push for a call, keep it short"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                maxLength={500}
              />
              <div className="flags">
                {QUICK_INSTRUCTIONS.map(q => (
                  <button key={q} className={`flag chip ${instruction === q ? 'on' : ''}`} onClick={() => setInstruction(instruction === q ? '' : q)}>{q}</button>
                ))}
              </div>
            </div>
          ) : (
            inScore.flags.length > 0 && (
              <div className="flags">
                {inScore.flags.slice(0, 10).map((f, i) => <span key={i} className={`flag ${f.type}`}>{f.label}</span>)}
                {inScore.flags.length > 10 && <span className="flag">+{inScore.flags.length - 10} more</span>}
              </div>
            )
          )}

          <div className="panel-foot">
            {isReply ? (
              <span className="meta">Replies as Trustpoint Xposure. Company details are built in.</span>
            ) : (
              <div className="seg" role="tablist" aria-label="Intensity">
                {['light', 'standard', 'aggressive'].map(v => (
                  <button key={v} className={intensity === v ? 'on' : ''} onClick={() => setIntensity(v)}>
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="meta">{words} words</span>
              {!input && <button className="btn ghost sm" onClick={() => setInput(isReply ? SAMPLE_INBOUND : SAMPLE_HUMANIZE)}>Try a sample</button>}
              {input && <button className="btn ghost sm" onClick={() => { setInput(''); setResult(null); setError('') }}>Clear</button>}
              <button className="btn" onClick={run} disabled={busy || !input.trim()}>
                {busy ? <><span className="spin" /> {isReply ? 'Writing...' : 'Humanizing...'}</> : (isReply ? 'Write a reply' : 'Humanize')}
              </button>
            </div>
          </div>
        </section>

        {/* ---------- output ---------- */}
        <section className="glass panel">
          <div className="panel-head">
            <div className="panel-title">{isReply ? 'Your reply' : 'Humanized'}</div>
            <ScoreChip text={result?.body || ''} />
          </div>

          {error ? (
            <div className="output empty" style={{ color: '#fca5a5' }}>{error}</div>
          ) : result ? (
            <div className="output">
              {result.read && <div className="read">{result.read}</div>}
              {result.subject && <div className="subject"><span>Subject</span>{result.subject}</div>}
              {result.body}
            </div>
          ) : (
            <div className="output empty">
              {busy
                ? (isReply ? 'Reading their message and drafting a reply...' : 'Rewriting in a human voice...')
                : (isReply ? 'Your reply will appear here.' : 'Your rewritten email will appear here.')}
            </div>
          )}

          <div className="panel-foot">
            <span className="meta">{result && <>{outWords} words</>}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {result && <button className="btn ghost sm" onClick={run} disabled={busy}>Regenerate</button>}
              {result && <button className="btn sm" onClick={copy}>Copy</button>}
            </div>
          </div>
        </section>
      </main>

      {toast && <div className="glass toast">{toast}</div>}
    </>
  )
}
