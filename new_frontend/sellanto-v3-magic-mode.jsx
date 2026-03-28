import { useState, useEffect, useRef, useCallback } from "react";

/*
 * SELLANTO MAGIC MODE — V3
 * Flow: Mode Select → URL → AI Questions (MCQ chat) → AI Working → 2 Posts → Feedback → Generate More
 */

// ═══════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

*{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}

@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes popIn{0%{opacity:0;transform:scale(.8)}60%{transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(232,54,79,.15)}50%{box-shadow:0 0 40px rgba(232,54,79,.35)}}
@keyframes typewriter{from{width:0}to{width:100%}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes confettiDrop{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(30px) rotate(360deg);opacity:0}}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes ripple{0%{transform:scale(0);opacity:.4}100%{transform:scale(3);opacity:0}}
@keyframes orbFloat1{0%,100%{transform:translate(0,0)}25%{transform:translate(30px,-20px)}50%{transform:translate(-10px,-40px)}75%{transform:translate(-30px,-10px)}}
@keyframes orbFloat2{0%,100%{transform:translate(0,0)}25%{transform:translate(-20px,30px)}50%{transform:translate(20px,10px)}75%{transform:translate(10px,-20px)}}

.au{animation:fadeUp .5s ease both}
.au1{animation:fadeUp .5s ease .08s both}
.au2{animation:fadeUp .5s ease .16s both}
.au3{animation:fadeUp .5s ease .24s both}
.au4{animation:fadeUp .5s ease .32s both}
.au5{animation:fadeUp .5s ease .40s both}
.pop{animation:popIn .4s ease both}
.slide-up{animation:slideUp .6s cubic-bezier(.16,1,.3,1) both}

