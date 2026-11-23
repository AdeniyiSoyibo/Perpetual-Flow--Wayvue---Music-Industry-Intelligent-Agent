"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Disc3, Radio, Music2, Users, Film,
  ArrowRight, Music, Globe, BarChart2, Unlock,
} from "lucide-react";

// ── Animated wave SVG ─────────────────────────────────────────────────────────
function FlowWave() {
  return (
    <svg
      viewBox="0 0 1200 220"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.9" />
          <stop offset="50%"  stopColor="#38bdf8" stopOpacity="1"   />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.6" />
          <stop offset="50%"  stopColor="#a855f7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.5" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Back wave */}
      <path
        d="M0,110 C150,30 300,180 450,110 C600,40 750,170 900,110 C1050,50 1150,140 1200,110 L1200,220 L0,220 Z"
        fill="url(#wave2)"
        opacity="0.4"
        filter="url(#glow)"
      />
      {/* Front wave — the main infinity-flow ribbon */}
      <path
        d="M0,130 C100,60 200,170 350,110 C500,50 580,160 700,110 C820,60 920,160 1050,100 C1120,70 1160,130 1200,110"
        fill="none"
        stroke="url(#wave1)"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#glow)"
      />
      {/* Second ribbon offset */}
      <path
        d="M0,150 C120,80 240,180 380,120 C520,60 620,170 740,115 C860,60 960,160 1100,105 C1150,85 1180,120 1200,100"
        fill="none"
        stroke="url(#wave2)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

// ── Infinity-P logo mark (SVG) ────────────────────────────────────────────────
function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Perpetual Flow logo">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#a855f7" />
          <stop offset="55%"  stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* Infinity loop — left lobe */}
      <path
        d="M36,36 C36,36 24,18 12,18 C4,18 0,24 0,30 C0,36 4,42 12,42 C24,42 36,36 36,36 Z"
        stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" fill="none"
      />
      {/* Infinity loop — right lobe becomes P stem */}
      <path
        d="M36,36 C36,36 48,18 60,18 C68,18 72,24 72,30 C72,36 68,42 60,42 C52,42 42,38 36,36"
        stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" fill="none"
      />
      {/* P descender */}
      <line x1="60" y1="30" x2="60" y2="56" stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" />
      {/* Accent dot */}
      <circle cx="36" cy="58" r="3" fill="#38bdf8" opacity="0.8" />
    </svg>
  );
}

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Music,
    label: "MANAGE",
    sub: "YOUR MUSIC",
    desc: "Full DAW · Beat library · Stem mixer · AI mixing",
  },
  {
    icon: Globe,
    label: "COLLABORATE",
    sub: "GLOBALLY",
    desc: "A&R discovery · Artist profiles · Label connections",
  },
  {
    icon: BarChart2,
    label: "TRACK",
    sub: "YOUR PROGRESS",
    desc: "Flow metrics · Market fit scores · Growth analytics",
  },
  {
    icon: Unlock,
    label: "UNLOCK",
    sub: "NEW OPPORTUNITIES",
    desc: "DJ mode · Video editor · Marketplace · Streaming",
  },
];

const MODES = [
  { href: "/production", label: "Production", icon: Disc3  },
  { href: "/streaming",  label: "Streaming",  icon: Radio  },
  { href: "/dj",         label: "DJ Mode",    icon: Music2 },
  { href: "/anr",        label: "A&R",        icon: Users  },
  { href: "/video",      label: "Video",      icon: Film   },
];

// ── Particle dots (pure CSS, no canvas) ──────────────────────────────────────
const DOTS = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top:  `${(i * 53 + 7)  % 100}%`,
  size: i % 3 === 0 ? 2 : 1.5,
  opacity: 0.15 + (i % 5) * 0.07,
  delay: `${(i * 0.3) % 3}s`,
}));

