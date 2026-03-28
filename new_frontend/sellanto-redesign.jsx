import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Compass, Lightbulb, PenTool, Image, Sparkles, Calendar,
  Link2, BarChart3, Bot, MessageSquare, User, Building2, Settings,
  ChevronDown, ChevronRight, Search, Bell, MessageCircle, Diamond,
  CheckCircle2, Circle, ArrowRight, ArrowLeft, ExternalLink, Plus,
  Edit3, Trash2, RefreshCw, Check, X, Upload, Wand2, Eye, SkipForward,
  AlertTriangle, Info, Zap, Target, TrendingUp, Globe, Hash,
  ThumbsUp, ThumbsDown, Copy, Palette, Type, Shield, Star, Crown,
  ChevronUp, MoreHorizontal, GripVertical, Play, Pause, Volume2
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════
const theme = {
  bg: {
    primary: "#0D0D14",
    secondary: "#13131E",
    tertiary: "#1A1A2E",
    card: "#16162A",
    cardHover: "#1C1C36",
    elevated: "#1F1F3A",
    overlay: "rgba(0,0,0,0.6)",
  },
  accent: {
    coral: "#E8364F",
    coralHover: "#FF4D66",
    coralMuted: "rgba(232,54,79,0.15)",
    blue: "#3B82F6",
    blueHover: "#60A5FA",
    blueMuted: "rgba(59,130,246,0.12)",
    green: "#10B981",
    greenMuted: "rgba(16,185,129,0.12)",
    amber: "#F59E0B",
    amberMuted: "rgba(245,158,11,0.12)",
    purple: "#8B5CF6",
    purpleMuted: "rgba(139,92,246,0.12)",
  },
  text: {
    primary: "#F1F1F6",
    secondary: "#9CA3AF",
    muted: "#6B7280",
    inverse: "#0D0D14",
  },
  border: {
    default: "rgba(255,255,255,0.06)",
    hover: "rgba(255,255,255,0.12)",
    active: "rgba(232,54,79,0.4)",
  },
};

