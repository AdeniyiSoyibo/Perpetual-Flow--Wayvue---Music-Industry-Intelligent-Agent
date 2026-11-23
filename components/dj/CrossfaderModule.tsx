"use client";
import { usePlatformStore } from "@/lib/store";
import { useState, useRef, useEffect, useCallback } from "react";
import { deckGains } from "./DeckController";
import { useMidiAction } from "./MidiEngine";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

// ── Equal-power crossfade (professional DJ standard) ─────────────────────────
function equalPowerGains(x: number): { a: number; b: number } {
  const angle = (x / 100) * (Math.PI / 2);
  return { a: Math.cos(angle), b: Math.sin(angle) };
}

// applyGains is kept for animated fades (moveTo). Gain = crossfade only; trim is handled per-deck.
function applyGains(x: number, durationSec: number) {
  const aVal = x === 100 ? 0 : x === 0 ? 1 : Math.cos((x / 100) * (Math.PI / 2));
  const bVal = x === 0   ? 0 : x === 100 ? 1 : Math.sin((x / 100) * (Math.PI / 2));
  const tryApply = (side: "A" | "B", value: number) => {
    const g = deckGains[side];
    if (!g) return;
    const ctx = g.context;
    if (ctx.state === "suspended") (ctx as AudioContext).resume();
    if (durationSec > 0.05) {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(value, now + durationSec);
    }
    // Instant updates are now handled by each deck's own useEffect — skip to avoid overwriting trim
  };
  tryApply("A", aVal);
  tryApply("B", bVal);
}

const TRANSITION_TIMES = [
  { label: "Instant", sec: 0,  color: "bg-slate-500" },
  { label: "1s",      sec: 1,  color: "bg-sky-500"   },
  { label: "2s",      sec: 2,  color: "bg-blue-500"  },
  { label: "4s",      sec: 4,  color: "bg-indigo-500"},
  { label: "8s",      sec: 8,  color: "bg-purple-500"},
];

const SNAP_POINTS = [
  { v: 0,   label: "Full A", short: "A",    icon: "left"   },
  { v: 25,  label: "A Mix",  short: "A75",  icon: null     },
  { v: 50,  label: "Center", short: "50/50",icon: null     },
  { v: 75,  label: "B Mix",  short: "B75",  icon: null     },
  { v: 100, label: "Full B", short: "B",    icon: "right"  },
];