export default function LandingPage() {
  const [entered, setEntered] = useState(false);

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg, #141620 0%, #1a1d2e 40%, #0f1218 100%)" }}
    >
      {/* ── Particle background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {DOTS.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: d.left, top: d.top,
              width: d.size, height: d.size,
              opacity: d.opacity,
              animation: `pulse 4s ease-in-out ${d.delay} infinite`,
            }}
          />
        ))}
        {/* Large ambient glows */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] right-[15%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.10) 0%, transparent 70%)" }} />
      </div>

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        {/* Left: CREATE COLLABORATE DISTRIBUTE… */}
        <div className="hidden md:flex flex-col gap-0.5">
          {["CREATE", "COLLABORATE", "DISTRIBUTE", "GROW", "REPEAT"].map(w => (
            <span key={w} className="text-[10px] font-semibold tracking-[0.2em] text-white/30">{w}</span>
          ))}
        </div>

        {/* Center: empty on mobile, logo area */}
        <div className="flex-1" />

        {/* Right: MUSIC PEOPLE OPPORTUNITY ALWAYS IN FLOW */}
        <div className="hidden md:flex flex-col gap-0.5 text-right">
          {["MUSIC", "PEOPLE", "OPPORTUNITY", "ALWAYS IN FLOW"].map(w => (
            <span key={w} className="text-[10px] font-semibold tracking-[0.2em] text-white/30">{w}</span>
          ))}
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pt-4 pb-0">

        {/* Logo mark */}
        <div className="mb-5" style={{ filter: "drop-shadow(0 0 24px rgba(168,85,247,0.4))" }}>
          <LogoMark size={88} />
        </div>

        {/* Wordmark */}
        <h1
          className="text-5xl md:text-7xl font-black tracking-[0.12em] text-white mb-3"
          style={{ textShadow: "0 0 40px rgba(56,189,248,0.3)" }}
        >
          PERPETUAL FLOW
        </h1>

        {/* Tagline */}
        <p className="text-xs md:text-sm font-semibold tracking-[0.3em] text-white/50 mb-10">
          THE MUSIC INDUSTRY IN MOTION
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-10">
          <Link
            href="/select"
            className="group flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm tracking-wide text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #38bdf8)",
              boxShadow: "0 0 30px rgba(124,58,237,0.4)",
            }}
          >
            Enter App
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm tracking-wide text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition-all"
          >
            View Plans
          </Link>
        </div>

        {/* Wave ribbon */}
        <div className="w-full max-w-4xl -mb-2" style={{ filter: "drop-shadow(0 0 12px rgba(56,189,248,0.3))" }}>
          <FlowWave />
        </div>
      </main>

      {/* ── Feature icons row ── */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6 md:px-12 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, label, sub, desc }) => (
            <div key={label} className="flex flex-col items-center text-center gap-3">
              {/* Icon circle */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center border border-white/10"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Icon className="w-6 h-6 text-white/50" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-white/80">{label}</p>
                <p className="text-xs font-bold tracking-[0.2em] text-white/80">{sub}</p>
                <p className="text-[10px] text-white/35 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full pb-6 flex flex-col items-center gap-4">

        {/* Divider line with gradient */}
        <div
          className="w-32 h-px mx-auto mb-1"
          style={{ background: "linear-gradient(90deg, transparent, #7c3aed, #38bdf8, transparent)" }}
        />

        {/* Mode pills */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-6">
          {MODES.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-white/40 hover:text-white/80 transition-colors uppercase"
            >
              <Icon className="w-3 h-3" />
              {label}
            </Link>
          ))}
        </div>

        {/* Bottom line */}
        <div className="flex flex-col items-center gap-1 mt-1">
          <p className="text-[10px] tracking-[0.25em] text-white/20 font-semibold">
            A MORE CONNECTED MUSIC INDUSTRY
          </p>
          <p className="text-[10px] tracking-[0.2em] text-white/15">PERPETUALFLOW.COM</p>
        </div>

        {/* Left: ARTISTS LABELS… */}
        <div className="absolute left-6 bottom-6 hidden md:flex flex-col gap-0.5">
          {["ARTISTS", "LABELS", "MANAGERS", "PUBLISHERS", "FANS"].map(w => (
            <span key={w} className="text-[9px] font-semibold tracking-[0.18em] text-white/20">{w}</span>
          ))}
        </div>

        {/* Right: Music Never Stops */}
        <div className="absolute right-6 bottom-6 hidden md:block">
          <p
            className="text-2xl text-white/20 leading-tight text-right"
            style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
          >
            Music<br />Never<br />Stops
          </p>
        </div>
      </footer>

      {/* ── Keyframes for particle pulse ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
