import { useMemo, useState } from "react";
import { computeDiff } from "./diff.js";

const MEETING_SAMPLES = {
  sales: `Aman: Hi Mark, thanks for taking the time today. I know you're busy. Let me start by asking—what's the biggest challenge you're facing right now with getting your firm in front of the right prospects?

Mark: Honestly, we get leads but they're not qualified. A lot of tire kickers. We're spending money on ads but the ROI isn't there. And frankly, traditional PR feels slow and expensive.

Aman: That makes sense. And when you say slow, what's the timeline you're working with?

Mark: We need to see movement within 90 days. If we're going to invest in something like this, we need proof it works before we commit long-term.

Aman: Got it. One more thing—when you think about your ideal client profile, who are they and why would they care about your firm specifically?

Mark: Personal injury, high net worth cases. We're one of the few firms that handles cases over $5M. But most prospects don't even know that's a need until they hit a problem.

Aman: Perfect. And how are you currently reaching those people?

Mark: Referrals mostly. Occasionally we get inbound from Google. But it's inconsistent.`,

  legal: `Sarah: Thanks for the call. I'm Sarah, managing partner at Northgate Legal. We've been looking at ways to get more visibility for our intellectual property practice.

Aman: Great. What's making now the right time to explore this?

Sarah: Our IP practice has grown 30% year-over-year, but we're not capturing the high-value cases we should be. I think it's a visibility and credibility thing. When prospects search for IP firms, we don't come up. And when we do, they don't know our track record.

Aman: That's a common challenge. When a prospect does find you, what are they looking for that you're not communicating?

Sarah: Honestly, we're just not positioning ourselves as thought leaders. Every other firm is claiming they're the best. We need to prove it—case results, experience, that kind of thing.

Aman: Have you tried any content or thought leadership before?

Sarah: We haven't. That's part of why I'm on this call. I want to understand how this works and what kind of commitment it takes.`,
};

const SAMPLES = {
  job: `Dear Hiring Manager,

I am writing to express my enthusiastic interest in the Senior Product Manager position at your esteemed organization. With over seven years of cross-functional leadership and a proven track record in driving scalable SaaS solutions, I believe my comprehensive skillset aligns perfectly with your strategic vision.

Throughout my tenure at previous enterprises, I spearheaded transformative digital initiatives that increased monthly recurring revenue by 42%. I am deeply passionate about architecting customer-centric roadmaps and leveraging data-driven analytics to maximize operational efficiencies.

I welcome the opportunity to discuss how my unique blend of domain expertise and leadership acumen can contribute significantly to your team's overarching goals.

Sincerely,
Alexander Reed`,

  outreach: `Hi Sarah,

I hope this email finds you well. I wanted to reach out because I came across your company and was impressed by your growth in the SaaS landscape.

We help businesses like yours leverage cutting-edge AI to streamline operations and unlock seamless growth. Our robust platform empowers teams to elevate their productivity and maximize operational velocity.

I would love to schedule a quick 10-minute call this Thursday to discuss how we can help you take your pipeline to the next level. Please don't hesitate to reach out if you have any questions.

Best regards,
Aman`,

  followup: `Hi David,

I am following up on my previous correspondence regarding our enterprise automation capabilities. I recognize you have a demanding schedule, so I wanted to re-surface this in your inbox.

As previously mentioned, our proprietary technology enables high-growth revenue organizations to minimize manual workflows and boost outbound engagement metrics by 3x.

Could you let me know if you have 5 minutes available next week for a brief exploratory discussion?

Thank you for your time and consideration.

Warm regards,
Michael`,
};

// Inbound samples for reply mode: things a prospect might actually send us.
const REPLY_SAMPLES = {
  pricing: `Subject: Re: Getting your firm featured

Hi Aman,

Thanks for reaching out. We're a 12-attorney personal injury firm in Phoenix and honestly we've been burned by PR agencies before. Lots of promises, one article in a site nobody reads.

That said, the AI search angle is interesting. Two questions: what does something like this cost, and how do we know the placements are real outlets and not pay-to-play blogs?

Mark Delgado
Managing Partner, Delgado & Reyes`,

  objection: `Subject: Re: Quick idea for Northgate Wealth

Aman,

Appreciate the detail. We looked at this internally and the number you'd likely land at is more than we've budgeted for marketing this year. We're a small shop and most of our clients come from referrals anyway.

Not a no forever, just not sure it's the right time.

Best,
Priya Raman
Founder, Northgate Wealth Advisors`,

  silent: `On Aug 21, 2026, John Carter <john@abctech.com> wrote:

Hi Aman, thanks for reaching out. We are interested in getting our CEO featured and the AEO side is exactly what our board keeps asking about. I need to discuss this internally with our marketing lead first.

On Aug 21, 2026, Aman wrote:

Sure, no problem John. Let me know once you've discussed it and I can walk you both through how the first 60 days usually look.

On Aug 22, 2026, John Carter <john@abctech.com> wrote:

Will do, should have an answer by end of next week.`,
};