.bg-main{background:#09091A}
.bg-card{background:#111128}
.bg-elevated{background:#16163A}

.text-w{color:#F4F4FA}
.text-s{color:#9CA3AF}
.text-m{color:#5C6370}

.font{font-family:'Outfit',sans-serif}
`;

// ═══════════════════════════════════════════
// THEME HELPERS
// ═══════════════════════════════════════════
const c = {
  bg: "#09091A", card: "#111128", cardHover: "#161640", elevated: "#16163A",
  coral: "#E8364F", coralLight: "#FF6B81", coralBg: "rgba(232,54,79,.1)", coralBorder: "rgba(232,54,79,.3)",
  green: "#10B981", greenBg: "rgba(16,185,129,.1)", greenBorder: "rgba(16,185,129,.3)",
  blue: "#3B82F6", blueBg: "rgba(59,130,246,.08)", blueBorder: "rgba(59,130,246,.2)",
  amber: "#F59E0B", amberBg: "rgba(245,158,11,.08)",
  purple: "#8B5CF6", purpleBg: "rgba(139,92,246,.08)",
  border: "rgba(255,255,255,.06)", borderHover: "rgba(255,255,255,.12)",
  w: "#F4F4FA", s: "#9CA3AF", m: "#5C6370", d: "#2D2D4A",
};

const card = (extra = {}) => ({
  background: c.card, border: `1px solid ${c.border}`, borderRadius: 20, padding: 24, ...extra,
});

const btn = (type = "main", extra = {}) => {
  const base = { border: "none", fontFamily: "'Outfit',sans-serif", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 14, fontSize: 15, transition: "all .2s ease", letterSpacing: "-.01em" };
  if (type === "main") return { ...base, background: `linear-gradient(135deg,${c.coral},${c.coralLight})`, color: "#fff", padding: "14px 28px", boxShadow: `0 4px 20px rgba(232,54,79,.3)`, ...extra };
  if (type === "soft") return { ...base, background: "rgba(255,255,255,.06)", color: c.w, padding: "12px 22px", border: `1px solid ${c.border}`, ...extra };
  if (type === "ghost") return { ...base, background: "transparent", color: c.s, padding: "10px 16px", fontSize: 14, ...extra };
  return { ...base, ...extra };
};

// ═══════════════════════════════════════════
// SCREEN: MODE SELECT
// ═══════════════════════════════════════════
function ModeSelect({ onMagic, onManual }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", overflow: "hidden" }}>
      {/* Floating orbs */}
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,54,79,.08), transparent 70%)", top: "10%", left: "10%", animation: "orbFloat1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,.06), transparent 70%)", bottom: "5%", right: "10%", animation: "orbFloat2 15s ease-in-out infinite", pointerEvents: "none" }} />

      <div style={{ maxWidth: 640, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div className="au" style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg,${c.coral},${c.coralLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff" }}>S</div>
          <span style={{ fontSize: 26, fontWeight: 900, color: c.w, letterSpacing: "-.5px" }}>Sellanto</span>
        </div>

        <h1 className="au1" style={{ fontSize: 36, fontWeight: 900, color: c.w, lineHeight: 1.2, marginBottom: 12, letterSpacing: "-.5px" }}>
          How would you like to get started?
        </h1>
        <p className="au2" style={{ fontSize: 17, color: c.s, lineHeight: 1.7, marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
          Pick your style. You can always switch later.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Magic Mode */}
          <div
            className="au3"
            onClick={onMagic}
            style={{
              ...card({ padding: 32, cursor: "pointer", transition: "all .25s ease", position: "relative", overflow: "hidden" }),
              borderColor: c.coralBorder,
              background: `linear-gradient(135deg, rgba(232,54,79,.06), ${c.card})`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 48px rgba(232,54,79,.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ fontSize: 52, marginBottom: 16, animation: "float 3s ease-in-out infinite" }}>✨</div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", color: c.coral, marginBottom: 8, textTransform: "uppercase" }}>Recommended</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: c.w, marginBottom: 8 }}>Magic Mode</h3>
            <p style={{ fontSize: 14, color: c.s, lineHeight: 1.7 }}>
              Just paste your website. Answer a few quick questions. AI creates everything — ready to publish in minutes.
            </p>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
              {["Paste website → AI learns your brand", "Answer 5 quick questions", "Get 2 ready-to-publish posts", "Approve, edit, or ask for changes"].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.s }}>
                  <span style={{ color: c.green }}>✓</span> {t}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <span style={{ ...btn("main", { fontSize: 14, padding: "12px 24px" }) }}>
                Start Magic Mode →
              </span>
            </div>
          </div>

          {/* Manual Mode */}
          <div
            className="au4"
            onClick={onManual}
            style={{ ...card({ padding: 32, cursor: "pointer", transition: "all .25s ease" }) }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 48px rgba(0,0,0,.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ fontSize: 52, marginBottom: 16 }}>🛠️</div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", color: c.m, marginBottom: 8, textTransform: "uppercase" }}>Advanced</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: c.w, marginBottom: 8 }}>Manual Setup</h3>
            <p style={{ fontSize: 14, color: c.s, lineHeight: 1.7 }}>
              Full control over every step — brand profile, content pillars, topics, ideas, captions, images, scheduling.
            </p>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
              {["Configure each step yourself", "Fine-tune AI at every stage", "Best for agencies & power users", "6-step guided workflow"].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: c.m }}>
                  <span style={{ color: c.m }}>→</span> {t}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <span style={{ ...btn("soft", { fontSize: 14, padding: "12px 24px" }) }}>
                Open Manual Setup
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: URL INPUT
// ═══════════════════════════════════════════
function URLInput({ onSubmit }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleGo = () => {
    if (!url.trim()) return;
    setLoading(true);
    setTimeout(() => onSubmit(url), 1800);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <div className="au" style={{ fontSize: 56, marginBottom: 20, animation: "float 3s ease-in-out infinite" }}>🌐</div>
        <h1 className="au1" style={{ fontSize: 32, fontWeight: 900, color: c.w, marginBottom: 10, letterSpacing: "-.5px" }}>
          What's your website?
        </h1>
        <p className="au2" style={{ fontSize: 16, color: c.s, lineHeight: 1.7, marginBottom: 32, maxWidth: 420, margin: "0 auto 32px" }}>
          Paste your website URL below. Our AI will visit it, understand your brand, style, and what you do — then create content that sounds like you.
        </p>

        <div className="au3" style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
          <input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGo()}
            placeholder="https://yourbusiness.com"
            disabled={loading}
            style={{
              width: "100%", padding: "18px 140px 18px 22px", borderRadius: 18,
              background: "rgba(255,255,255,.04)", border: `2px solid ${url ? c.coralBorder : c.border}`,
              color: c.w, fontSize: 17, fontFamily: "'Outfit',sans-serif", outline: "none",
              transition: "border-color .2s ease",
            }}
          />
          <button
            onClick={handleGo}
            disabled={!url.trim() || loading}
            style={{
              ...btn("main", { position: "absolute", right: 6, top: 6, bottom: 6, padding: "0 24px", borderRadius: 14 }),
              opacity: url.trim() ? 1 : .4,
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .6s linear infinite", display: "inline-block" }} />
                Analyzing...
              </span>
            ) : "Analyze →"}
          </button>
        </div>

        {loading && (
          <div className="pop" style={{ marginTop: 24 }}>
            <p style={{ fontSize: 14, color: c.s }}>🔍 Reading your website and learning about your brand...</p>
          </div>
        )}

        <p className="au4" style={{ fontSize: 13, color: c.m, marginTop: 20 }}>
          Don't have a website? No problem — <span style={{ color: c.coral, cursor: "pointer", fontWeight: 600 }}>answer questions instead</span>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: AI QUESTIONS (Chat-like MCQ)
// ═══════════════════════════════════════════
const ALL_QUESTIONS = [
  {
    id: "industry",
    emoji: "🏢",
    question: "What best describes your business?",
    subtext: "This helps us pick the right content style",
    options: ["Digital Marketing Agency", "E-commerce / Online Store", "SaaS / Software Company", "Local Service Business", "Consulting / Freelancing", "Other"],
  },
  {
    id: "goal",
    emoji: "🎯",
    question: "What's your main goal with social media?",
    subtext: "We'll focus your content around this",
    options: ["Get more customers / leads", "Build brand awareness", "Drive website traffic", "Establish thought leadership", "Showcase products / services"],
  },
  {
    id: "tone",
    emoji: "🗣️",
    question: "How should your posts sound?",
    subtext: "Pick the vibe that matches your brand",
    options: ["Professional & authoritative", "Friendly & approachable", "Bold & provocative", "Educational & helpful", "Fun & casual"],
  },
  {
    id: "platforms",
    emoji: "📱",
    question: "Where do you post most? (pick 1-2)",
    subtext: "We'll optimize content for these platforms",
    options: ["LinkedIn", "Instagram", "Facebook", "Twitter / X", "TikTok"],
    multi: true,
  },
  {
    id: "colors",
    emoji: "🎨",
    question: "What colors represent your brand?",
    subtext: "We'll use these in your image designs",
    options: ["Blue tones (trust, professional)", "Red/Orange (energy, bold)", "Green (growth, nature)", "Purple (creative, premium)", "Dark/Minimal (sleek, modern)", "Use colors from my website"],
  },
];

function AIQuestions({ onComplete }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [multiSel, setMultiSel] = useState(new Set());
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef(null);

  const q = ALL_QUESTIONS[currentQ];
  const isLast = currentQ === ALL_QUESTIONS.length - 1;
  const progress = ((currentQ) / ALL_QUESTIONS.length) * 100;

  const select = (opt) => {
    if (q.multi) {
      const next = new Set(multiSel);
      next.has(opt) ? next.delete(opt) : next.add(opt);
      setMultiSel(next);
      return;
    }
    setAnimating(true);
    setAnswers(prev => ({ ...prev, [q.id]: opt }));
    setTimeout(() => {
      if (isLast) { onComplete({ ...answers, [q.id]: opt }); }
      else { setCurrentQ(c => c + 1); setAnimating(false); }
    }, 400);
  };

  const confirmMulti = () => {
    if (multiSel.size === 0) return;
    setAnimating(true);
    setAnswers(prev => ({ ...prev, [q.id]: [...multiSel] }));
    setTimeout(() => {
      if (isLast) onComplete({ ...answers, [q.id]: [...multiSel] });
      else { setCurrentQ(c => c + 1); setMultiSel(new Set()); setAnimating(false); }
    }, 400);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "40px 40px 20px" }}>
      {/* Progress */}
      <div style={{ maxWidth: 560, width: "100%", margin: "0 auto", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.s }}>Question {currentQ + 1} of {ALL_QUESTIONS.length}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.coral }}>{Math.round(progress)}% done</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${c.coral}, ${c.coralLight})`, borderRadius: 3, transition: "width .5s ease" }} />
        </div>
      </div>

      {/* Question Area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div key={currentQ} className="slide-up" style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{q.emoji}</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: c.w, marginBottom: 8, letterSpacing: "-.3px" }}>
            {q.question}
          </h2>
          <p style={{ fontSize: 15, color: c.s, marginBottom: 28 }}>{q.subtext}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 440, margin: "0 auto" }}>
            {q.options.map((opt, i) => {
              const isSelected = q.multi ? multiSel.has(opt) : answers[q.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => select(opt)}
                  className={`au${Math.min(i + 1, 5)}`}
                  style={{
                    width: "100%", padding: "16px 22px", borderRadius: 16, fontSize: 15, fontWeight: 600,
                    fontFamily: "'Outfit',sans-serif", cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 12,
                    background: isSelected ? c.coralBg : "rgba(255,255,255,.03)",
                    border: `2px solid ${isSelected ? c.coralBorder : c.border}`,
                    color: isSelected ? c.coral : c.w,
                    transition: "all .2s ease",
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = c.borderHover; e.currentTarget.style.background = "rgba(255,255,255,.05)"; } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = "rgba(255,255,255,.03)"; } }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: q.multi ? 7 : 12, flexShrink: 0,
                    border: `2px solid ${isSelected ? c.coral : "rgba(255,255,255,.15)"}`,
                    background: isSelected ? c.coral : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s ease", fontSize: 12, color: "#fff", fontWeight: 800,
                  }}>
                    {isSelected && "✓"}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {q.multi && (
            <div style={{ marginTop: 18 }}>
              <button onClick={confirmMulti} disabled={multiSel.size === 0} style={{ ...btn("main", { opacity: multiSel.size === 0 ? .4 : 1 }) }}>
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Back */}
      {currentQ > 0 && (
        <div style={{ textAlign: "center", paddingBottom: 20 }}>
          <button onClick={() => { setCurrentQ(c => c - 1); setMultiSel(new Set()); }} style={btn("ghost")}>
            ← Previous question
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: AI WORKING
// ═══════════════════════════════════════════
function AIWorking({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    { emoji: "🌐", label: "Reading your website", desc: "Understanding your brand identity..." },
    { emoji: "🧠", label: "Building your brand profile", desc: "Analyzing tone, audience, and services..." },
    { emoji: "📈", label: "Finding trending topics", desc: "Scanning what's hot in your industry..." },
    { emoji: "💡", label: "Generating content ideas", desc: "Crafting ideas that match your brand..." },
    { emoji: "✍️", label: "Writing captions", desc: "Creating engaging text for each post..." },
    { emoji: "🎨", label: "Designing images", desc: "Building visuals with your brand colors..." },
    { emoji: "✅", label: "Final polish", desc: "Making sure everything looks perfect..." },
  ];

  useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => {
        setStep(i);
        if (i === steps.length - 1) setTimeout(onDone, 1200);
      }, i * 1400)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", overflow: "hidden" }}>
      {/* Ambient bg */}
      <div style={{
        position: "absolute", inset: 0, opacity: .5,
        background: `radial-gradient(ellipse at 50% 30%, rgba(232,54,79,.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(59,130,246,.06) 0%, transparent 50%)`,
      }} />

      <div style={{ maxWidth: 500, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Main emoji */}
        <div style={{ fontSize: 64, marginBottom: 24 }} className="pop" key={step}>
          {steps[step].emoji}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, color: c.w, marginBottom: 6 }} className="pop" key={`t${step}`}>
          {steps[step].label}
        </h2>
        <p style={{ fontSize: 15, color: c.s, marginBottom: 28 }} className="pop" key={`d${step}`}>
          {steps[step].desc}
        </p>

        {/* Progress bar */}
        <div style={{ height: 8, background: "rgba(255,255,255,.06)", borderRadius: 4, overflow: "hidden", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
          <div style={{
            height: "100%", borderRadius: 4, transition: "width .6s ease",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${c.coral}, ${c.purple}, ${c.blue})`,
            backgroundSize: "300% 100%", animation: "gradientShift 3s ease infinite",
          }} />
        </div>

        {/* Step list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left", maxWidth: 340, margin: "0 auto" }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10,
              background: i === step ? "rgba(232,54,79,.06)" : "transparent",
              transition: "all .3s ease",
            }}>
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>
                {i < step ? "✅" : i === step ? (
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(232,54,79,.5)", borderTopColor: c.coral, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                ) : "○"}
              </span>
              <span style={{
                fontSize: 13, fontWeight: i <= step ? 600 : 400,
                color: i < step ? c.green : i === step ? c.w : c.m,
              }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCREEN: RESULTS — Ready to publish posts
// ═══════════════════════════════════════════
function Results({ onGenerateMore }) {
  const [posts, setPosts] = useState([
    {
      id: 1,
      title: "AI-Powered SEO: The $47K Revenue Story",
      caption: "This small business owner was skeptical about AI-powered SEO tools — until we showed her the numbers. 📊\n\nAfter just 3 months:\n→ 47% increase in organic traffic\n→ $47K in additional revenue\n→ 3x more qualified leads\n\nThe secret? Using AI to find keyword opportunities that manual research misses entirely.\n\nHere's the exact framework we used (save this):\n\n1. AI-powered keyword gap analysis\n2. Automated content optimization\n3. Smart internal linking suggestions\n4. Real-time ranking monitoring\n\nStop burning budget on manual SEO. Start working smarter.\n\n#SEO #DigitalMarketing #AI #SmallBusiness #GrowthHacking",
      platform: "LinkedIn",
      overlay: "From Skeptic to $47K Revenue",
      imageStyle: "Modern, professional blue gradient with data visualization elements",
      status: "ready", // ready | approved | feedback
      feedback: null,
    },
    {
      id: 2,
      title: "5 Marketing Budget Mistakes in 2026",
      caption: "83% of businesses are sabotaging their own recovery by cutting marketing budgets the WRONG way. 🚫\n\nHere are the 5 biggest budget mistakes we're seeing in 2026:\n\n❌ Cutting all paid ads instead of optimizing ROAS\n❌ Pausing SEO (your competitors won't)\n❌ Ignoring content marketing ROI data\n❌ Reducing frequency instead of improving quality\n❌ Not tracking attribution properly\n\nThe businesses winning right now? They're not spending MORE — they're spending SMARTER.\n\nDM us 'BUDGET' for our free marketing budget audit template.\n\n#Marketing #Business #ROI #Strategy #Budgeting2026",
      platform: "Instagram",
      overlay: "Stop Cutting — Start Optimizing",
      imageStyle: "Vibrant, bold red/orange with striking typography",
      status: "ready",
      feedback: null,
    },
  ]);

  const [feedbackPost, setFeedbackPost] = useState(null);
  const [feedbackStep, setFeedbackStep] = useState(0);
  const [feedbackAnswers, setFeedbackAnswers] = useState({});
  const [showMoreOption, setShowMoreOption] = useState(false);
  const [postCount, setPostCount] = useState(2);

  const allApproved = posts.every(p => p.status === "approved");

  useEffect(() => {
    if (allApproved && !showMoreOption) {
      setTimeout(() => setShowMoreOption(true), 600);
    }
  }, [allApproved]);

  const approvePost = (id) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: "approved" } : p));
  };

  const startFeedback = (id) => {
    setFeedbackPost(id);
    setFeedbackStep(0);
    setFeedbackAnswers({});
  };

  const feedbackQs = [
    {
      id: "what", emoji: "🤔", question: "What would you like to change?",
      options: ["The caption / text", "The image style", "The overall topic", "The brand colors", "The tone of voice", "Something else"],
    },
    {
      id: "caption_fix", emoji: "✍️", question: "What about the caption needs work?",
      condition: (a) => a.what === "The caption / text",
      options: ["Too long — make it shorter", "Too short — add more detail", "Wrong tone — make it more professional", "Wrong tone — make it more casual", "Different angle / hook", "Change the call-to-action"],
    },
    {
      id: "image_fix", emoji: "🎨", question: "What about the image should change?",
      condition: (a) => a.what === "The image style",
      options: ["Different colors", "More minimal / clean", "More bold / eye-catching", "Different layout", "Change the text on the image", "Completely different concept"],
    },
    {
      id: "tone_fix", emoji: "🗣️", question: "What tone would you prefer?",
      condition: (a) => a.what === "The tone of voice",
      options: ["More professional / formal", "More friendly / approachable", "More bold / provocative", "More educational / helpful", "More casual / fun"],
    },
    {
      id: "topic_fix", emoji: "💡", question: "What kind of topic would you prefer?",
      condition: (a) => a.what === "The overall topic",
      options: ["Success story / case study", "How-to / tutorial", "Industry news / trends", "Tips & tricks list", "Behind the scenes", "Myth-busting / contrarian"],
    },
  ];

  const getNextFeedbackQ = () => {
    for (let i = feedbackStep + 1; i < feedbackQs.length; i++) {
      const q = feedbackQs[i];
      if (!q.condition || q.condition(feedbackAnswers)) return i;
    }
    return -1;
  };

  const answerFeedback = (opt) => {
    const q = feedbackQs[feedbackStep];
    const newAnswers = { ...feedbackAnswers, [q.id]: opt };
    setFeedbackAnswers(newAnswers);
    const nextIdx = (() => {
      for (let i = feedbackStep + 1; i < feedbackQs.length; i++) {
        if (!feedbackQs[i].condition || feedbackQs[i].condition(newAnswers)) return i;
      }
      return -1;
    })();
    if (nextIdx === -1) {
      setPosts(prev => prev.map(p => p.id === feedbackPost ? { ...p, feedback: newAnswers, status: "ready" } : p));
      setFeedbackPost(null);
    } else {
      setFeedbackStep(nextIdx);
    }
  };

  const platformEmoji = { LinkedIn: "💼", Instagram: "📸", Twitter: "🐦", Facebook: "📘" };

  return (
    <div style={{ minHeight: "100vh", padding: "40px 40px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div className="au" style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }} className="pop">🎉</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: c.w, marginBottom: 8, letterSpacing: "-.5px" }}>
            Your posts are ready!
          </h1>
          <p style={{ fontSize: 16, color: c.s, lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
            Here are {posts.length} ready-to-publish posts. Review each one — approve it, or tell us what to change.
          </p>
        </div>

        {/* Feedback Modal */}
        {feedbackPost && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
          }}>
            <div className="pop" style={{ ...card({ padding: 36, maxWidth: 520, width: "100%" }), background: c.elevated }}>
              {(() => {
                const q = feedbackQs[feedbackStep];
                return (
                  <div key={feedbackStep} className="slide-up">
                    <div style={{ fontSize: 40, textAlign: "center", marginBottom: 14 }}>{q.emoji}</div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: c.w, textAlign: "center", marginBottom: 6 }}>{q.question}</h3>
                    <p style={{ fontSize: 14, color: c.s, textAlign: "center", marginBottom: 24 }}>
                      Pick one and we'll regenerate this post for you.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {q.options.map((opt, i) => (
                        <button
                          key={opt}
                          onClick={() => answerFeedback(opt)}
                          style={{
                            width: "100%", padding: "14px 20px", borderRadius: 14, fontSize: 15,
                            fontWeight: 600, fontFamily: "'Outfit',sans-serif", cursor: "pointer",
                            background: "rgba(255,255,255,.03)", border: `2px solid ${c.border}`,
                            color: c.w, textAlign: "left", transition: "all .2s ease",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = c.coralBorder; e.currentTarget.style.background = c.coralBg; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div style={{ textAlign: "center", marginTop: 16 }}>
                      <button onClick={() => setFeedbackPost(null)} style={btn("ghost", { color: c.m })}>
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Post Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
          {posts.map((post, idx) => (
            <div
              key={post.id}
              className={`au${Math.min(idx + 1, 5)}`}
              style={{
                ...card({ padding: 0, overflow: "hidden" }),
                borderColor: post.status === "approved" ? c.greenBorder : undefined,
              }}
            >
              {/* Post Header */}
              <div style={{
                padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: `1px solid ${c.border}`,
                background: post.status === "approved" ? "rgba(16,185,129,.04)" : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c.s }}>Post {idx + 1}</span>
                  <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: c.blueBg, color: c.blue }}>
                    {platformEmoji[post.platform]} {post.platform}
                  </span>
                </div>
                {post.status === "approved" && (
                  <span className="pop" style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: c.greenBg, color: c.green }}>
                    ✓ Approved
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 300 }}>
                {/* Image Preview */}
                <div style={{
                  background: `linear-gradient(135deg, #1A1A3E, #2A1A4E, #1A2A4E)`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: 24, borderRight: `1px solid ${c.border}`, position: "relative",
                }}>
                  <div style={{
                    position: "absolute", top: 12, left: 12, padding: "4px 10px", borderRadius: 8,
                    background: "rgba(0,0,0,.5)", backdropFilter: "blur(8px)",
                    fontSize: 10, fontWeight: 700, color: c.s,
                  }}>AI GENERATED IMAGE</div>
                  <div style={{ fontSize: 40, marginBottom: 12, opacity: .6 }}>🖼️</div>
                  <div style={{
                    padding: "10px 20px", borderRadius: 10,
                    background: "rgba(255,255,255,.08)", backdropFilter: "blur(4px)",
                    fontSize: 16, fontWeight: 800, color: c.w, textAlign: "center",
                    letterSpacing: "-.3px",
                  }}>
                    {post.overlay}
                  </div>
                  <div style={{ fontSize: 11, color: c.m, marginTop: 12, textAlign: "center", lineHeight: 1.5, maxWidth: 220 }}>
                    {post.imageStyle}
                  </div>
                </div>

                {/* Caption */}
                <div style={{ padding: 20, display: "flex", flexDirection: "column" }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: c.w }}>{post.title}</h4>
                  <div style={{
                    flex: 1, fontSize: 13, color: c.s, lineHeight: 1.7, overflow: "auto",
                    maxHeight: 220, whiteSpace: "pre-line",
                  }}>
                    {post.caption}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{
                padding: "14px 24px", borderTop: `1px solid ${c.border}`,
                display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end",
                background: "rgba(255,255,255,.01)",
              }}>
                {post.status !== "approved" ? (
                  <>
                    <button onClick={() => startFeedback(post.id)} style={btn("soft", { padding: "10px 20px", fontSize: 13, borderRadius: 12 })}>
                      💬 Give feedback
                    </button>
                    <button onClick={() => approvePost(post.id)} style={btn("main", { padding: "10px 22px", fontSize: 13, borderRadius: 12 })}>
                      ✓ Approve this post
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btn("soft", { padding: "10px 18px", fontSize: 13, borderRadius: 12 })}>📅 Schedule</button>
                    <button style={btn("soft", { padding: "10px 18px", fontSize: 13, borderRadius: 12 })}>✏️ Edit</button>
                    <button style={btn("main", { padding: "10px 22px", fontSize: 13, borderRadius: 12 })}>🚀 Publish Now</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Generate More */}
        {showMoreOption && (
          <div className="pop" style={{ ...card({ padding: 32, textAlign: "center" }), borderColor: c.coralBorder, background: `linear-gradient(135deg, rgba(232,54,79,.04), ${c.card})` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: c.w, marginBottom: 6 }}>Want more posts?</h3>
            <p style={{ fontSize: 15, color: c.s, marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
              Great choices! Since you liked these, you can now generate up to 10 posts at once.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: c.s }}>How many?</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[3, 5, 7, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => setPostCount(n)}
                    style={{
                      width: 44, height: 44, borderRadius: 12, fontSize: 16, fontWeight: 700,
                      border: `2px solid ${postCount === n ? c.coralBorder : c.border}`,
                      background: postCount === n ? c.coralBg : "transparent",
                      color: postCount === n ? c.coral : c.s,
                      cursor: "pointer", fontFamily: "'Outfit',sans-serif",
                      transition: "all .2s ease",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={onGenerateMore} style={btn("main", { padding: "14px 32px", fontSize: 16 })}>
              ✨ Generate {postCount} more posts
            </button>
          </div>
        )}

        {/* Actions Bar */}
        {!allApproved && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: 14, color: c.m }}>
              Review each post above — approve it or give feedback to change it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function SellantMagicMode() {
  const [screen, setScreen] = useState("mode"); // mode | url | questions | working | results
  const [url, setUrl] = useState("");
  const [answers, setAnswers] = useState({});

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.w, fontFamily: "'Outfit', sans-serif" }}>
      <style>{CSS}</style>

      {screen === "mode" && (
        <ModeSelect
          onMagic={() => setScreen("url")}
          onManual={() => alert("This would open the manual step-by-step setup (V1/V2 versions)")}
        />
      )}

      {screen === "url" && (
        <URLInput onSubmit={(u) => { setUrl(u); setScreen("questions"); }} />
      )}

      {screen === "questions" && (
        <AIQuestions onComplete={(a) => { setAnswers(a); setScreen("working"); }} />
      )}

      {screen === "working" && (
        <AIWorking onDone={() => setScreen("results")} />
      )}

      {screen === "results" && (
        <Results onGenerateMore={() => { setScreen("working"); }} />
      )}
    </div>
  );
}