export function CrossfaderModule() {
  const { crossfade, setCrossfade, deckA, deckB } = usePlatformStore();
  const [transTime, setTransTime] = useState(2);
  const [isFading, setIsFading] = useState(false);
  const [fadeTarget, setFadeTarget] = useState<number | null>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useMidiAction(useCallback((action: string, value: number) => {
    if (action === "crossfader") {
      const pos = Math.round((value / 127) * 100);
      setCrossfade(pos);
      applyGains(pos, 0.04);
    }
  }, [setCrossfade]));

  useEffect(() => {
    // Animated fades only — instant gain sync is handled by each DeckController's useEffect
    // which also accounts for trim. No interval needed.
  }, [crossfade]);

  const { a: aGain, b: bGain } = equalPowerGains(crossfade);
  const aPct = Math.round(aGain * 100);
  const bPct = Math.round(bGain * 100);

  const moveTo = (target: number, overrideDur?: number) => {
    const dur = overrideDur ?? transTime;
    const start = crossfade;
    const delta = target - start;
    if (delta === 0) return;

    if (dur <= 0.05) {
      setCrossfade(target);
      applyGains(target, 0);
      return;
    }

    setIsFading(true);
    setFadeTarget(target);
    const steps = Math.max(20, Math.round(dur * 60));
    let step = 0;
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const current = Math.round(start + delta * eased);
      setCrossfade(current);
      if (step >= steps) {
        clearInterval(autoRef.current!);
        setCrossfade(target);
        setIsFading(false);
        setFadeTarget(null);
      }
    }, (dur * 1000) / steps);

    applyGains(target, dur);
  };

  const onSlider = (val: number) => {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
      setIsFading(false);
      setFadeTarget(null);
    }
    setCrossfade(val);
    applyGains(val, 0.04);
  };

  const crossLabel =
    crossfade === 50 ? "Center — Equal Mix" :
    crossfade < 50   ? `Deck A +${Math.round((50 - crossfade) * 2)}%` :
                       `Deck B +${Math.round((crossfade - 50) * 2)}%`;

  const selectedSpeed = TRANSITION_TIMES.find(t => t.sec === transTime) ?? TRANSITION_TIMES[2];

  return (
    <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>

      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #38bdf810 0%, #a78bfa10 100%)", borderBottom: "1px solid #2e3a4e" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Crossfader</p>
            <p className="text-[9px]" style={{ color: "#4a6580" }}>Equal-power · drag or snap to position</p>
          </div>
        </div>
        <div className="text-right">
          {isFading ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ background: "#22c55e22", border: "1px solid #22c55e44" }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold" style={{ color: "#22c55e" }}>
                Fading → {fadeTarget === 0 ? "Deck A" : fadeTarget === 100 ? "Deck B" : `${fadeTarget}%`}
              </span>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-bold text-white">{crossLabel}</p>
              <p className="text-[9px]" style={{ color: "#4a6580" }}>A: {aPct}% · B: {bPct}%</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── LIVE / CUE status ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { side: "A", title: deckA?.title, live: crossfade < 50, equal: crossfade === 50, accent: "#38bdf8" },
            { side: "B", title: deckB?.title, live: crossfade > 50, equal: crossfade === 50, accent: "#a78bfa" },
          ].map(({ side: s, title, live, equal, accent: a }) => (
            <div key={s} className="rounded-xl px-3 py-2 flex items-center gap-2 transition-all"
              style={{ background: live ? "#22c55e11" : equal ? "#f59e0b0a" : "#252d3a", border: `1px solid ${live ? "#22c55e44" : equal ? "#f59e0b33" : "#2e3a4e"}` }}>
              <span className="text-xs font-black flex-shrink-0" style={{ color: a }}>DECK {s}</span>
              <span className="text-[9px] font-semibold truncate flex-1" style={{ color: "#c9d1d9" }}>{title ?? "—"}</span>
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={live
                  ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
                  : equal
                  ? { background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }
                  : { background: "#252d3a", color: "#6b7a90", border: "1px solid #2e3a4e" }}>
                {live ? "● LIVE" : equal ? "= MIX" : "◎ CUE"}
              </span>
            </div>
          ))}
        </div>

        {/* ── Fader ── */}
        <div>
          <div className="flex justify-between text-[10px] font-bold mb-2">
            <span style={{ color: "#38bdf8" }}>◀ DECK A</span>
            <span style={{ color: "#4a6580" }}>50/50</span>
            <span style={{ color: "#a78bfa" }}>DECK B ▶</span>
          </div>
          <div className="relative h-14 flex items-center rounded-xl px-3" style={{ background: "#252d3a", border: "1px solid #2e3a4e" }}>
            {/* Fill strip */}
            <div className="absolute inset-y-0 left-3 right-3 flex items-center pointer-events-none">
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#2e3a4e" }}>
                <div className="h-full rounded-full" style={{
                  width: `${crossfade}%`,
                  background: `linear-gradient(to right, #38bdf8, #a78bfa)`
                }} />
              </div>
            </div>
            {/* Pip */}
            <div className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none z-10"
              style={{
                left: `calc(${crossfade}% * (100% - 44px) / 100 + 12px - 10px)`,
                top: "50%", transform: "translateY(-50%)",
                background: crossfade <= 50 ? "#38bdf8" : "#a78bfa",
                boxShadow: `0 0 10px ${crossfade <= 50 ? "#38bdf844" : "#a78bfa44"}`
              }} />
            <input type="range" min={0} max={100} value={crossfade}
              onChange={e => onSlider(Number(e.target.value))}
              className="relative w-full z-20 bg-transparent cursor-pointer opacity-0 h-10" />
          </div>

          {/* Level meters */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[
              { label: "A", pct: aPct, from: "#38bdf8", to: "#0ea5e9" },
              { label: "B", pct: bPct, from: "#a78bfa", to: "#7c3aed" },
            ].map(({ label, pct, from, to }) => (
              <div key={label}>
                <div className="flex justify-between text-[9px] mb-1">
                  <span style={{ color: from }}>Deck {label}</span>
                  <span className="font-mono font-bold" style={{ color: from }}>{pct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#2e3a4e" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${from}, ${to})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fade speed + Snap (side by side) ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: "#252d3a", border: "1px solid #2e3a4e" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "#38bdf888" }}>
              <Zap className="w-3 h-3 inline mr-1" />Fade Speed
            </p>
            <div className="flex flex-col gap-1">
              {TRANSITION_TIMES.map(t => (
                <button key={t.sec} onClick={() => setTransTime(t.sec)}
                  className="w-full py-1.5 rounded-lg text-[9px] font-bold transition-all text-left px-2"
                  style={transTime === t.sec
                    ? { background: "#38bdf822", color: "#38bdf8", border: "1px solid #38bdf844" }
                    : { background: "#1e2430", color: "#4a6580", border: "1px solid #2e3a4e" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: "#252d3a", border: "1px solid #2e3a4e" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a78bfa88" }}>Snap to</p>
            <div className="flex flex-col gap-1">
              {SNAP_POINTS.map(({ v, label, icon }) => {
                const isActive = crossfade === v;
                return (
                  <button key={v} onClick={() => moveTo(v)}
                    className="w-full py-1.5 rounded-lg text-[9px] font-bold transition-all flex items-center justify-between px-2"
                    style={isActive
                      ? { background: v <= 50 ? "#38bdf822" : "#a78bfa22", color: v <= 50 ? "#38bdf8" : "#a78bfa", border: `1px solid ${v <= 50 ? "#38bdf844" : "#a78bfa44"}` }
                      : { background: "#1e2430", color: "#4a6580", border: "1px solid #2e3a4e" }}>
                    <span>{label}</span>
                    {icon === "left" && <ChevronLeft className="w-3 h-3" />}
                    {icon === "right" && <ChevronRight className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