const QUICK_INSTRUCTIONS = [
  "Keep it short",
  "Push for a call",
  "Answer, no pitch",
  "Handle the objection",
  "Follow up gently",
  "Decline politely",
];

const REPLY_MAX_CHARS = 40000;
const HUMANIZE_MAX_CHARS = 12000;

export default function Humanizer({ onLogout }) {
  const [mode, setMode] = useState("reply"); // 'reply' | 'humanize' | 'meeting'
  const [writingStyle, setWritingStyle] = useState("normal"); // 'normal' | 'structured'
  const [showChanges, setShowChanges] = useState(true);
  const [activeVersion, setActiveVersion] = useState(1); // 1 | 2
  const [input, setInput] = useState("");
  const [instruction, setInstruction] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState(null); // humanize: { v1, v2 }  reply/meeting: { subject, body, read, analysis }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const isReply = mode === "reply";
  const isHumanize = mode === "humanize";
  const isMeeting = mode === "meeting";
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;

  const currentOutputText = useMemo(() => {
    if (!result) return "";
    if (isReply || isMeeting) return result.body || "";
    return activeVersion === 1 ? result.v1 : result.v2 || result.v1;
  }, [result, activeVersion, isReply, isMeeting]);

  const outWords = currentOutputText.trim()
    ? currentOutputText.trim().split(/\s+/).length
    : 0;

  // Diff only makes sense in humanize mode (input and output are the same email).
  const diffData = useMemo(() => {
    if (isReply || isMeeting || !showChanges || !currentOutputText) return null;
    return computeDiff(input, currentOutputText);
  }, [isReply, isMeeting, showChanges, input, currentOutputText]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setResult(null);
    setError("");
    setInstruction("");
    setCustomPrompt("");
    setShowAnalysis(false);
  };

  const loadSample = (key) => {
    let sampleText;
    if (isReply) {
      sampleText = REPLY_SAMPLES[key] || REPLY_SAMPLES.pricing;
    } else if (isMeeting) {
      sampleText = MEETING_SAMPLES[key] || MEETING_SAMPLES.sales;
    } else {
      sampleText = SAMPLES[key] || SAMPLES.outreach;
    }
    setInput(sampleText);
    setResult(null);
    setError("");
  };

  const run = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setShowAnalysis(false);
    try {
      if (isReply) {
        const res = await fetch("/.netlify/functions/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input, instruction }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || `Request failed (${res.status})`);
        setResult({
          subject: data.subject || "",
          body: data.body || "",
          read: data.read || "",
        });
      } else if (isMeeting) {
        const res = await fetch("/.netlify/functions/analyze-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: input, customPrompt }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || `Request failed (${res.status})`);
        setResult({
          subject: data.subject || "",
          body: data.body || "",
          read: data.read || "",
          analysis: data.analysis || {},
        });
      } else {
        const intensity = writingStyle === "normal" ? "standard" : "aggressive";
        const res = await fetch("/.netlify/functions/humanize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input, intensity }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error || `Request failed (${res.status})`);

        const v1 = data.humanized || "";
        // Clean, concise variation for version 2
        const v2 = v1
          .split("\n\n")
          .filter((p) => p.trim().length > 0)
          .slice(0, 3)
          .join("\n\n");

        setResult({ v1, v2: v2 || v1 });
      }
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!currentOutputText) return;
    const text =
      (isReply || isMeeting) && result?.subject
        ? `Subject: ${result.subject}\n\n${currentOutputText}`
        : currentOutputText;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      flash("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      flash("Copy failed");
    }
  };

  const clearAll = () => {
    setInput("");
    setResult(null);
    setError("");
  };

  return (
    <div className="humanizer-container">
      {/* Top Navbar */}
      <header className="app-header">
        <div className="header-brand-badge">
          <div className="brand-mark brand-mark-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              width="18"
              height="18"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="brand-titles">
            <div className="brand-name-nav">
              Trustpoint<span className="brand-gold">Xposure</span>
            </div>
            <div className="brand-sub-nav">AI Email & Authority Engine</div>
          </div>
        </div>

        <div className="header-center">
          {/* Mode switch */}
          <div className="writing-style-control">
            <span className="writing-style-label">MODE:</span>
            <div className="style-pills">
              <button
                type="button"
                className={`style-pill ${isReply ? "active" : ""}`}
                onClick={() => switchMode("reply")}
              >
                Write a Reply
              </button>
              <button
                type="button"
                className={`style-pill ${isHumanize ? "active" : ""}`}
                onClick={() => switchMode("humanize")}
              >
                Humanize
              </button>
              <button
                type="button"
                className={`style-pill ${isMeeting ? "active" : ""}`}
                onClick={() => switchMode("meeting")}
              >
                Meeting Transcript
              </button>
            </div>
          </div>

          {/* Writing style only applies to humanize mode */}
          {isHumanize && (
            <div className="writing-style-control">
              <span className="writing-style-label">WRITING STYLE:</span>
              <div className="style-pills">
                <button
                  type="button"
                  className={`style-pill ${writingStyle === "normal" ? "active" : ""}`}
                  onClick={() => setWritingStyle("normal")}
                >
                  Normal Flow
                </button>
                <button
                  type="button"
                  className={`style-pill ${writingStyle === "structured" ? "active" : ""}`}
                  onClick={() => setWritingStyle("structured")}
                >
                  Clear & Structured
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="header-right">
          <button type="button" className="btn-logout" onClick={onLogout}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-pill-badge">
          <span className="sparkle-icon">✦</span>
          <span>
            {isReply
              ? "AI OUTREACH ASSISTANT · KNOWS YOUR COMPANY"
              : isMeeting
                ? "MEETING ANALYZER · FOLLOW-UP GENERATOR"
                : "THE #1 AI CERTIFIED HUMANIZER ENGINE"}
          </span>
        </div>

        {isReply ? (
          <>
            <h1 className="hero-heading">
              Paste The Conversation. Get{" "}
              <span className="hero-highlight">The Right Reply</span>
            </h1>
            <p className="hero-subheading">
              Drop in any email or full thread. The assistant reads every
              message, knows what your company does, and writes the reply an
              experienced appointment setter would send. No placeholders, no
              re-explaining your business.
            </p>
          </>
        ) : isMeeting ? (
          <>
            <h1 className="hero-heading">
              Analyze Calls. Generate{" "}
              <span className="hero-highlight">Personalized Follow-ups</span>
            </h1>
            <p className="hero-subheading">
              Paste your meeting transcript. The agent analyzes lead behavior,
              pain points, goals, and mission, then writes a humanized follow-up
              email. Add optional custom instructions to emphasize specific
              points or calls-to-action.
            </p>
          </>
        ) : (
          <>
            <h1 className="hero-heading">
              Extract Natural Human Tone With{" "}
              <span className="hero-highlight">AI Authority</span>
            </h1>
            <p className="hero-subheading">
              Transform robotic AI drafts into natural, human-written cold
              emails and messages. Eliminate robotic jargon, improve reply
              rates, and bypass strict spam filters.
            </p>
          </>
        )}

        <div className="quick-samples-bar">
          <span className="quick-samples-label">QUICK SAMPLES:</span>
          <div className="sample-buttons">
            {isReply ? (
              <>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("pricing")}
                >
                  <span className="sample-icon">💰</span>
                  <span>Pricing Question</span>
                  <span className="sample-arrow">→</span>
                </button>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("objection")}
                >
                  <span className="sample-icon">🛑</span>
                  <span>Budget Objection</span>
                  <span className="sample-arrow">→</span>
                </button>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("silent")}
                >
                  <span className="sample-icon">🧵</span>
                  <span>Thread Went Quiet</span>
                  <span className="sample-arrow">→</span>
                </button>
              </>
            ) : isMeeting ? (
              <>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("sales")}
                >
                  <span className="sample-icon">🎯</span>
                  <span>Sales Prospect Call</span>
                  <span className="sample-arrow">→</span>
                </button>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("legal")}
                >
                  <span className="sample-icon">⚖️</span>
                  <span>Legal Firm Call</span>
                  <span className="sample-arrow">→</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("job")}
                >
                  <span className="sample-icon">💼</span>
                  <span>Job Application</span>
                  <span className="sample-arrow">→</span>
                </button>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("outreach")}
                >
                  <span className="sample-icon">🚀</span>
                  <span>Cold Outreach</span>
                  <span className="sample-arrow">→</span>
                </button>
                <button
                  type="button"
                  className="sample-btn"
                  onClick={() => loadSample("followup")}
                >
                  <span className="sample-icon">📧</span>
                  <span>Follow-up</span>
                  <span className="sample-arrow">→</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Two-Column Workspace */}
      <main className="workspace-main">
        {/* Left Column: Input */}
        <section className="editor-card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="status-dot dot-blue" />
              <h2 className="card-title">
                {isReply
                  ? "Their Email / Conversation"
                  : isMeeting
                    ? "Meeting Transcript"
                    : "Original Text (AI Draft)"}
              </h2>
            </div>
            <button
              type="button"
              className="action-link-btn"
              onClick={() =>
                loadSample(
                  isReply ? "pricing" : isMeeting ? "sales" : "outreach",
                )
              }
            >
              Load sample
            </button>
          </div>

          <div className="card-body">
            <textarea
              className="editor-textarea"
              placeholder={
                isReply
                  ? "Paste the email you received, or the whole thread. Oldest message first works best..."
                  : isMeeting
                    ? "Paste your meeting transcript here. Include both speakers for best analysis..."
                    : "Paste your AI-generated email or draft here to humanize..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              maxLength={
                isReply
                  ? REPLY_MAX_CHARS
                  : isMeeting
                    ? 50000
                    : HUMANIZE_MAX_CHARS
              }
            />

            {isReply && (
              <div className="reply-instruction-block">
                <input
                  type="text"
                  className="reply-instruction-input"
                  placeholder="Optional: how should the reply go? e.g. push for a call, keep it under 60 words"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  maxLength={500}
                />
                <div className="reply-quick-chips">
                  {QUICK_INSTRUCTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`reply-chip ${instruction === q ? "active" : ""}`}
                      onClick={() => setInstruction(instruction === q ? "" : q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isMeeting && (
              <div className="reply-instruction-block">
                <input
                  type="text"
                  className="reply-instruction-input"
                  placeholder="Optional: custom instructions for the email (e.g., mention our API, include calendar link, reference pricing)"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  maxLength={500}
                />
              </div>
            )}
          </div>

          <div className="card-footer">
            <div className="footer-meta-left">
              <div className="word-count-line">
                Words: <strong>{words.toLocaleString()}</strong> /{" "}
                {isReply ? "8,000" : isMeeting ? "10,000" : "3,000"}
              </div>
              <div className="sub-meta-line">
                {isReply
                  ? "Reads the full thread. Company details are built in."
                  : isMeeting
                    ? "Analyzes lead behavior, pain points, goals. Generates humanized follow-up."
                    : "Bypasses GPTZero, Turnitin & CopyLeaks"}
              </div>
            </div>
            <div className="footer-actions-right">
              {input && (
                <button type="button" className="btn-clear" onClick={clearAll}>
                  Clear
                </button>
              )}
              <button
                type="button"
                className="btn-primary-action"
                onClick={run}
                disabled={busy || !input.trim()}
              >
                {busy ? (
                  <>
                    <span className="spin" />
                    <span>
                      {isReply
                        ? "Writing reply..."
                        : isMeeting
                          ? "Analyzing & generating..."
                          : "Humanizing..."}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="btn-icon">✦</span>
                    <span>
                      {isReply
                        ? "Write a Reply"
                        : isMeeting
                          ? "Analyze & Generate"
                          : "Humanize With AI"}
                    </span>
                    <span className="btn-arrow">→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Output */}
        <section className="editor-card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="status-dot dot-green" />
              <h2 className="card-title">
                {isReply
                  ? "Your Reply"
                  : isMeeting
                    ? "Follow-up Email"
                    : "Humanized Result"}
              </h2>
            </div>
            {!isReply && !isMeeting && (
              <div className="header-toggle-group">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showChanges}
                    onChange={(e) => setShowChanges(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
                <span className="toggle-label">Show changes</span>
              </div>
            )}
            {isMeeting && result?.analysis && (
              <div className="header-toggle-group">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showAnalysis}
                    onChange={(e) => setShowAnalysis(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
                <span className="toggle-label">Show analysis</span>
              </div>
            )}
          </div>

          {!isReply && (
            <div className="version-tabs-bar">
              <button
                type="button"
                className={`version-tab ${activeVersion === 1 ? "active" : ""}`}
                onClick={() => setActiveVersion(1)}
              >
                <span>Version 1</span>
                <span className="best-pick-badge">★ BEST PICK</span>
              </button>
              <button
                type="button"
                className={`version-tab ${activeVersion === 2 ? "active" : ""}`}
                onClick={() => setActiveVersion(2)}
              >
                <span>Version 2 (Concise)</span>
              </button>
            </div>
          )}

          <div className="card-body">
            {error ? (
              <div className="output-error-state">{error}</div>
            ) : currentOutputText ? (
              <div className="humanized-output-content">
                {(isReply || isMeeting) && result?.read && (
                  <div
                    className="reply-read-note"
                    title="For your eyes only. Not part of the email."
                  >
                    {result.read}
                  </div>
                )}
                {(isReply || isMeeting) && result?.subject && (
                  <div className="reply-subject-line">
                    <span className="reply-subject-label">Subject</span>
                    <span className="reply-subject-text">{result.subject}</span>
                  </div>
                )}

                {isMeeting && showAnalysis && result?.analysis ? (
                  <div className="meeting-analysis-block">
                    <div className="analysis-section">
                      <h4>Lead Behavior</h4>
                      <p>{result.analysis.behavior || "—"}</p>
                    </div>
                    {result.analysis.painPoints &&
                      result.analysis.painPoints.length > 0 && (
                        <div className="analysis-section">
                          <h4>Pain Points</h4>
                          <ul>
                            {result.analysis.painPoints.map((pp, idx) => (
                              <li key={idx}>{pp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {result.analysis.goals &&
                      result.analysis.goals.length > 0 && (
                        <div className="analysis-section">
                          <h4>Goals</h4>
                          <ul>
                            {result.analysis.goals.map((g, idx) => (
                              <li key={idx}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {result.analysis.missionValues && (
                      <div className="analysis-section">
                        <h4>Mission & Values</h4>
                        <p>{result.analysis.missionValues}</p>
                      </div>
                    )}
                    <div className="analysis-divider" />
                    <div className="plain-output-text">{currentOutputText}</div>
                  </div>
                ) : !isReply &&
                  !isMeeting &&
                  showChanges &&
                  diffData?.segments ? (
                  <div className="diff-rendered-text">
                    {diffData.segments.map((seg, idx) => {
                      if (seg.isSpace) {
                        return <span key={idx}>{seg.text}</span>;
                      }
                      if (seg.isChange) {
                        return (
                          <span
                            key={idx}
                            className="diff-changed-word"
                            title="Modified for natural cadence"
                          >
                            {seg.text}
                          </span>
                        );
                      }
                      return <span key={idx}>{seg.text}</span>;
                    })}
                  </div>
                ) : (
                  <div className="plain-output-text">{currentOutputText}</div>
                )}
              </div>
            ) : (
              <div className="output-empty-state">
                <div className="empty-icon">
                  {isReply ? "💬" : isMeeting ? "📞" : "✍️"}
                </div>
                <h3 className="empty-title">
                  {isReply
                    ? "Your reply will appear here"
                    : isMeeting
                      ? "Your follow-up email will appear here"
                      : "Your rewritten email will appear here"}
                </h3>
                <p className="empty-subtitle">
                  {isReply
                    ? 'Paste a conversation and click "Write a Reply". The assistant replies to the latest message using the whole thread as context.'
                    : isMeeting
                      ? 'Paste a meeting transcript and click "Analyze & Generate". The assistant extracts lead insights and writes a personalized follow-up.'
                      : 'Click "Humanize With AI" to generate natural high-converting copy.'}
                </p>
              </div>
            )}
          </div>

          <div className="card-footer">
            <div className="footer-meta-left">
              <div className="result-words-line">
                Result Words: <strong>{outWords}</strong>
              </div>
            </div>
            <div className="footer-actions-right">
              {(isReply || isMeeting) && currentOutputText && (
                <button
                  type="button"
                  className="btn-clear"
                  onClick={run}
                  disabled={busy}
                >
                  Regenerate
                </button>
              )}
              <button
                type="button"
                className="btn-copy-result"
                onClick={copy}
                disabled={!currentOutputText}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>
                  {copied
                    ? "Copied!"
                    : isReply
                      ? "Copy Reply"
                      : isMeeting
                        ? "Copy Email"
                        : "Copy Result"}
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {toast && <div className="glass toast">{toast}</div>}
    </div>
  );
}
