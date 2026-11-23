"use client";
import Link from "next/link";
import { Disc3, Radio, Music2, Users, Film, ArrowRight } from "lucide-react";

const MODES = [
  {
    href: "/production",
    label: "Production Studio",
    sub: "Beat library · DAW engine · Stem mixer · AI mix",
    icon: Disc3,
    grad: "from-sky-400 to-blue-600",
    glow: "rgba(56,189,248,0.25)",
    tag: "CREATE",
  },
  {
    href: "/streaming",
    label: "Streaming",
    sub: "YouTube · SoundCloud · MP3 · Flow playlists",
    icon: Radio,
    grad: "from-purple-500 to-indigo-600",
    glow: "rgba(168,85,247,0.25)",
    tag: "LISTEN",
  },
  {
    href: "/dj",
    label: "DJ Mode",
    sub: "Dual decks · Crossfader · Cue points · Sample pads",
    icon: Music2,
    grad: "from-emerald-400 to-teal-600",
    glow: "rgba(52,211,153,0.25)",
    tag: "MIX",
  },
  {
    href: "/video",
    label: "Video Editor",
    sub: "Timeline · Sync points · Beat markers · Export",
    icon: Film,
    grad: "from-orange-400 to-rose-500",
    glow: "rgba(251,146,60,0.25)",
    tag: "EDIT",
  },
  {
    href: "/anr",
    label: "A&R Discovery",
    sub: "Artist scouting · Market fit scores · Label pipeline",
    icon: Users,
    grad: "from-rose-500 to-orange-500",
    glow: "rgba(244,63,94,0.25)",
    tag: "DISCOVER",
  },
];

export default function SelectModePage() {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #141620 0%, #1a1d2e 40%, #0f1218 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[-10%] left-[25%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] right-[20%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)" }} />
      </div>

      {/* Back to landing */}
      <Link href="/"
        className="absolute top-6 left-6 text-[11px] font-semibold tracking-[0.15em] text-white/30 hover:text-white/70 transition-colors uppercase flex items-center gap-1.5">
        ← Perpetual Flow
      </Link>

      {/* Header */}
      <div className="relative z-10 text-center mb-10">
        <p className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase mb-3">
          Select Your Mode
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-[0.08em] text-white mb-3">
          Where do you want to go?
        </h1>
        <p className="text-sm text-white/40 max-w-md mx-auto">
          Every mode is powered by the same nine-dimension perceptual engine.
          Pick one to get started — you can switch anytime from the sidebar.
        </p>
      </div>

      {/* Mode cards */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODES.map(({ href, label, sub, icon: Icon, grad, glow, tag }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex flex-col rounded-2xl border border-white/8 overflow-hidden transition-all duration-200 hover:border-white/20 hover:scale-[1.02]"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {/* Top colour bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${grad}`} />

            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at 50% 0%, ${glow} 0%, transparent 70%)` }}
            />

            <div className="relative p-6 flex flex-col gap-4">
              {/* Tag pill */}
              <span className={`self-start text-[9px] font-black tracking-[0.25em] px-2.5 py-1 rounded-full bg-gradient-to-r ${grad} text-white`}>
                {tag}
              </span>

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg`}
                style={{ boxShadow: `0 0 20px ${glow}` }}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Text */}
              <div>
                <h2 className="text-base font-bold text-white mb-1">{label}</h2>
                <p className="text-xs text-white/40 leading-relaxed">{sub}</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/30 group-hover:text-white/70 transition-colors mt-auto">
                Enter <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="relative z-10 mt-10 text-[10px] tracking-[0.2em] text-white/15 uppercase">
        Switch modes anytime · All data persists across sessions
      </p>
    </div>
  );
}