// ═══════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: ${theme.bg.primary}; color: ${theme.text.primary}; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes progressFill { from { width: 0; } }
  @keyframes bounceIn { 0% { transform: scale(0); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
  @keyframes ripple { 0% { transform: scale(0); opacity: 0.5; } 100% { transform: scale(4); opacity: 0; } }

  .animate-in { animation: fadeIn 0.4s ease-out forwards; }
  .animate-in-delay-1 { animation: fadeIn 0.4s ease-out 0.05s forwards; opacity: 0; }
  .animate-in-delay-2 { animation: fadeIn 0.4s ease-out 0.1s forwards; opacity: 0; }
  .animate-in-delay-3 { animation: fadeIn 0.4s ease-out 0.15s forwards; opacity: 0; }
  .animate-in-delay-4 { animation: fadeIn 0.4s ease-out 0.2s forwards; opacity: 0; }
  .animate-in-delay-5 { animation: fadeIn 0.4s ease-out 0.25s forwards; opacity: 0; }

  .slide-right { animation: slideInRight 0.35s ease-out forwards; }
  .slide-left { animation: slideInLeft 0.35s ease-out forwards; }
  .scale-in { animation: scaleIn 0.3s ease-out forwards; }
  .bounce-in { animation: bounceIn 0.4s ease-out forwards; }

  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }

  .hover-glow { transition: all 0.2s ease; }
  .hover-glow:hover { box-shadow: 0 0 20px rgba(232,54,79,0.15); border-color: rgba(232,54,79,0.3) !important; }

  .btn-primary {
    background: linear-gradient(135deg, #E8364F, #D42E45);
    color: white; border: none; padding: 10px 20px; border-radius: 10px;
    font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex;
    align-items: center; gap: 8px; transition: all 0.2s ease; font-family: 'DM Sans', sans-serif;
  }
  .btn-primary:hover { background: linear-gradient(135deg, #FF4D66, #E8364F); transform: translateY(-1px); box-shadow: 0 4px 15px rgba(232,54,79,0.4); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

  .btn-secondary {
    background: rgba(255,255,255,0.06); color: ${theme.text.primary}; border: 1px solid rgba(255,255,255,0.1);
    padding: 10px 20px; border-radius: 10px; font-weight: 500; font-size: 14px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: 'DM Sans', sans-serif;
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }

  .btn-ghost {
    background: transparent; color: ${theme.text.secondary}; border: none;
    padding: 8px 14px; border-radius: 8px; font-weight: 500; font-size: 13px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: all 0.2s ease; font-family: 'DM Sans', sans-serif;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.06); color: ${theme.text.primary}; }

  .card {
    background: ${theme.bg.card}; border: 1px solid ${theme.border.default};
    border-radius: 14px; padding: 20px; transition: all 0.25s ease;
  }
  .card:hover { border-color: ${theme.border.hover}; }

  .badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
    border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
  }

  .tooltip-container { position: relative; }
  .tooltip-container .tooltip-text {
    visibility: hidden; opacity: 0; position: absolute; bottom: calc(100% + 8px);
    left: 50%; transform: translateX(-50%); background: ${theme.bg.elevated};
    color: ${theme.text.primary}; padding: 6px 12px; border-radius: 8px;
    font-size: 12px; white-space: nowrap; z-index: 100;
    border: 1px solid ${theme.border.hover}; transition: all 0.15s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .tooltip-container:hover .tooltip-text { visibility: visible; opacity: 1; }

  .progress-bar-track {
    height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%; border-radius: 2px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .input-field {
    width: 100%; background: rgba(255,255,255,0.04); border: 1px solid ${theme.border.default};
    border-radius: 10px; padding: 10px 14px; color: ${theme.text.primary};
    font-size: 14px; font-family: 'DM Sans', sans-serif; transition: all 0.2s ease;
    outline: none;
  }
  .input-field:focus { border-color: ${theme.accent.coral}; box-shadow: 0 0 0 3px ${theme.accent.coralMuted}; }
  .input-field::placeholder { color: ${theme.text.muted}; }

  .chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px;
    border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer;
    border: 1px solid ${theme.border.default}; background: transparent;
    color: ${theme.text.secondary}; transition: all 0.2s ease;
  }
  .chip:hover { border-color: ${theme.border.hover}; color: ${theme.text.primary}; background: rgba(255,255,255,0.04); }
  .chip.active { border-color: ${theme.accent.coral}; color: ${theme.accent.coral}; background: ${theme.accent.coralMuted}; }

  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 10px;
    color: ${theme.text.secondary}; cursor: pointer; transition: all 0.2s ease;
    font-size: 13.5px; font-weight: 450; position: relative;
  }
  .nav-item:hover { background: rgba(255,255,255,0.04); color: ${theme.text.primary}; }
  .nav-item.active { background: ${theme.accent.coralMuted}; color: ${theme.accent.coral}; font-weight: 600; }

  .stepper-line {
    height: 3px; flex: 1; border-radius: 2px; transition: background 0.5s ease;
  }

  .tab-btn {
    padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 500;
    cursor: pointer; border: none; background: transparent; color: ${theme.text.muted};
    transition: all 0.2s ease; font-family: 'DM Sans', sans-serif;
  }
  .tab-btn:hover { color: ${theme.text.primary}; background: rgba(255,255,255,0.04); }
  .tab-btn.active { background: ${theme.accent.coralMuted}; color: ${theme.accent.coral}; font-weight: 600; }
`;

// ═══════════════════════════════════════════════════════════════
// SIDEBAR COMPONENT
// ═══════════════════════════════════════════════════════════════
function Sidebar({ currentPage, onNavigate }) {
  const [expandedItems, setExpandedItems] = useState({});
  const toggle = (key) => setExpandedItems(p => ({ ...p, [key]: !p[key] }));

  const mainNav = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "strategy", icon: Compass, label: "Strategy Hub", expandable: true, sub: ["Brand DNA", "Pillars", "Competitors", "Trending"] },
    { id: "ideas", icon: Lightbulb, label: "Ideas Hub", expandable: true },
    { id: "create", icon: PenTool, label: "Create Post", expandable: true },
    { id: "calendar", icon: Calendar, label: "Calendar" },
    { id: "connect", icon: Link2, label: "Connect Account" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
  ];

  const aiTools = [
    { id: "caption", icon: Type, label: "AI Caption" },
    { id: "image", icon: Image, label: "AI Image" },
    { id: "video", icon: Play, label: "AI Video" },
    { id: "voice", icon: Volume2, label: "AI Voice" },
    { id: "messenger", icon: MessageSquare, label: "Messenger Bot" },
  ];

  const settingsNav = [
    { id: "profile", icon: User, label: "Profile" },
    { id: "business", icon: Building2, label: "Business Profile" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div style={{
      width: 230, height: "100vh", background: theme.bg.secondary,
      borderRight: `1px solid ${theme.border.default}`, display: "flex",
      flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 50,
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `linear-gradient(135deg, ${theme.accent.coral}, #FF6B81)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color: "white",
        }}>S</div>
        <span style={{ fontSize: 18, fontWeight: 700, color: theme.text.primary, letterSpacing: "-0.3px" }}>Sellanto</span>
      </div>

      {/* Main Nav */}
      <div style={{ padding: "0 10px", flex: 1 }}>
        {mainNav.map(item => (
          <div key={item.id}>
            <div
              className={`nav-item ${currentPage === item.id ? "active" : ""}`}
              onClick={() => { onNavigate(item.id); if (item.expandable) toggle(item.id); }}
            >
              <item.icon size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.expandable && (
                <ChevronDown size={14} style={{
                  transform: expandedItems[item.id] ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 0.2s ease",
                }} />
              )}
            </div>
            {item.expandable && expandedItems[item.id] && item.sub && (
              <div style={{ paddingLeft: 36, marginTop: 2 }}>
                {item.sub.map(s => (
                  <div key={s} className="nav-item" style={{ padding: "6px 10px", fontSize: 12.5 }}>{s}</div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ padding: "12px 14px 6px", fontSize: 10.5, fontWeight: 700, color: theme.text.muted, letterSpacing: "1.2px", textTransform: "uppercase" }}>
          AI Tools
        </div>
        {aiTools.map(item => (
          <div key={item.id} className="nav-item" onClick={() => onNavigate(item.id)}>
            <item.icon size={17} />
            <span>{item.label}</span>
          </div>
        ))}

        <div style={{ padding: "14px 14px 6px", fontSize: 10.5, fontWeight: 700, color: theme.text.muted, letterSpacing: "1.2px", textTransform: "uppercase" }}>
          Settings
        </div>
        {settingsNav.map(item => (
          <div key={item.id} className="nav-item" onClick={() => onNavigate(item.id)}>
            <item.icon size={17} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════
function TopBar({ diamonds }) {
  return (
    <div style={{
      height: 56, background: theme.bg.secondary,
      borderBottom: `1px solid ${theme.border.default}`,
      display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
      position: "sticky", top: 0, zIndex: 40,
    }}>
      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 14px",
        border: `1px solid ${theme.border.default}`,
      }}>
        <Search size={15} color={theme.text.muted} />
        <span style={{ fontSize: 13, color: theme.text.muted }}>Search...</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Diamond Balance */}
      <div className="tooltip-container" style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(16,185,129,0.08)", padding: "6px 14px",
        borderRadius: 20, border: "1px solid rgba(16,185,129,0.2)",
        cursor: "pointer",
      }}>
        <Diamond size={14} color={theme.accent.green} fill={theme.accent.green} />
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.accent.green }}>{diamonds.toLocaleString()}</span>
        <div className="tooltip-text" style={{ width: 200, whiteSpace: "normal", textAlign: "center" }}>
          Diamond tokens power AI features.<br />Image gen: ~50 · Captions: ~20 · Trends: ~100
        </div>
      </div>

      <div style={{ position: "relative", cursor: "pointer", padding: 6 }}>
        <Bell size={18} color={theme.text.secondary} />
        <div style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: theme.accent.coral }} />
      </div>

      <MessageCircle size={18} color={theme.text.secondary} style={{ cursor: "pointer" }} />

      <div style={{
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
        padding: "4px 10px 4px 4px", borderRadius: 10,
        transition: "background 0.2s", 
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `linear-gradient(135deg, ${theme.accent.blue}, ${theme.accent.purple})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: "white",
        }}>AB</div>
        <span style={{ fontSize: 13, fontWeight: 500, color: theme.text.primary }}>abedintech</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONBOARDING STEPPER
// ═══════════════════════════════════════════════════════════════
function OnboardingStepper({ steps, currentStep, completedSteps, onStepClick }) {
  return (
    <div className="card animate-in" style={{ padding: "16px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div
              onClick={() => onStepClick(i)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                cursor: "pointer", minWidth: 70, transition: "all 0.2s ease",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: completedSteps.includes(i) ? theme.accent.greenMuted
                  : currentStep === i ? theme.accent.coralMuted : "rgba(255,255,255,0.04)",
                border: `2px solid ${completedSteps.includes(i) ? theme.accent.green
                  : currentStep === i ? theme.accent.coral : theme.border.default}`,
                transition: "all 0.3s ease",
              }}>
                {completedSteps.includes(i) ? (
                  <CheckCircle2 size={18} color={theme.accent.green} className="bounce-in" />
                ) : (
                  <step.icon size={16} color={currentStep === i ? theme.accent.coral : theme.text.muted} />
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: currentStep === i ? 600 : 450,
                color: currentStep === i ? theme.text.primary : theme.text.muted,
                transition: "all 0.2s ease",
              }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="stepper-line" style={{
                margin: "0 6px", marginBottom: 20,
                background: completedSteps.includes(i)
                  ? `linear-gradient(90deg, ${theme.accent.green}, ${completedSteps.includes(i + 1) ? theme.accent.green : theme.border.default})`
                  : theme.border.default,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: GETTING STARTED (NEW - replaces Business Profile)
// ═══════════════════════════════════════════════════════════════
function GettingStartedPage({ onStartSetup }) {
  const checklist = [
    { id: "brand", label: "Set up Brand DNA", desc: "AI analyzes your website to understand your brand", done: true, icon: Globe },
    { id: "pillars", label: "Define Content Pillars", desc: "Strategic themes for your content", done: true, icon: Target },
    { id: "competitors", label: "Add Competitors", desc: "Get AI-powered competitive insights", done: false, icon: Shield },
    { id: "trends", label: "Discover Trending Topics", desc: "Find relevant topics in your industry", done: false, icon: TrendingUp },
    { id: "connect", label: "Connect Social Accounts", desc: "Link your social media platforms", done: false, icon: Link2 },
    { id: "firstpost", label: "Create Your First Post", desc: "Generate and schedule AI-powered content", done: false, icon: PenTool },
  ];

  const doneCount = checklist.filter(c => c.done).length;
  const progress = (doneCount / checklist.length) * 100;

  return (
    <div>
      {/* Welcome Header */}
      <div className="animate-in" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          Welcome to Sellanto
          <span style={{ marginLeft: 8, display: "inline-block", animation: "bounceIn 0.6s ease 0.3s both" }}>👋</span>
        </h1>
        <p style={{ color: theme.text.secondary, fontSize: 15 }}>
          Let's set up your content pipeline. Complete these steps to start publishing AI-powered content.
        </p>
      </div>

      {/* Progress */}
      <div className="card animate-in-delay-1" style={{ marginBottom: 20, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Setup Progress</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.accent.green }}>{doneCount}/{checklist.length} complete</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${theme.accent.green}, ${theme.accent.blue})`,
            animation: "progressFill 1s ease-out",
          }} />
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {checklist.map((item, i) => {
          const isNext = !item.done && checklist.findIndex(c => !c.done) === i;
          return (
            <div
              key={item.id}
              className={`card hover-lift animate-in-delay-${Math.min(i + 1, 5)}`}
              style={{
                padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                borderColor: isNext ? theme.accent.coral : undefined,
                background: isNext ? "rgba(232,54,79,0.04)" : undefined,
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: item.done ? theme.accent.greenMuted : isNext ? theme.accent.coralMuted : "rgba(255,255,255,0.04)",
                transition: "all 0.3s ease",
              }}>
                {item.done ? (
                  <CheckCircle2 size={18} color={theme.accent.green} />
                ) : (
                  <item.icon size={16} color={isNext ? theme.accent.coral : theme.text.muted} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: item.done ? theme.text.muted : theme.text.primary }}>
                  {item.label}
                  {item.done && <span style={{ marginLeft: 8, fontSize: 11, color: theme.accent.green }}>✓ Done</span>}
                </div>
                <div style={{ fontSize: 12.5, color: theme.text.muted, marginTop: 2 }}>{item.desc}</div>
              </div>
              {isNext && (
                <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }} onClick={onStartSetup}>
                  Continue <ArrowRight size={14} />
                </button>
              )}
              {!item.done && !isNext && <ChevronRight size={16} color={theme.text.muted} />}
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="animate-in-delay-5" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Brand DNA", value: "Ready", color: theme.accent.green, icon: Globe },
          { label: "Social Accounts", value: "0 connected", color: theme.accent.amber, icon: Link2 },
          { label: "Posts Created", value: "0 posts", color: theme.text.muted, icon: PenTool },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: 16, textAlign: "center" }}>
            <stat.icon size={20} color={stat.color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: theme.text.muted, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: BRAND DNA REVIEW (FIXED STATES)
// ═══════════════════════════════════════════════════════════════
function BrandDNAPage({ onNext }) {
  const [dnaState, setDnaState] = useState("success"); // success | partial | failed
  const [editingSection, setEditingSection] = useState(null);

  const brandData = {
    name: "Abedin Tech", industry: "SaaS and digital marketing agency",
    voice: "Professional", description: "Abedin Tech is a SaaS and digital marketing agency brand targeting USA.",
    audience: "Business owners interested in SaaS and digital marketing",
    cta: "Learn more",
    products: ["SaaS", "Digital Marketing", "SEO", "Web Design"],
    themes: ["Revenue Growth", "Traffic & Conversion", "Industry Insights"],
    keywords: ["abedin tech", "digital marketing agency", "saas platform"],
  };

  const stateConfig = {
    success: { color: theme.accent.green, bg: theme.accent.greenMuted, label: "Analysis Complete", icon: CheckCircle2, msg: "Brand DNA successfully extracted from abedintech.com" },
    partial: { color: theme.accent.amber, bg: theme.accent.amberMuted, label: "Partial Analysis", icon: AlertTriangle, msg: "Some fields could not be extracted. Please review and complete the missing information." },
    failed: { color: theme.accent.coral, bg: theme.accent.coralMuted, label: "Analysis Failed", icon: X, msg: "We couldn't analyze your website. Please enter your brand information manually." },
  };

  const sc = stateConfig[dnaState];

  return (
    <div>
      <div className="animate-in" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Globe size={20} color={theme.accent.coral} />
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Brand DNA</h2>
        </div>
        <p style={{ color: theme.text.secondary, fontSize: 14 }}>
          This information drives your AI-generated ideas, captions, images, and scheduling strategy.
        </p>
      </div>

      {/* State Banner */}
      <div className="animate-in-delay-1" style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
        borderRadius: 12, marginBottom: 16,
        background: sc.bg, border: `1px solid ${sc.color}30`,
      }}>
        <sc.icon size={18} color={sc.color} />
        <div style={{ flex: 1 }}>
          <span className="badge" style={{ background: `${sc.color}20`, color: sc.color, marginBottom: 4 }}>{sc.label}</span>
          <div style={{ fontSize: 13, color: theme.text.secondary, marginTop: 4 }}>{sc.msg}</div>
        </div>
        {dnaState !== "success" && (
          <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: 12 }}>
            <RefreshCw size={13} /> Reanalyze
          </button>
        )}
      </div>

      {/* Demo state toggle */}
      <div className="animate-in-delay-1" style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: theme.text.muted, alignSelf: "center", marginRight: 4 }}>Demo states:</span>
        {["success", "partial", "failed"].map(s => (
          <button key={s} className={`chip ${dnaState === s ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => setDnaState(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Brand Identity Section */}
      {dnaState !== "failed" && (
        <div className="card animate-in-delay-2 hover-glow" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={16} color={theme.accent.blue} /> Brand Identity
            </h3>
            <button className="btn-ghost" onClick={() => setEditingSection(editingSection === "identity" ? null : "identity")}>
              <Edit3 size={13} /> Edit Brand Identity
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Brand Name", value: brandData.name },
              { label: "Industry", value: brandData.industry },
              { label: "Brand Voice", value: brandData.voice },
              { label: "CTA Style", value: brandData.cta },
            ].map(field => (
              <div key={field.label}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: theme.text.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>{field.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: theme.text.primary }}>{field.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: theme.text.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Description</div>
            <div style={{ fontSize: 14, color: theme.text.secondary, lineHeight: 1.5 }}>{brandData.description}</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: theme.text.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Target Audience</div>
            <div style={{ fontSize: 14, color: theme.text.secondary }}>{brandData.audience}</div>
          </div>
        </div>
      )}

      {/* Products, Themes, Keywords */}
      {dnaState !== "failed" && (
        <div className="animate-in-delay-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          {[
            { label: "Products & Services", items: brandData.products, icon: Zap, color: theme.accent.purple },
            { label: "Content Themes", items: brandData.themes, icon: Hash, color: theme.accent.coral },
            { label: "Keywords", items: brandData.keywords, icon: Search, color: theme.accent.blue },
          ].map(section => (
            <div key={section.label} className="card hover-glow">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <section.icon size={14} color={section.color} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{section.label}</span>
                </div>
                <button className="btn-ghost" style={{ padding: "4px 8px" }}><Edit3 size={12} /></button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {section.items.map(item => (
                  <span key={item} className="badge" style={{ background: `${section.color}15`, color: section.color }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brand Logo */}
      <div className="card animate-in-delay-4 hover-glow" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12, border: `2px dashed ${theme.border.hover}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.02)",
          }}>
            <Image size={24} color={theme.text.muted} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Brand Logo</div>
            <div style={{ fontSize: 12.5, color: theme.text.secondary }}>
              Upload your logo (PNG) for AI image generation. Images generated without a logo may look incomplete.
            </div>
          </div>
          <button className="btn-secondary" style={{ padding: "8px 16px" }}>
            <Upload size={14} /> Upload Logo
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn-ghost"><ArrowLeft size={14} /> Previous</button>
        <button className="btn-primary" onClick={onNext}>
          Continue to Pillars <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: TRENDING TOPICS (FIXED TOKEN + SELECTION)
// ═══════════════════════════════════════════════════════════════
function TrendingTopicsPage({ onNext, diamonds }) {
  const [viewState, setViewState] = useState("selection"); // blocked | selection
  const [selectedTopics, setSelectedTopics] = useState(new Set([0, 1, 2, 4, 6]));

  const topics = [
    { title: "AI-powered SEO tools for small businesses in 2026", heat: "Hot", desc: "AI integration in SEO is dominating digital marketing discussions.", angle: "Position as experts in AI-driven SEO strategies" },
    { title: "March 2026 Google algorithm update impact", heat: "Hot", desc: "Algorithm updates create immediate demand for SEO expertise.", angle: "Provide timely guidance on adapting strategies" },
    { title: "Revenue optimization strategies for Q2 2026", heat: "Rising", desc: "March is prime planning season for Q2 budgets.", angle: "Target decision-makers preparing quarterly strategies" },
    { title: "Digital marketing budget allocation for economic uncertainty", heat: "Rising", desc: "Economic concerns drive businesses to optimize spend.", angle: "Demonstrate ROI-focused strategies and cost-effective solutions" },
    { title: "Local SEO trends driving foot traffic in spring 2026", heat: "Rising", desc: "Spring season brings increased local business activity.", angle: "Showcase expertise in local SEO and traffic generation" },
    { title: "Conversion rate optimization tactics for e-commerce", heat: "Rising", desc: "CRO remains a high-priority concern for online businesses.", angle: "Address core client pain points in conversion" },
    { title: "Website redesign trends boosting lead generation", heat: "Rising", desc: "Web design trends directly impact lead generation success.", angle: "Showcase web design services with measurable results" },
    { title: "Digital marketing agency selection criteria checklist", heat: "Rising", desc: "Red flags when choosing a digital marketing agency.", angle: "Educational content positioning expertise" },
    { title: "Global digital marketing trends affecting US small businesses", heat: "Emerging", desc: "Which global trends will impact US small businesses most?", angle: "Interactive content connecting global trends to specific impacts" },
  ];

  const toggleTopic = (i) => {
    const next = new Set(selectedTopics);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedTopics(next);
  };

  const heatColors = { Hot: theme.accent.coral, Rising: theme.accent.amber, Emerging: theme.accent.blue };
  const minRequired = 3;
  const maxRecommended = 10;

  return (
    <div>
      <div className="animate-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <TrendingUp size={20} color={theme.accent.coral} />
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Trending Topics</h2>
          </div>
          <p style={{ color: theme.text.secondary, fontSize: 14 }}>
            Select {minRequired}-{maxRecommended} topics relevant to your brand. These drive your content ideas.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 11, color: theme.text.muted, alignSelf: "center" }}>Demo:</span>
          <button className={`chip ${viewState === "blocked" ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => setViewState("blocked")}>Blocked</button>
          <button className={`chip ${viewState === "selection" ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => setViewState("selection")}>Selection</button>
        </div>
      </div>

      {/* BLOCKED STATE */}
      {viewState === "blocked" && (
        <div className="slide-right">
          <div className="card" style={{ padding: 24, textAlign: "center", borderColor: `${theme.accent.amber}30` }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
              background: theme.accent.amberMuted,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Diamond size={24} color={theme.accent.amber} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>More Diamond Tokens Needed</h3>
            <p style={{ color: theme.text.secondary, fontSize: 14, lineHeight: 1.6, marginBottom: 16, maxWidth: 440, margin: "0 auto 16px" }}>
              Generating trending topics costs <strong style={{ color: theme.accent.amber }}>100 diamonds</strong>. Your current balance is <strong style={{ color: theme.accent.green }}>{diamonds.toLocaleString()} diamonds</strong>, but your <strong>Free plan</strong> requires a Pro upgrade for this feature.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24 }}>
              <button className="btn-primary" style={{ background: `linear-gradient(135deg, ${theme.accent.purple}, ${theme.accent.blue})` }}>
                <Crown size={14} /> Upgrade to Pro
              </button>
              <button className="btn-secondary">View Plans</button>
            </div>

            <div style={{ borderTop: `1px solid ${theme.border.default}`, paddingTop: 20, marginTop: 4 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Or add your own topics</h4>
              <p style={{ color: theme.text.muted, fontSize: 13, marginBottom: 14 }}>
                Continue by entering topics manually — they'll work alongside AI trends.
              </p>
              <div style={{ display: "flex", gap: 8, maxWidth: 480, margin: "0 auto" }}>
                <input className="input-field" placeholder="e.g., AI marketing tools for small businesses" style={{ flex: 1 }} />
                <button className="btn-primary" style={{ padding: "10px 18px" }}>
                  <Plus size={14} /> Add Topic
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
                {["SEO tips 2026", "Content marketing ROI", "Social media trends"].map(ex => (
                  <button key={ex} className="chip" style={{ fontSize: 11 }}>
                    <Plus size={10} /> {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SELECTION STATE */}
      {viewState === "selection" && (
        <div className="slide-right">
          {/* Selection Bar */}
          <div className="card animate-in" style={{
            padding: "10px 16px", marginBottom: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 14, fontWeight: 600,
                color: selectedTopics.size >= minRequired ? theme.accent.green : theme.accent.amber,
              }}>
                {selectedTopics.size} selected
              </span>
              <span style={{ fontSize: 12, color: theme.text.muted }}>
                (select {minRequired}-{maxRecommended} to continue)
              </span>
              <div style={{ width: 100, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                <div style={{
                  width: `${Math.min(100, (selectedTopics.size / maxRecommended) * 100)}%`,
                  height: "100%", borderRadius: 2, transition: "width 0.3s ease",
                  background: selectedTopics.size >= minRequired ? theme.accent.green : theme.accent.amber,
                }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => setSelectedTopics(new Set(topics.map((_, i) => i)))}>Select All</button>
              <button className="btn-ghost"><RefreshCw size={13} /> Refresh Topics</button>
            </div>
          </div>

          {/* Topic Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {topics.map((topic, i) => {
              const isSelected = selectedTopics.has(i);
              return (
                <div
                  key={i}
                  className={`card hover-lift animate-in-delay-${Math.min(i % 5 + 1, 5)}`}
                  onClick={() => toggleTopic(i)}
                  style={{
                    padding: 16, cursor: "pointer",
                    borderColor: isSelected ? `${theme.accent.coral}50` : undefined,
                    background: isSelected ? "rgba(232,54,79,0.04)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span className="badge" style={{
                      background: `${heatColors[topic.heat]}20`,
                      color: heatColors[topic.heat],
                    }}>{topic.heat}</span>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${isSelected ? theme.accent.coral : theme.border.hover}`,
                      background: isSelected ? theme.accent.coral : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}>
                      {isSelected && <Check size={12} color="white" />}
                    </div>
                  </div>
                  <h4 style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 6, color: theme.text.primary }}>{topic.title}</h4>
                  <p style={{ fontSize: 12, color: theme.text.muted, lineHeight: 1.4 }}>{topic.angle}</p>
                </div>
              );
            })}
          </div>

          {/* Manual Add */}
          <div className="card" style={{ padding: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Plus size={16} color={theme.text.muted} />
              <input className="input-field" placeholder="Add your own topic..." style={{ flex: 1, border: "none", background: "transparent", padding: "6px 0" }} />
              <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: 12 }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn-ghost"><ArrowLeft size={14} /> Previous</button>
        <button
          className="btn-primary"
          disabled={viewState === "selection" && selectedTopics.size < minRequired}
          onClick={onNext}
        >
          Continue to Ideas <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: IDEAS REVIEW (MERGED, WITH ACTIONS)
// ═══════════════════════════════════════════════════════════════
function IdeasReviewPage({ onNext }) {
  const [ideas, setIdeas] = useState([
    { id: 1, title: "Q2 2026 Revenue Planning Strategic Framework", desc: "While most agencies are still planning Q1, we're already optimizing our clients' Q2 revenue strategies.", platform: "LinkedIn", format: "carousel", status: "approved", trend: "Revenue optimization strategies" },
    { id: 2, title: "AI SEO Tools Transformation Case Study", desc: "This small business owner was skeptical about AI-powered SEO tools until we showed her the $47K revenue increase.", platform: "Instagram", format: "reel", status: "approved", trend: "AI-powered SEO tools" },
    { id: 3, title: "March 2026 Google Algorithm Update Breakdown", desc: "Google's March 2026 algorithm update just crushed 3 types of local businesses — here's what survived.", platform: "Twitter", format: "thread", status: "pending", trend: "Google algorithm update" },
    { id: 4, title: "Economic Uncertainty Marketing Budget Allocation Guide", desc: "Most businesses are cutting marketing budgets wrong during economic uncertainty.", platform: "LinkedIn", format: "post", status: "pending", trend: "Marketing budget allocation" },
    { id: 5, title: "Spring 2026 Local SEO Foot Traffic Trends", desc: "Local SEO trend alert: 73% more foot traffic from these 4 spring optimization tactics.", platform: "Facebook", format: "infographic", status: "pending", trend: "Local SEO trends" },
  ]);

  const updateStatus = (id, status) => setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  const approvedCount = ideas.filter(i => i.status === "approved").length;

  const platformColors = {
    LinkedIn: "#0A66C2", Instagram: "#E1306C", Twitter: "#1DA1F2", Facebook: "#1877F2", TikTok: "#000000",
  };

  return (
    <div>
      <div className="animate-in" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Lightbulb size={20} color={theme.accent.coral} />
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Content Ideas</h2>
        </div>
        <p style={{ color: theme.text.secondary, fontSize: 14 }}>
          Review, edit, or regenerate ideas. Approve at least 3 to continue to captions.
        </p>
      </div>

      {/* Status Bar */}
      <div className="card animate-in-delay-1" style={{ padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: approvedCount >= 3 ? theme.accent.green : theme.accent.amber }}>
            {approvedCount} approved
          </span>
          <span style={{ fontSize: 12, color: theme.text.muted }}>(approve at least 3 to continue)</span>
        </div>
        <button className="btn-ghost"><RefreshCw size={13} /> Regenerate All</button>
      </div>

      {/* Idea Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {ideas.map((idea, i) => (
          <div
            key={idea.id}
            className={`card hover-glow animate-in-delay-${Math.min(i + 1, 5)}`}
            style={{
              padding: 18,
              borderColor: idea.status === "approved" ? `${theme.accent.green}30` : undefined,
              borderLeft: idea.status === "approved" ? `3px solid ${theme.accent.green}` : undefined,
            }}
          >
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{idea.title}</h4>
                  {idea.status === "approved" && (
                    <span className="badge bounce-in" style={{ background: theme.accent.greenMuted, color: theme.accent.green }}>
                      <CheckCircle2 size={11} /> Approved
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.5, marginBottom: 10 }}>{idea.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge" style={{ background: `${platformColors[idea.platform]}20`, color: platformColors[idea.platform] }}>
                    {idea.platform}
                  </span>
                  <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: theme.text.muted }}>
                    {idea.format}
                  </span>
                  <span style={{ fontSize: 11, color: theme.text.muted }}>
                    from: {idea.trend}
                  </span>
                </div>
              </div>
              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 120 }}>
                {idea.status !== "approved" ? (
                  <button className="btn-primary" style={{ padding: "7px 14px", fontSize: 12, width: "100%" }} onClick={() => updateStatus(idea.id, "approved")}>
                    <Check size={13} /> Approve
                  </button>
                ) : (
                  <button className="btn-ghost" style={{ fontSize: 12, justifyContent: "center", color: theme.text.muted }} onClick={() => updateStatus(idea.id, "pending")}>
                    Undo
                  </button>
                )}
                <button className="btn-ghost" style={{ fontSize: 12, justifyContent: "center" }}>
                  <Edit3 size={12} /> Edit
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, justifyContent: "center" }}>
                  <RefreshCw size={12} /> Regen
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, justifyContent: "center", color: theme.text.muted }}>
                  <SkipForward size={12} /> Skip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn-ghost"><ArrowLeft size={14} /> Previous</button>
        <button className="btn-primary" disabled={approvedCount < 3} onClick={onNext}>
          Continue to Captions <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE: MEDIA GENERATION (MINI-WIZARD)
// ═══════════════════════════════════════════════════════════════
function MediaGenerationPage({ onNext }) {
  const [activePost, setActivePost] = useState(0);
  const [wizardStep, setWizardStep] = useState(0); // 0=source, 1=visual, 2=overlay, 3=generate
  const [mediaSource, setMediaSource] = useState(null); // upload | ai
  const [selectedStyle, setSelectedStyle] = useState("Modern");
  const [selectedProvider, setSelectedProvider] = useState("OpenAI");
  const [textOverlay, setTextOverlay] = useState(false);
  const [genState, setGenState] = useState("idle"); // idle | generating | done | error

  const posts = [
    { title: "Q2 2026 Revenue Planning Strategic Framework", caption: "While most agencies are still planning Q1, we're already optimizing...", done: false },
    { title: "AI SEO Tools Transformation Case Study", caption: "This small business owner was skeptical about AI-powered SEO...", done: false },
    { title: "March 2026 Google Algorithm Update Breakdown", caption: "Google's March 2026 algorithm update just crushed 3 types...", done: false },
  ];

  const wizardSteps = [
    { label: "Choose Source", icon: Upload },
    { label: "Visual Direction", icon: Palette },
    { label: "Text Overlay", icon: Type },
    { label: "Generate & Review", icon: Sparkles },
  ];

  const styles = ["Modern", "Romantic", "Vibrant", "Professional", "Artistic", "Flat Design"];
  const providers = [
    { name: "OpenAI", cost: 50 },
    { name: "Gemini", cost: 40 },
  ];

  const handleGenerate = () => {
    setGenState("generating");
    setTimeout(() => setGenState("done"), 2500);
  };

  return (
    <div>
      <div className="animate-in" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Image size={20} color={theme.accent.coral} />
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Media</h2>
        </div>
        <p style={{ color: theme.text.secondary, fontSize: 14 }}>
          Generate or upload an image for each post. Complete all {posts.length} to proceed.
        </p>
      </div>

      {/* Post Selector */}
      <div className="animate-in-delay-1" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {posts.map((post, i) => (
          <button
            key={i}
            className={`chip ${activePost === i ? "active" : ""}`}
            onClick={() => { setActivePost(i); setWizardStep(0); setMediaSource(null); setGenState("idle"); }}
            style={{ flex: 1, justifyContent: "center", padding: "10px 12px" }}
          >
            {post.done ? <CheckCircle2 size={13} color={theme.accent.green} /> : <Circle size={13} />}
            <span style={{ fontSize: 12 }}>Post {i + 1}</span>
          </button>
        ))}
      </div>

      {/* Active Post Title */}
      <div className="card animate-in-delay-2" style={{ padding: "12px 16px", marginBottom: 14, background: "rgba(255,255,255,0.02)" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{posts[activePost].title}</div>
        <div style={{ fontSize: 12.5, color: theme.text.muted, marginTop: 4 }}>{posts[activePost].caption}</div>
      </div>

      {/* Mini-Wizard Steps */}
      <div className="card animate-in-delay-3" style={{ padding: 6, marginBottom: 14, display: "flex", gap: 2 }}>
        {wizardSteps.map((step, i) => (
          <button
            key={i}
            className={`tab-btn ${wizardStep === i ? "active" : ""}`}
            onClick={() => i <= wizardStep + 1 && setWizardStep(i)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: i > wizardStep + 1 ? 0.3 : 1,
              cursor: i <= wizardStep + 1 ? "pointer" : "default",
            }}
          >
            {i < wizardStep ? (
              <CheckCircle2 size={13} color={theme.accent.green} />
            ) : (
              <step.icon size={13} />
            )}
            <span>{step.label}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="card slide-right" key={`step-${wizardStep}`} style={{ padding: 24, marginBottom: 20, minHeight: 200 }}>
        {/* STEP 0: Source */}
        {wizardStep === 0 && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>How do you want to add media?</h3>
            <p style={{ fontSize: 13, color: theme.text.muted, marginBottom: 18 }}>Choose one method. You can change your mind later.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { id: "upload", icon: Upload, title: "Upload Image", desc: "Use your own image file", cost: null },
                { id: "ai", icon: Wand2, title: "AI Generate", desc: "Create with AI from your caption", cost: "~50 diamonds" },
              ].map(opt => (
                <div
                  key={opt.id}
                  className="card hover-lift"
                  onClick={() => { setMediaSource(opt.id); setWizardStep(opt.id === "upload" ? 3 : 1); }}
                  style={{
                    padding: 20, cursor: "pointer", textAlign: "center",
                    borderColor: mediaSource === opt.id ? theme.accent.coral : undefined,
                    background: mediaSource === opt.id ? "rgba(232,54,79,0.04)" : undefined,
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px",
                    background: theme.accent.coralMuted,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <opt.icon size={22} color={theme.accent.coral} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{opt.title}</div>
                  <div style={{ fontSize: 12.5, color: theme.text.muted }}>{opt.desc}</div>
                  {opt.cost && (
                    <div style={{ marginTop: 8 }}>
                      <span className="badge" style={{ background: theme.accent.amberMuted, color: theme.accent.amber }}>
                        <Diamond size={10} /> {opt.cost}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Visual Direction */}
        {wizardStep === 1 && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Visual Direction</h3>
            <p style={{ fontSize: 13, color: theme.text.muted, marginBottom: 18 }}>Pick a style and AI provider for your image.</p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Image Style</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {styles.map(s => (
                  <button key={s} className={`chip ${selectedStyle === s ? "active" : ""}`} onClick={() => setSelectedStyle(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>AI Provider</label>
              <div style={{ display: "flex", gap: 10 }}>
                {providers.map(p => (
                  <div
                    key={p.name}
                    className={`card hover-lift`}
                    onClick={() => setSelectedProvider(p.name)}
                    style={{
                      padding: "12px 20px", cursor: "pointer", flex: 1, textAlign: "center",
                      borderColor: selectedProvider === p.name ? theme.accent.coral : undefined,
                      background: selectedProvider === p.name ? "rgba(232,54,79,0.04)" : undefined,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: theme.text.muted, marginTop: 2 }}>
                      <Diamond size={10} color={theme.accent.amber} /> {p.cost} diamonds
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Image Description (optional)</label>
              <textarea className="input-field" rows={3} placeholder="AI will auto-generate a description from your caption if left empty..."
                style={{ resize: "vertical", fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-primary" onClick={() => setWizardStep(2)}>
                Next: Text Overlay <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Text Overlay */}
        {wizardStep === 2 && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Text Overlay</h3>
            <p style={{ fontSize: 13, color: theme.text.muted, marginBottom: 18 }}>Add marketing text on top of the generated image (optional).</p>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Include Text on Image</span>
              <div
                onClick={() => setTextOverlay(!textOverlay)}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                  background: textOverlay ? theme.accent.coral : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s ease",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: "white",
                  position: "absolute", top: 3,
                  left: textOverlay ? 23 : 3,
                  transition: "left 0.2s ease",
                }} />
              </div>
            </div>

            {textOverlay && (
              <div className="scale-in">
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Overlay Text</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {["Abedin Tech — Redefined", "Elevate Your Style", "Ready For Something New?", "Shop Now", "Less Is More"].map((text, i) => (
                    <div key={i} className="card hover-lift" style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14 }}>
                      {text}
                    </div>
                  ))}
                </div>
                <input className="input-field" placeholder="Or type custom overlay text..." />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
              <button className="btn-ghost" onClick={() => setWizardStep(1)}>
                <ArrowLeft size={14} /> Back
              </button>
              <button className="btn-primary" onClick={() => setWizardStep(3)}>
                Next: Generate <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Generate & Review */}
        {wizardStep === 3 && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {mediaSource === "upload" ? "Upload Your Image" : "Generate & Review"}
            </h3>

            {mediaSource === "upload" ? (
              <div style={{ textAlign: "center", padding: 32 }}>
                <div style={{
                  width: 200, height: 200, margin: "0 auto 16px", borderRadius: 16,
                  border: `2px dashed ${theme.border.hover}`, display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 8, cursor: "pointer", transition: "all 0.2s ease",
                }}>
                  <Upload size={32} color={theme.text.muted} />
                  <span style={{ fontSize: 13, color: theme.text.muted }}>Click or drag to upload</span>
                  <span style={{ fontSize: 11, color: theme.text.muted }}>PNG, JPG up to 10MB</span>
                </div>
              </div>
            ) : (
              <>
                {/* Prompt Preview */}
                {genState === "idle" && (
                  <div>
                    <p style={{ fontSize: 13, color: theme.text.muted, marginBottom: 16 }}>
                      Your image will be generated using <strong>{selectedProvider}</strong> in <strong>{selectedStyle}</strong> style.
                    </p>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, marginBottom: 16, border: `1px solid ${theme.border.default}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: theme.accent.blue, marginBottom: 6 }}>AI PROMPT PREVIEW</div>
                      <div style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.6 }}>
                        A clean, modern workspace scene with {selectedStyle.toLowerCase()} aesthetics showing a laptop displaying SEO dashboard with colorful analytics charts, professional small business office atmosphere...
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btn-primary" onClick={handleGenerate}>
                        <Sparkles size={14} /> Generate Image
                        <span className="badge" style={{ background: "rgba(255,255,255,0.2)", color: "white", marginLeft: 4 }}>
                          <Diamond size={9} /> 50
                        </span>
                      </button>
                      <button className="btn-ghost" onClick={() => setWizardStep(1)}>
                        <Edit3 size={13} /> Edit Settings
                      </button>
                    </div>
                  </div>
                )}

                {/* Generating */}
                {genState === "generating" && (
                  <div style={{ textAlign: "center", padding: 32 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
                      background: theme.accent.coralMuted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}>
                      <Sparkles size={28} color={theme.accent.coral} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Generating your image...</div>
                    <div style={{ fontSize: 13, color: theme.text.muted }}>Using {selectedProvider} · {selectedStyle} style</div>
                    <div style={{ marginTop: 16, maxWidth: 300, margin: "16px auto 0" }}>
                      <div className="progress-bar-track">
                        <div style={{
                          height: "100%", borderRadius: 2,
                          background: `linear-gradient(90deg, ${theme.accent.coral}, ${theme.accent.purple})`,
                          backgroundSize: "200% 100%",
                          animation: "shimmer 1.5s linear infinite",
                          width: "100%",
                        }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Done */}
                {genState === "done" && (
                  <div className="scale-in">
                    <div style={{
                      width: "100%", height: 220, borderRadius: 14, marginBottom: 16,
                      background: `linear-gradient(135deg, ${theme.bg.tertiary}, ${theme.bg.elevated})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: `1px solid ${theme.border.default}`,
                    }}>
                      <div style={{ textAlign: "center" }}>
                        <CheckCircle2 size={36} color={theme.accent.green} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Image Generated Successfully</div>
                        <div style={{ fontSize: 12, color: theme.text.muted }}>(preview placeholder)</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-primary" style={{ flex: 1 }}>
                        <Check size={14} /> Accept Image
                      </button>
                      <button className="btn-secondary" onClick={handleGenerate}>
                        <RefreshCw size={14} /> Regenerate
                      </button>
                      <button className="btn-secondary" onClick={() => { setWizardStep(1); setGenState("idle"); }}>
                        <Edit3 size={14} /> Edit Prompt
                      </button>
                      <button className="btn-secondary" onClick={() => { setMediaSource("upload"); setGenState("idle"); }}>
                        <Upload size={14} /> Upload Instead
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Post Progress */}
      <div className="card" style={{ padding: "10px 16px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: theme.text.muted }}>{posts.filter(p => p.done).length} of {posts.length} posts have media</span>
          <div style={{ display: "flex", gap: 4 }}>
            {posts.map((p, i) => (
              <div key={i} style={{
                width: 24, height: 4, borderRadius: 2,
                background: p.done ? theme.accent.green : "rgba(255,255,255,0.1)",
                transition: "background 0.3s ease",
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn-ghost"><ArrowLeft size={14} /> Previous</button>
        <button className="btn-primary" disabled={!posts.every(p => p.done)} onClick={onNext}>
          Continue to Post <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function SellantoDashboard() {
  const [currentPage, setCurrentPage] = useState("getting-started");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [diamonds] = useState(9803);
  const [animKey, setAnimKey] = useState(0);

  const onboardingSteps = [
    { label: "Strategy", icon: Compass },
    { label: "Ideas", icon: Lightbulb },
    { label: "Captions", icon: PenTool },
    { label: "Media", icon: Image },
    { label: "Post", icon: Sparkles },
    { label: "Calendar", icon: Calendar },
  ];

  const pages = ["getting-started", "brand-dna", "trending", "ideas", "media"];

  const goNext = () => {
    const idx = pages.indexOf(currentPage);
    if (idx < pages.length - 1) {
      setCurrentPage(pages[idx + 1]);
      setAnimKey(k => k + 1);
      if (!completedSteps.includes(onboardingStep)) {
        setCompletedSteps(prev => [...prev, onboardingStep]);
      }
      if (onboardingStep < onboardingSteps.length - 1) {
        setOnboardingStep(s => s + 1);
      }
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case "getting-started":
        return <GettingStartedPage onStartSetup={() => { setCurrentPage("brand-dna"); setAnimKey(k => k + 1); }} />;
      case "brand-dna":
        return <BrandDNAPage onNext={goNext} />;
      case "trending":
        return <TrendingTopicsPage onNext={goNext} diamonds={diamonds} />;
      case "ideas":
        return <IdeasReviewPage onNext={goNext} />;
      case "media":
        return <MediaGenerationPage onNext={goNext} />;
      default:
        return <GettingStartedPage onStartSetup={() => setCurrentPage("brand-dna")} />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg.primary }}>
      <style>{globalCSS}</style>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div style={{ flex: 1, marginLeft: 230 }}>
        <TopBar diamonds={diamonds} />
        <div style={{ padding: "20px 28px", maxWidth: 920, margin: "0 auto" }}>
          {/* Page Header */}
          {currentPage !== "getting-started" && (
            <>
              <div className="animate-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.accent.coral }}>Get Started</h1>
                  <p style={{ fontSize: 13, color: theme.text.secondary }}>Follow these steps to set up your content pipeline</p>
                </div>
                <button className="btn-ghost" onClick={() => setCurrentPage("getting-started")}>
                  Skip & Go to Dashboard →
                </button>
              </div>
              <OnboardingStepper
                steps={onboardingSteps}
                currentStep={onboardingStep}
                completedSteps={completedSteps}
                onStepClick={(i) => {
                  setOnboardingStep(i);
                  setCurrentPage(pages[Math.min(i + 1, pages.length - 1)]);
                  setAnimKey(k => k + 1);
                }}
              />
            </>
          )}

          {/* Page Tabs */}
          {currentPage === "brand-dna" && (
            <div className="animate-in" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {["Brand DNA", "Pillars", "Competitors", "Trending"].map((tab, i) => (
                <button key={tab} className={`tab-btn ${i === 0 ? "active" : ""}`}
                  onClick={() => { if (i === 3) { setCurrentPage("trending"); setAnimKey(k => k + 1); } }}
                >
                  {i < 2 && <CheckCircle2 size={12} color={theme.accent.green} style={{ marginRight: 4 }} />}
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Page Content */}
          <div key={animKey}>
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}
