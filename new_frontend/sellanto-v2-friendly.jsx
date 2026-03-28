import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// DESIGN SYSTEM — Warm, approachable, non-intimidating
// ═══════════════════════════════════════════════════════════════

const SVGIcons = {
  home: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  compass: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  bulb: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>,
  pen: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  image: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  sparkle: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.59 4.85L18.5 9.4l-3.91 3.02L16.09 17.27 12 14.67l-4.09 2.6 1.5-4.85L5.5 9.4l4.91-1.55z"/></svg>,
  calendar: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  link: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  chart: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  search: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  chat: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  check: (c = "#10B981", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  checkCircle: (c = "#10B981", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  arrowRight: (c = "#fff", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  arrowLeft: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  plus: (c = "#fff", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  refresh: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  upload: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
  wand: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="M11 6.2L9.7 5"/><path d="M11 11.8L9.7 13"/><line x1="12" y1="22" x2="3" y2="13"/></svg>,
  globe: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  target: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  trending: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  shield: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  diamond: (c = "#10B981", s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M6 3h12l6 8-12 12L0 11z" opacity="0.9"/></svg>,
  crown: (c = "#F59E0B", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 16h14v4H5z" fill={c} opacity="0.15"/></svg>,
  helpCircle: (c = "#6B7280", s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  x: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  skip: (c = "#9CA3AF", s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>,
  user: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  settings: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  building: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 18h6"/></svg>,
  palette: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill={c}/><circle cx="17.5" cy="10.5" r="0.5" fill={c}/><circle cx="8.5" cy="7.5" r="0.5" fill={c}/><circle cx="6.5" cy="12.5" r="0.5" fill={c}/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>,
  type: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  video: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  mic: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  bot: (c = "#9CA3AF", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>,
  chevDown: (c = "#9CA3AF", s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  info: (c = "#3B82F6", s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  alert: (c = "#F59E0B", s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const css = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');

*{margin:0;padding:0;box-sizing:border-box}
html{font-size:16px}
body{font-family:'Nunito',sans-serif;background:#0C0C18;color:#EEEEF2}

::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}

@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideR{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
@keyframes popIn{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
@keyframes confetti{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(-20px) rotate(360deg);opacity:0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes gentleGlow{0%,100%{box-shadow:0 0 8px rgba(232,54,79,.1)}50%{box-shadow:0 0 20px rgba(232,54,79,.25)}}

.anim-up{animation:fadeUp .5s ease both}
.anim-d1{animation:fadeUp .5s ease .06s both}
.anim-d2{animation:fadeUp .5s ease .12s both}
.anim-d3{animation:fadeUp .5s ease .18s both}
.anim-d4{animation:fadeUp .5s ease .24s both}
.anim-d5{animation:fadeUp .5s ease .30s both}
.anim-slide{animation:slideR .4s ease both}
.anim-pop{animation:popIn .35s ease both}
.anim-float{animation:float 3s ease-in-out infinite}

.hover-card{transition:all .25s ease;cursor:pointer}
.hover-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.25);border-color:rgba(255,255,255,.12)!important}
.hover-card:active{transform:translateY(0);transition-duration:.1s}

.btn{border:none;font-family:'Nunito',sans-serif;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s ease;border-radius:14px;font-size:15px;letter-spacing:-.01em}
.btn:active{transform:scale(.97)}
.btn-main{background:linear-gradient(135deg,#E8364F 0%,#FF6B81 100%);color:#fff;padding:14px 28px;box-shadow:0 4px 16px rgba(232,54,79,.3)}
.btn-main:hover{box-shadow:0 6px 24px rgba(232,54,79,.45);transform:translateY(-1px)}
.btn-main:disabled{opacity:.35;cursor:not-allowed;transform:none!important;box-shadow:none}
.btn-soft{background:rgba(255,255,255,.06);color:#EEEEF2;padding:12px 22px;border:1px solid rgba(255,255,255,.08)}
.btn-soft:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.16)}
.btn-ghost{background:transparent;color:#9CA3AF;padding:10px 16px;font-size:14px}
.btn-ghost:hover{background:rgba(255,255,255,.05);color:#EEEEF2}
.btn-sm{padding:10px 18px;font-size:13px;border-radius:10px}
.btn-xs{padding:7px 14px;font-size:12px;border-radius:8px}

.card{background:#14142A;border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:24px;transition:border-color .2s ease}
.card-sm{border-radius:14px;padding:18px}

.input{width:100%;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 18px;color:#EEEEF2;font-size:15px;font-family:'Nunito',sans-serif;transition:all .2s ease;outline:none}
.input:focus{border-color:#E8364F;box-shadow:0 0 0 4px rgba(232,54,79,.12)}
.input::placeholder{color:#6B7280}

.chip{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid rgba(255,255,255,.08);background:transparent;color:#9CA3AF;transition:all .2s ease;font-family:'Nunito',sans-serif}
.chip:hover{border-color:rgba(255,255,255,.16);color:#EEEEF2;background:rgba(255,255,255,.04)}
.chip.on{border-color:#E8364F;color:#E8364F;background:rgba(232,54,79,.1)}

.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.3px}

.help-tip{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:#6B7280;cursor:help;padding:4px 10px;border-radius:8px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.1);transition:all .2s ease}
.help-tip:hover{background:rgba(59,130,246,.12);color:#93C5FD}

.progress-track{height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}
.progress-fill{height:100%;border-radius:4px;transition:width .8s cubic-bezier(.4,0,.2,1)}
`;

// ═══════════════════════════════════════════════════════════════
// HELPER: Inline Help Tooltip
// ═══════════════════════════════════════════════════════════════
function HelpTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span className="help-tip" onClick={() => setShow(!show)} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        {SVGIcons.helpCircle("#93C5FD", 14)}
        <span>What's this?</span>
      </span>
      {show && (
        <span className="anim-pop" style={{
          position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
          background: "#1E1E3A", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14,
          padding: "14px 18px", fontSize: 13, lineHeight: 1.6, color: "#D1D5DB",
          width: 280, zIndex: 100, boxShadow: "0 12px 40px rgba(0,0,0,.5)",
          pointerEvents: "none",
        }}>
          <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 12, height: 12, background: "#1E1E3A", borderRight: "1px solid rgba(255,255,255,.12)", borderBottom: "1px solid rgba(255,255,255,.12)" }} />
          {text}
        </span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
function Sidebar({ page, go }) {
  const items = [
    { id: "home", icon: "home", label: "Home" },
    { id: "strategy", icon: "compass", label: "Strategy", arrow: true },
    { id: "ideas", icon: "bulb", label: "Ideas", arrow: true },
    { id: "create", icon: "pen", label: "Create Post", arrow: true },
    { id: "calendar", icon: "calendar", label: "Calendar" },
    { id: "connect", icon: "link", label: "Connect Accounts" },
    { id: "analytics", icon: "chart", label: "Analytics" },
  ];
  const aiItems = [
    { id: "caption", icon: "type", label: "AI Captions" },
    { id: "aiimage", icon: "image", label: "AI Images" },
    { id: "aivideo", icon: "video", label: "AI Video" },
    { id: "aivoice", icon: "mic", label: "AI Voice" },
    { id: "messenger", icon: "bot", label: "Messenger Bot" },
  ];
  const settItems = [
    { id: "profile", icon: "user", label: "Profile" },
    { id: "business", icon: "building", label: "Business Profile" },
    { id: "settings", icon: "settings", label: "Settings" },
  ];

  const NavItem = ({ item }) => {
    const active = page === item.id;
    return (
      <div onClick={() => go(item.id)} style={{
        display: "flex", alignItems: "center", gap: 11, padding: "11px 16px", borderRadius: 12,
        cursor: "pointer", transition: "all .2s ease", fontSize: 14, fontWeight: active ? 700 : 500,
        color: active ? "#E8364F" : "#9CA3AF",
        background: active ? "rgba(232,54,79,.1)" : "transparent",
      }}>
        {SVGIcons[item.icon](active ? "#E8364F" : "#6B7280", 18)}
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.arrow && SVGIcons.chevDown(active ? "#E8364F" : "#4B5563", 14)}
      </div>
    );
  };

  return (
    <div style={{
      width: 240, height: "100vh", background: "#0F0F1E", borderRight: "1px solid rgba(255,255,255,.06)",
      position: "fixed", left: 0, top: 0, zIndex: 50, display: "flex", flexDirection: "column",
      overflowY: "auto", padding: "0 10px",
    }}>
      <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: "linear-gradient(135deg, #E8364F, #FF8A9B)", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff",
        }}>S</div>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.5px" }}>Sellanto</span>
      </div>
      <div style={{ flex: 1 }}>
        {items.map(i => <NavItem key={i.id} item={i} />)}
        <div style={{ padding: "16px 16px 6px", fontSize: 10, fontWeight: 800, color: "#4B5563", letterSpacing: "1.5px", textTransform: "uppercase" }}>AI Tools</div>
        {aiItems.map(i => <NavItem key={i.id} item={i} />)}
        <div style={{ padding: "16px 16px 6px", fontSize: 10, fontWeight: 800, color: "#4B5563", letterSpacing: "1.5px", textTransform: "uppercase" }}>Settings</div>
        {settItems.map(i => <NavItem key={i.id} item={i} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════
function TopBar({ diamonds }) {
  const [showDiamondHelp, setShowDiamondHelp] = useState(false);
  return (
    <div style={{
      height: 60, background: "#0F0F1E", borderBottom: "1px solid rgba(255,255,255,.06)",
      display: "flex", alignItems: "center", padding: "0 28px", gap: 14,
      position: "sticky", top: 0, zIndex: 40,
    }}>
      <div style={{
        flex: 1, maxWidth: 400, display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,.04)", borderRadius: 14, padding: "10px 16px",
        border: "1px solid rgba(255,255,255,.06)",
      }}>
        {SVGIcons.search("#6B7280", 16)}
        <span style={{ fontSize: 14, color: "#6B7280" }}>Search anything...</span>
      </div>
      <div style={{ flex: 1 }} />

      {/* Diamond Balance with help */}
      <div style={{ position: "relative" }}>
        <div onClick={() => setShowDiamondHelp(!showDiamondHelp)} style={{
          display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
          borderRadius: 24, cursor: "pointer", transition: "all .2s ease",
          background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)",
        }}>
          {SVGIcons.diamond("#10B981", 15)}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{diamonds.toLocaleString()}</span>
          {SVGIcons.helpCircle("#10B981", 13)}
        </div>
        {showDiamondHelp && (
          <div className="anim-pop" style={{
            position: "absolute", top: "calc(100% + 10px)", right: 0,
            background: "#1A1A32", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16,
            padding: 20, width: 300, zIndex: 100, boxShadow: "0 16px 48px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>💎 Your Diamond Tokens</div>
            <p style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 14 }}>
              Diamonds power all AI features in Sellanto. Here's what each action costs:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {[
                { action: "Write captions", cost: "~20", emoji: "✍️" },
                { action: "Generate an image", cost: "~50", emoji: "🖼️" },
                { action: "Find trending topics", cost: "~100", emoji: "📈" },
                { action: "Create a video", cost: "~150", emoji: "🎬" },
              ].map(r => (
                <div key={r.action} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,.03)" }}>
                  <span style={{ fontSize: 16 }}>{r.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.action}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>{r.cost} 💎</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>
              Free plan includes 10,000 diamonds/month
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "relative", cursor: "pointer", padding: 8 }}>
        {SVGIcons.bell("#9CA3AF", 18)}
        <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#E8364F" }} />
      </div>
      {SVGIcons.chat("#6B7280", 18)}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 5px",
        borderRadius: 14, cursor: "pointer",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 12,
          background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff",
        }}>AB</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEPPER — Friendly visual journey
// ═══════════════════════════════════════════════════════════════
function Stepper({ steps, current, done }) {
  return (
    <div className="card anim-up" style={{ padding: "18px 28px", marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 72 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                background: done.has(i) ? "rgba(16,185,129,.12)" : current === i ? "rgba(232,54,79,.12)" : "rgba(255,255,255,.04)",
                border: `2px solid ${done.has(i) ? "#10B981" : current === i ? "#E8364F" : "rgba(255,255,255,.08)"}`,
                transition: "all .35s ease",
                animation: current === i ? "gentleGlow 2.5s ease infinite" : "none",
              }}>
                {done.has(i) ? SVGIcons.checkCircle("#10B981", 20) : (
                  <span style={{ fontSize: 14, fontWeight: 800, color: current === i ? "#E8364F" : "#6B7280" }}>{i + 1}</span>
                )}
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: current === i ? 700 : 500,
                color: current === i ? "#EEEEF2" : done.has(i) ? "#10B981" : "#6B7280",
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 3, flex: 1, margin: "0 4px", marginBottom: 22, borderRadius: 2,
                background: done.has(i) ? `linear-gradient(90deg, #10B981, ${done.has(i + 1) ? "#10B981" : "rgba(255,255,255,.06)"})` : "rgba(255,255,255,.06)",
                transition: "background .6s ease",
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: WELCOME / GETTING STARTED
// ═══════════════════════════════════════════════════════════════
function WelcomePage({ onStart }) {
  const tasks = [
    { id: "brand", emoji: "🌐", label: "Tell us about your brand", desc: "We'll look at your website and learn your style", done: true },
    { id: "pillars", emoji: "🎯", label: "Pick your content topics", desc: "Choose what subjects you want to post about", done: true },
    { id: "comp", emoji: "🔍", label: "See your competitors", desc: "We'll find who else is in your space", done: false },
    { id: "trends", emoji: "📈", label: "Discover what's trending", desc: "Find hot topics your audience cares about", done: false },
    { id: "accounts", emoji: "🔗", label: "Connect your social media", desc: "Link Instagram, Facebook, LinkedIn, etc.", done: false },
    { id: "post", emoji: "✨", label: "Create your first post", desc: "Let AI write and design your content", done: false },
  ];
  const doneCount = tasks.filter(t => t.done).length;
  const progress = (doneCount / tasks.length) * 100;
  const nextTask = tasks.find(t => !t.done);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Welcome */}
      <div className="anim-up" style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 42, marginBottom: 8 }} className="anim-float">👋</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: "-.5px" }}>
          Welcome to Sellanto!
        </h1>
        <p style={{ fontSize: 16, color: "#9CA3AF", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
          We'll help you set up everything step by step.<br />
          No technical knowledge needed — just follow along.
        </p>
      </div>

      {/* Progress */}
      <div className="card anim-d1" style={{ padding: 20, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Your setup progress</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{doneCount} of {tasks.length} done</span>
        </div>
        <div className="progress-track" style={{ height: 10, borderRadius: 5 }}>
          <div className="progress-fill" style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #10B981, #3B82F6)",
            borderRadius: 5,
          }} />
        </div>
        <p style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
          {progress < 100 ? `Almost there! ${tasks.length - doneCount} steps left to start publishing.` : "You're all set! 🎉"}
        </p>
      </div>

      {/* Tasks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {tasks.map((t, i) => {
          const isNext = t === nextTask;
          return (
            <div
              key={t.id}
              className={`card card-sm hover-card anim-d${Math.min(i + 2, 5)}`}
              style={{
                padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                borderColor: isNext ? "rgba(232,54,79,.35)" : undefined,
                background: isNext ? "rgba(232,54,79,.04)" : undefined,
                animation: isNext ? "gentleGlow 2.5s ease infinite" : undefined,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                background: t.done ? "rgba(16,185,129,.1)" : isNext ? "rgba(232,54,79,.1)" : "rgba(255,255,255,.04)",
                fontSize: 22, flexShrink: 0,
              }}>
                {t.done ? SVGIcons.checkCircle("#10B981", 24) : t.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: t.done ? "#6B7280" : "#EEEEF2",
                  textDecoration: t.done ? "line-through" : "none",
                  textDecorationColor: "#374151",
                }}>
                  {t.label}
                  {t.done && <span style={{ marginLeft: 8, fontSize: 12, color: "#10B981", textDecoration: "none", display: "inline-block" }}>Done ✓</span>}
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{t.desc}</div>
              </div>
              {isNext && (
                <button className="btn btn-main btn-sm" onClick={onStart} style={{ flexShrink: 0 }}>
                  Let's go {SVGIcons.arrowRight("#fff", 16)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick glance stats */}
      <div className="anim-d5" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { emoji: "🌐", label: "Brand Profile", value: "Ready", color: "#10B981" },
          { emoji: "🔗", label: "Social Accounts", value: "Not connected yet", color: "#F59E0B" },
          { emoji: "📝", label: "Posts Created", value: "None yet", color: "#6B7280" },
        ].map(s => (
          <div key={s.label} className="card card-sm" style={{ textAlign: "center", padding: 18 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.emoji}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: BRAND DNA
// ═══════════════════════════════════════════════════════════════
function BrandDNAPage({ onNext }) {
  const [state, setState] = useState("success");

  const brand = {
    name: "Abedin Tech", industry: "SaaS and digital marketing agency",
    voice: "Professional", cta: "Learn more",
    desc: "Abedin Tech is a SaaS and digital marketing agency brand targeting USA.",
    audience: "Business owners interested in SaaS and digital marketing",
    products: ["SaaS", "Digital Marketing", "SEO", "Web Design"],
    themes: ["Revenue Growth", "Conversion", "Industry Insights"],
    keywords: ["abedin tech", "digital marketing", "saas platform"],
  };

  const states = {
    success: { emoji: "✅", label: "All good!", msg: "We successfully read your website and built your brand profile.", color: "#10B981", bg: "rgba(16,185,129,.08)" },
    partial: { emoji: "⚠️", label: "Almost there", msg: "We got most of your info, but a few things need your help. Please review below.", color: "#F59E0B", bg: "rgba(245,158,11,.08)" },
    failed: { emoji: "❌", label: "Couldn't read your website", msg: "No worries — just fill in your brand info below and we'll take care of the rest.", color: "#E8364F", bg: "rgba(232,54,79,.08)" },
  };
  const s = states[state];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          🌐 Your Brand Profile
        </h2>
        <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.6 }}>
          This is how Sellanto understands your brand. Everything we create — posts, images, captions — uses this info.
        </p>
        <div style={{ marginTop: 8 }}>
          <HelpTip text="Brand DNA is like a personality profile for your business. It helps our AI write content that sounds like you, not like a robot. The more accurate this is, the better your content will be!" />
        </div>
      </div>

      {/* Status Banner */}
      <div className="anim-d1" style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
        borderRadius: 16, marginBottom: 18, background: s.bg, border: `1px solid ${s.color}25`,
      }}>
        <span style={{ fontSize: 28 }}>{s.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.label}</div>
          <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>{s.msg}</div>
        </div>
        {state !== "success" && (
          <button className="btn btn-soft btn-sm">
            {SVGIcons.refresh("#9CA3AF", 14)} Try again
          </button>
        )}
      </div>

      {/* Demo toggle */}
      <div className="anim-d1" style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#4B5563" }}>Try different states:</span>
        {Object.keys(states).map(k => (
          <button key={k} className={`chip ${state === k ? "on" : ""}`} style={{ fontSize: 11 }} onClick={() => setState(k)}>
            {states[k].emoji} {k}
          </button>
        ))}
      </div>

      {/* Brand Card */}
      {state !== "failed" && (
        <div className="card anim-d2" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              🏢 Brand Identity
            </h3>
            <button className="btn btn-soft btn-xs">
              {SVGIcons.edit("#9CA3AF", 13)} Edit this section
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {[
              { label: "Brand Name", value: brand.name },
              { label: "Industry", value: brand.industry },
              { label: "Writing Style", value: brand.voice },
              { label: "Call-to-Action", value: brand.cta },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>What your brand does</div>
            <div style={{ fontSize: 14, color: "#D1D5DB", lineHeight: 1.6 }}>{brand.desc}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Who you're talking to</div>
            <div style={{ fontSize: 14, color: "#D1D5DB" }}>{brand.audience}</div>
          </div>
        </div>
      )}

      {state !== "failed" && (
        <div className="anim-d3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { emoji: "📦", label: "Products & Services", items: brand.products, color: "#8B5CF6" },
            { emoji: "💡", label: "Content Topics", items: brand.themes, color: "#E8364F" },
            { emoji: "🔑", label: "Keywords", items: brand.keywords, color: "#3B82F6" },
          ].map(sec => (
            <div key={sec.label} className="card card-sm hover-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{sec.emoji} {sec.label}</span>
                <span style={{ cursor: "pointer", opacity: 0.4, transition: "opacity .2s" }}>{SVGIcons.edit("#9CA3AF", 14)}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sec.items.map(item => (
                  <span key={item} className="badge" style={{ background: `${sec.color}15`, color: sec.color }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logo */}
      <div className="card anim-d4" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16, border: "2px dashed rgba(255,255,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.02)",
            fontSize: 28, flexShrink: 0,
          }}>🖼️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Your Logo</div>
            <div style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.5 }}>
              Upload your logo so AI-generated images include your branding. Without it, images won't have your logo on them.
            </div>
          </div>
          <button className="btn btn-soft btn-sm">
            {SVGIcons.upload("#9CA3AF", 15)} Upload Logo
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-ghost">{SVGIcons.arrowLeft("#9CA3AF", 16)} Back</button>
        <button className="btn btn-main" onClick={onNext}>
          Looks good, continue {SVGIcons.arrowRight("#fff", 16)}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: TRENDING TOPICS
// ═══════════════════════════════════════════════════════════════
function TrendingPage({ onNext, diamonds }) {
  const [view, setView] = useState("pick");
  const [selected, setSelected] = useState(new Set([0, 1, 4]));

  const topics = [
    { title: "AI-powered SEO tools for small businesses", heat: "🔥 Hot", heatColor: "#E8364F", why: "Your competitors are talking about this — great time to share your expertise" },
    { title: "Google's March 2026 algorithm update", heat: "🔥 Hot", heatColor: "#E8364F", why: "Business owners are confused and need guidance right now" },
    { title: "Revenue planning strategies for Q2", heat: "📈 Rising", heatColor: "#F59E0B", why: "Decision-makers are planning budgets — perfect timing" },
    { title: "Marketing budget tips for uncertain times", heat: "📈 Rising", heatColor: "#F59E0B", why: "Helps position you as a cost-effective solution" },
    { title: "Local SEO tips for spring 2026", heat: "📈 Rising", heatColor: "#F59E0B", why: "Spring brings more local business activity" },
    { title: "How to pick a good digital marketing agency", heat: "📈 Rising", heatColor: "#F59E0B", why: "Positions you as the transparent, trustworthy choice" },
    { title: "Global digital marketing trends for US small biz", heat: "🌱 New", heatColor: "#3B82F6", why: "Fresh topic with less competition" },
  ];

  const toggle = (i) => { const n = new Set(selected); n.has(i) ? n.delete(i) : n.add(i); setSelected(n); };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          📈 What's Trending in Your Industry
        </h2>
        <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.6 }}>
          Pick topics you'd like to create content about. We found these based on what's popular in your space right now.
        </p>
        <div style={{ marginTop: 8 }}>
          <HelpTip text="Trending topics are subjects that lots of people are searching for or talking about right now. Posting about trending topics helps more people find your content. Pick the ones that fit your business!" />
        </div>
      </div>

      {/* View Toggle */}
      <div className="anim-d1" style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#4B5563" }}>Demo:</span>
        <button className={`chip ${view === "blocked" ? "on" : ""}`} style={{ fontSize: 11 }} onClick={() => setView("blocked")}>⛔ Blocked</button>
        <button className={`chip ${view === "pick" ? "on" : ""}`} style={{ fontSize: 11 }} onClick={() => setView("pick")}>✅ Selection</button>
      </div>

      {/* BLOCKED STATE */}
      {view === "blocked" && (
        <div className="anim-slide">
          <div className="card" style={{ textAlign: "center", padding: 36 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }} className="anim-float">💎</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>You need a Pro plan for this</h3>
            <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.7, maxWidth: 420, margin: "0 auto 8px" }}>
              Finding trending topics uses AI and costs <strong style={{ color: "#F59E0B" }}>100 diamonds</strong>.
            </p>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 20px" }}>
              You have <strong style={{ color: "#10B981" }}>{diamonds.toLocaleString()} diamonds</strong>, but this feature needs a Pro plan. You can upgrade, or just add your own topics below — totally free!
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 28 }}>
              <button className="btn btn-main btn-sm">{SVGIcons.crown("#fff", 16)} See Pro plans</button>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 24 }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✍️ Add your own topics instead</h4>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
                Type any topic you want to post about — works exactly the same way!
              </p>
              <div style={{ display: "flex", gap: 8, maxWidth: 480, margin: "0 auto", marginBottom: 12 }}>
                <input className="input" placeholder='Try "SEO tips for beginners"' style={{ flex: 1 }} />
                <button className="btn btn-main btn-sm">{SVGIcons.plus("#fff", 16)} Add</button>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {["SEO tips 2026", "Content marketing", "Social media trends", "Small business growth"].map(ex => (
                  <button key={ex} className="chip" style={{ fontSize: 11 }}>{SVGIcons.plus("#6B7280", 12)} {ex}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SELECTION STATE */}
      {view === "pick" && (
        <div className="anim-slide">
          {/* Guide Bar */}
          <div className="card card-sm anim-up" style={{ padding: "14px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: selected.size >= 3 ? "#10B981" : "#F59E0B" }}>
                {selected.size} picked
              </span>
              <span style={{
                fontSize: 13, padding: "4px 12px", borderRadius: 8,
                background: selected.size >= 3 ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
                color: selected.size >= 3 ? "#10B981" : "#F59E0B", fontWeight: 600,
              }}>
                {selected.size >= 3 ? "✓ You're good to go!" : `Pick at least 3 (need ${3 - selected.size} more)`}
              </span>
            </div>
            <button className="btn btn-ghost btn-xs">{SVGIcons.refresh("#6B7280", 13)} Get new topics</button>
          </div>

          {/* Topic Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {topics.map((t, i) => {
              const on = selected.has(i);
              return (
                <div
                  key={i}
                  className={`card card-sm hover-card anim-d${Math.min(i % 5 + 1, 5)}`}
                  onClick={() => toggle(i)}
                  style={{
                    padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                    borderColor: on ? "rgba(232,54,79,.4)" : undefined,
                    background: on ? "rgba(232,54,79,.04)" : undefined,
                    borderLeft: on ? "3px solid #E8364F" : undefined,
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                    border: `2px solid ${on ? "#E8364F" : "rgba(255,255,255,.15)"}`,
                    background: on ? "#E8364F" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s ease",
                  }}>
                    {on && SVGIcons.check("#fff", 16)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</span>
                      <span className="badge" style={{ background: `${t.heatColor}15`, color: t.heatColor, fontSize: 10 }}>{t.heat}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                      💡 <em>{t.why}</em>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add own */}
          <div className="card card-sm" style={{ padding: "12px 18px", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>✍️</span>
              <input className="input" placeholder="Add your own topic..." style={{ flex: 1, border: "none", background: "transparent", padding: "8px 0" }} />
              <button className="btn btn-soft btn-xs">Add</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-ghost">{SVGIcons.arrowLeft("#9CA3AF", 16)} Back</button>
        <button className="btn btn-main" disabled={view === "pick" && selected.size < 3} onClick={onNext}>
          Continue to ideas {SVGIcons.arrowRight("#fff", 16)}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: IDEAS REVIEW
// ═══════════════════════════════════════════════════════════════
function IdeasPage({ onNext }) {
  const [ideas, setIdeas] = useState([
    { id: 1, title: "Q2 2026 Revenue Planning Framework", desc: "While most agencies are still planning Q1, we're already optimizing Q2 revenue strategies. Here's our proven framework.", platform: "LinkedIn", format: "Carousel", status: "approved" },
    { id: 2, title: "AI SEO Tools: A Real Transformation Story", desc: "This small business owner was skeptical about AI-powered SEO — until they saw a $47K revenue increase.", platform: "Instagram", format: "Reel", status: "approved" },
    { id: 3, title: "March 2026 Google Update — What Survived", desc: "Google's latest algorithm update crushed 3 types of local businesses. Here's what actually worked.", platform: "Twitter", format: "Thread", status: "pending" },
    { id: 4, title: "Marketing Budget Guide for Uncertain Times", desc: "Most businesses cut marketing budgets the wrong way. Here's how to spend smarter, not less.", platform: "LinkedIn", format: "Post", status: "pending" },
    { id: 5, title: "4 Local SEO Tactics for Spring 2026", desc: "These 4 optimization tricks drove 73% more foot traffic for local businesses this spring.", platform: "Facebook", format: "Infographic", status: "pending" },
  ]);

  const update = (id, status) => setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  const approved = ideas.filter(i => i.status === "approved").length;

  const platEmoji = { LinkedIn: "💼", Instagram: "📸", Twitter: "🐦", Facebook: "📘", TikTok: "🎵" };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          💡 Content Ideas
        </h2>
        <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.6 }}>
          Here are post ideas based on your trending topics. Approve the ones you like — we'll write the full captions next.
        </p>
        <div style={{ marginTop: 8 }}>
          <HelpTip text="Think of these as article headlines or social media post topics. Approve the ones that feel right for your brand. You can edit them, skip ones you don't like, or ask AI to suggest something different. You need at least 3 approved to move on." />
        </div>
      </div>

      {/* Status Bar */}
      <div className="card card-sm anim-d1" style={{ padding: "14px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: approved >= 3 ? "#10B981" : "#F59E0B" }}>
            {approved} approved
          </span>
          <span style={{
            fontSize: 13, padding: "4px 12px", borderRadius: 8, fontWeight: 600,
            background: approved >= 3 ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
            color: approved >= 3 ? "#10B981" : "#F59E0B",
          }}>
            {approved >= 3 ? "✓ Ready to continue!" : `Approve at least 3 (need ${3 - approved} more)`}
          </span>
        </div>
      </div>

      {/* Idea Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {ideas.map((idea, i) => (
          <div
            key={idea.id}
            className={`card card-sm anim-d${Math.min(i + 2, 5)}`}
            style={{
              borderLeft: idea.status === "approved" ? "3px solid #10B981" : undefined,
              borderColor: idea.status === "approved" ? "rgba(16,185,129,.25)" : undefined,
              background: idea.status === "approved" ? "rgba(16,185,129,.03)" : undefined,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, flex: "1 1 auto" }}>{idea.title}</h4>
                  {idea.status === "approved" && (
                    <span className="badge anim-pop" style={{ background: "rgba(16,185,129,.12)", color: "#10B981" }}>
                      ✓ Approved
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>{idea.desc}</p>
              </div>
            </div>

            {/* Tags + Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="badge" style={{ background: "rgba(59,130,246,.1)", color: "#60A5FA" }}>
                  {platEmoji[idea.platform]} {idea.platform}
                </span>
                <span className="badge" style={{ background: "rgba(255,255,255,.05)", color: "#6B7280" }}>
                  {idea.format}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {idea.status !== "approved" ? (
                  <button className="btn btn-main btn-xs" onClick={() => update(idea.id, "approved")}>
                    {SVGIcons.check("#fff", 13)} Approve
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-xs" onClick={() => update(idea.id, "pending")} style={{ color: "#6B7280" }}>
                    Undo
                  </button>
                )}
                <button className="btn btn-ghost btn-xs">{SVGIcons.edit("#6B7280", 12)} Edit</button>
                <button className="btn btn-ghost btn-xs">{SVGIcons.refresh("#6B7280", 12)} New idea</button>
                <button className="btn btn-ghost btn-xs" style={{ color: "#4B5563" }}>{SVGIcons.skip("#4B5563", 12)} Skip</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-ghost">{SVGIcons.arrowLeft("#9CA3AF", 16)} Back</button>
        <button className="btn btn-main" disabled={approved < 3} onClick={onNext}>
          Continue to captions {SVGIcons.arrowRight("#fff", 16)}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: MEDIA GENERATION — One-thing-at-a-time wizard
// ═══════════════════════════════════════════════════════════════
function MediaPage({ onNext }) {
  const [post, setPost] = useState(0);
  const [step, setStep] = useState(0);
  const [source, setSource] = useState(null);
  const [style, setStyle] = useState("Modern");
  const [provider, setProvider] = useState("OpenAI");
  const [overlay, setOverlay] = useState(false);
  const [gen, setGen] = useState("idle");

  const posts = [
    { title: "Q2 Revenue Planning Framework", caption: "While most agencies are still planning Q1…" },
    { title: "AI SEO Transformation Story", caption: "This small business owner was skeptical…" },
    { title: "Google March 2026 Update", caption: "Google's latest update crushed 3 types…" },
  ];

  const doGenerate = () => {
    setGen("working");
    setTimeout(() => setGen("done"), 2200);
  };

  const wizLabels = ["How to add", "Pick a look", "Text on image?", "Create image"];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          🖼️ Add Images to Your Posts
        </h2>
        <p style={{ fontSize: 15, color: "#9CA3AF", lineHeight: 1.6 }}>
          Each post needs a picture. You can upload your own or let AI create one for you. We'll walk you through it one step at a time.
        </p>
        <div style={{ marginTop: 8 }}>
          <HelpTip text="Social media posts with images get much more attention. If you don't have your own images, our AI can create beautiful, professional-looking images based on your post content. Just follow the steps!" />
        </div>
      </div>

      {/* Post Selector */}
      <div className="anim-d1" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {posts.map((p, i) => (
          <button
            key={i}
            className={`chip ${post === i ? "on" : ""}`}
            onClick={() => { setPost(i); setStep(0); setSource(null); setGen("idle"); }}
            style={{ flex: 1, justifyContent: "center", padding: "12px", fontSize: 13 }}
          >
            {i < post ? SVGIcons.checkCircle("#10B981", 14) : <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.15)", display: "inline-block" }} />}
            <span>Post {i + 1}</span>
          </button>
        ))}
      </div>

      {/* Current Post */}
      <div className="card card-sm anim-d2" style={{ padding: "14px 18px", marginBottom: 14, background: "rgba(255,255,255,.02)" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{posts[post].title}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 3 }}>{posts[post].caption}</div>
      </div>

      {/* Step Indicators */}
      <div className="anim-d2" style={{ display: "flex", gap: 4, marginBottom: 14, padding: "0 4px" }}>
        {wizLabels.map((l, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10,
            background: step === i ? "rgba(232,54,79,.1)" : "transparent",
            transition: "all .2s ease",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 8, margin: "0 auto 4px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i < step ? "rgba(16,185,129,.12)" : step === i ? "rgba(232,54,79,.15)" : "rgba(255,255,255,.04)",
              fontSize: 11, fontWeight: 800,
              color: i < step ? "#10B981" : step === i ? "#E8364F" : "#4B5563",
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, fontWeight: step === i ? 700 : 500, color: step === i ? "#EEEEF2" : "#6B7280" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="card anim-slide" key={`s${step}${post}`} style={{ padding: 28, marginBottom: 22, minHeight: 240 }}>
        {/* STEP 0: Source */}
        {step === 0 && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>How do you want to add an image?</h3>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 20 }}>Pick one — you can always change your mind.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { id: "upload", emoji: "📁", title: "I have my own image", desc: "Upload a photo or graphic from your computer", nextStep: 3 },
                { id: "ai", emoji: "✨", title: "Let AI create one", desc: "We'll design a professional image for you", badge: "~50 💎", nextStep: 1 },
              ].map(opt => (
                <div
                  key={opt.id}
                  className="card hover-card"
                  onClick={() => { setSource(opt.id); setStep(opt.nextStep); }}
                  style={{ padding: 24, textAlign: "center", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{opt.emoji}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{opt.title}</div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>{opt.desc}</div>
                  {opt.badge && (
                    <div style={{ marginTop: 10 }}>
                      <span className="badge" style={{ background: "rgba(245,158,11,.1)", color: "#F59E0B" }}>{opt.badge}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Style */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>What style should your image be?</h3>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 20 }}>Pick a visual vibe. Don't worry, you can try different ones later.</p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "block" }}>Image style</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Modern", "Professional", "Vibrant", "Artistic", "Minimal", "Playful"].map(s => (
                  <button key={s} className={`chip ${style === s ? "on" : ""}`} onClick={() => setStyle(s)} style={{ padding: "10px 20px", fontSize: 14 }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, display: "block" }}>AI engine</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ name: "OpenAI", cost: 50, rec: true }, { name: "Gemini", cost: 40 }].map(p => (
                  <div
                    key={p.name}
                    className={`card card-sm hover-card`}
                    onClick={() => setProvider(p.name)}
                    style={{
                      padding: 16, cursor: "pointer", textAlign: "center",
                      borderColor: provider === p.name ? "rgba(232,54,79,.4)" : undefined,
                      background: provider === p.name ? "rgba(232,54,79,.04)" : undefined,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {p.name} {p.rec && <span className="badge" style={{ background: "rgba(59,130,246,.1)", color: "#60A5FA", marginLeft: 6 }}>Recommended</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{p.cost} diamonds per image 💎</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>{SVGIcons.arrowLeft("#9CA3AF", 14)} Back</button>
              <button className="btn btn-main btn-sm" onClick={() => setStep(2)}>Next step {SVGIcons.arrowRight("#fff", 14)}</button>
            </div>
          </div>
        )}

        {/* STEP 2: Text overlay */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Want text on the image?</h3>
            <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 20 }}>
              This adds marketing text (like a headline) directly onto the picture. Totally optional!
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                { val: false, emoji: "🖼️", title: "No text, just the image", desc: "Clean, simple image" },
                { val: true, emoji: "📝", title: "Yes, add text on it", desc: "Great for announcements" },
              ].map(opt => (
                <div
                  key={String(opt.val)}
                  className="card hover-card"
                  onClick={() => setOverlay(opt.val)}
                  style={{
                    padding: 20, cursor: "pointer", textAlign: "center",
                    borderColor: overlay === opt.val ? "rgba(232,54,79,.4)" : undefined,
                    background: overlay === opt.val ? "rgba(232,54,79,.04)" : undefined,
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{opt.emoji}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{opt.title}</div>
                  <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>{opt.desc}</div>
                </div>
              ))}
            </div>

            {overlay && (
              <div className="anim-pop" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "block" }}>What text?</label>
                {["Abedin Tech — Redefined", "Elevate Your Style", "Ready For Something New?"].map(t => (
                  <div key={t} className="card card-sm hover-card" style={{ padding: "12px 16px", marginBottom: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>{t}</div>
                ))}
                <input className="input" placeholder="Or type your own text..." style={{ marginTop: 8 }} />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>{SVGIcons.arrowLeft("#9CA3AF", 14)} Back</button>
              <button className="btn btn-main btn-sm" onClick={() => setStep(3)}>Create my image {SVGIcons.arrowRight("#fff", 14)}</button>
            </div>
          </div>
        )}

        {/* STEP 3: Generate / Upload */}
        {step === 3 && (
          <div>
            {source === "upload" ? (
              <div style={{ textAlign: "center", padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Upload your image</h3>
                <div style={{
                  width: 200, height: 180, margin: "20px auto", borderRadius: 18,
                  border: "2px dashed rgba(255,255,255,.15)", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
                }}>
                  <span style={{ fontSize: 36 }}>📁</span>
                  <span style={{ fontSize: 14, color: "#9CA3AF" }}>Click to choose a file</span>
                  <span style={{ fontSize: 12, color: "#4B5563" }}>PNG or JPG, up to 10MB</span>
                </div>
              </div>
            ) : (
              <>
                {gen === "idle" && (
                  <div style={{ textAlign: "center" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Ready to create!</h3>
                    <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 6 }}>
                      Style: <strong>{style}</strong> · Engine: <strong>{provider}</strong> {overlay ? "· With text overlay" : ""}
                    </p>
                    <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
                      This will use about 50 diamonds from your balance.
                    </p>
                    <button className="btn btn-main" onClick={doGenerate} style={{ padding: "16px 32px", fontSize: 16 }}>
                      ✨ Create my image
                    </button>
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => setStep(1)}>← Change settings</button>
                    </div>
                  </div>
                )}

                {gen === "working" && (
                  <div style={{ textAlign: "center", padding: 24 }}>
                    <div style={{ fontSize: 48, marginBottom: 12, animation: "float 2s ease-in-out infinite" }}>✨</div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Creating your image...</div>
                    <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>This usually takes about 10-20 seconds</div>
                    <div className="progress-track" style={{ maxWidth: 280, margin: "0 auto" }}>
                      <div style={{
                        height: 8, borderRadius: 4, width: "100%",
                        background: "linear-gradient(90deg, #E8364F, #8B5CF6, #E8364F)",
                        backgroundSize: "400px 0", animation: "shimmer 1.5s linear infinite",
                      }} />
                    </div>
                  </div>
                )}

                {gen === "done" && (
                  <div className="anim-pop" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: "#10B981" }}>Image created!</h3>
                    <div style={{
                      width: "100%", height: 180, borderRadius: 16, margin: "16px 0",
                      background: "linear-gradient(135deg, #1A1A2E, #2A1A3E, #1A2A3E)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}>
                      <span style={{ fontSize: 14, color: "#6B7280" }}>(image preview would appear here)</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                      <button className="btn btn-main btn-sm">✓ Looks great, use it!</button>
                      <button className="btn btn-soft btn-sm" onClick={() => { setGen("idle"); doGenerate(); }}>🔄 Try again</button>
                      <button className="btn btn-soft btn-sm" onClick={() => { setStep(1); setGen("idle"); }}>🎨 Change style</button>
                      <button className="btn btn-soft btn-sm" onClick={() => { setSource("upload"); setGen("idle"); }}>📁 Upload my own instead</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Post progress */}
      <div className="card card-sm" style={{ padding: "12px 18px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#6B7280" }}>Images done: {0} of {posts.length}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {posts.map((_, i) => (
              <div key={i} style={{
                width: 32, height: 6, borderRadius: 3,
                background: i < 0 ? "#10B981" : "rgba(255,255,255,.08)",
                transition: "background .3s ease",
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-ghost">{SVGIcons.arrowLeft("#9CA3AF", 16)} Back</button>
        <button className="btn btn-main" disabled onClick={onNext}>
          Continue to posting {SVGIcons.arrowRight("#fff", 16)}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function SellantoDashboardV2() {
  const [page, setPage] = useState("welcome");
  const [onbStep, setOnbStep] = useState(0);
  const [done, setDone] = useState(new Set());
  const [diamonds] = useState(9803);
  const [key, setKey] = useState(0);

  const stepLabels = ["Strategy", "Ideas", "Captions", "Media", "Post", "Calendar"];
  const pages = ["welcome", "brand", "trending", "ideas", "media"];

  const goNext = () => {
    const idx = pages.indexOf(page);
    if (idx < pages.length - 1) {
      const newDone = new Set(done);
      newDone.add(onbStep);
      setDone(newDone);
      setOnbStep(s => Math.min(s + 1, stepLabels.length - 1));
      setPage(pages[idx + 1]);
      setKey(k => k + 1);
    }
  };

  const renderPage = () => {
    switch (page) {
      case "welcome": return <WelcomePage onStart={() => { setPage("brand"); setKey(k => k + 1); }} />;
      case "brand": return <BrandDNAPage onNext={goNext} />;
      case "trending": return <TrendingPage onNext={goNext} diamonds={diamonds} />;
      case "ideas": return <IdeasPage onNext={goNext} />;
      case "media": return <MediaPage onNext={goNext} />;
      default: return <WelcomePage onStart={() => setPage("brand")} />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0C0C18" }}>
      <style>{css}</style>
      <Sidebar page={page} go={setPage} />
      <div style={{ flex: 1, marginLeft: 240 }}>
        <TopBar diamonds={diamonds} />
        <div style={{ padding: "24px 32px" }}>
          {/* Header + Stepper */}
          {page !== "welcome" && (
            <>
              <div className="anim-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#E8364F", letterSpacing: "-.3px" }}>Setting Up Your Content Pipeline</h1>
                  <p style={{ fontSize: 14, color: "#6B7280" }}>Follow along — we'll guide you through each step</p>
                </div>
                <button className="btn btn-ghost" onClick={() => setPage("welcome")}>
                  ← Back to overview
                </button>
              </div>
              <Stepper steps={stepLabels} current={onbStep} done={done} />

              {/* Sub-tabs for Strategy */}
              {page === "brand" && (
                <div className="anim-up" style={{ display: "flex", gap: 4, marginBottom: 18, background: "#14142A", borderRadius: 12, padding: 4, width: "fit-content" }}>
                  {["Brand DNA", "Pillars", "Competitors", "Trending"].map((t, i) => (
                    <button
                      key={t}
                      onClick={() => { if (i === 3) { setPage("trending"); setKey(k => k + 1); } }}
                      style={{
                        padding: "10px 20px", borderRadius: 10, border: "none",
                        background: i === 0 ? "rgba(232,54,79,.1)" : "transparent",
                        color: i === 0 ? "#E8364F" : "#6B7280",
                        fontWeight: i === 0 ? 700 : 500, fontSize: 13,
                        cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                        display: "flex", alignItems: "center", gap: 6,
                        transition: "all .2s ease",
                      }}
                    >
                      {i < 2 && SVGIcons.checkCircle("#10B981", 13)}
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div key={key}>{renderPage()}</div>
        </div>
      </div>
    </div>
  );
}
