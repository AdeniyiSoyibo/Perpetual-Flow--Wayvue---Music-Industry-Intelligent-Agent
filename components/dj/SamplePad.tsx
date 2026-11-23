"use client";
import { useRef, useState } from "react";

// ── Synthesised samples via Web Audio API — no audio files needed ─────────
function getCtx(): AudioContext {
  const w = window as any;
  if (!w._djAudioCtx || w._djAudioCtx.state === "closed") w._djAudioCtx = new AudioContext();
  if (w._djAudioCtx.state === "suspended") w._djAudioCtx.resume();
  return w._djAudioCtx;
}

function playAirhorn() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth"; o.frequency.setValueAtTime(220, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
  o.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.6, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
  o.start(); o.stop(ctx.currentTime + 1.2);
}

function playSiren() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(400, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
  o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.8);
  o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 1.2);
  o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 1.6);
  g.gain.setValueAtTime(0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
  o.start(); o.stop(ctx.currentTime + 1.8);
}

function playRiser() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth";
  o.frequency.setValueAtTime(80, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 2.5);
  g.gain.setValueAtTime(0.01, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.0);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.6);
  o.start(); o.stop(ctx.currentTime + 2.6);
}

function playDrop() {
  const ctx = getCtx();
  // Sub kick
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine"; o.frequency.setValueAtTime(160, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
  g.gain.setValueAtTime(1, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  o.start(); o.stop(ctx.currentTime + 0.4);
}

function playStutter(times = 6) {
  const ctx = getCtx();
  for (let i = 0; i < times; i++) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "square"; o.frequency.value = 440;
    const t = ctx.currentTime + i * 0.08;
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.start(t); o.stop(t + 0.07);
  }
}

function playScrath() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth";
  o.frequency.setValueAtTime(600, ctx.currentTime);
  o.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.1);
  o.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.18);
  o.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.28);
  g.gain.setValueAtTime(0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  o.start(); o.stop(ctx.currentTime + 0.35);
}

function playRewind() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sawtooth";
  o.frequency.setValueAtTime(2000, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 1.0);
  g.gain.setValueAtTime(0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
  o.start(); o.stop(ctx.currentTime + 1.1);
}

function playBigroom() {
  const ctx = getCtx();
  // 4 kick hits
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.setValueAtTime(120, ctx.currentTime + i * 0.22);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + i * 0.22 + 0.18);
    g.gain.setValueAtTime(0.8, ctx.currentTime + i * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
    o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.22);
  }
}

// ── Pad definitions ─────────────────────────────────────────────────────────
const DEFAULT_PADS = [
  { id: "airhorn",  label: "Air Horn",  color: "bg-red-500",     fn: playAirhorn  },
  { id: "siren",    label: "Siren",     color: "bg-orange-500",  fn: playSiren    },
  { id: "riser",    label: "Riser",     color: "bg-yellow-500",  fn: playRiser    },
  { id: "drop",     label: "Drop",      color: "bg-purple-600",  fn: playDrop     },
  { id: "stutter",  label: "Stutter",   color: "bg-sky-500",     fn: playStutter  },
  { id: "scratch",  label: "Scratch",   color: "bg-emerald-500", fn: playScrath   },
  { id: "rewind",   label: "Rewind",    color: "bg-indigo-500",  fn: playRewind   },
  { id: "bigroom",  label: "Big Room",  color: "bg-rose-600",    fn: playBigroom  },
];

interface Pad { id: string; label: string; color: string; fn: () => void; custom?: boolean; }

function playBuffer(buf: AudioBuffer) {
  const ctx = getCtx();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
}

export function SamplePad() {
  const [active, setActive]   = useState<string | null>(null);
  const [pads,   setPads]     = useState<Pad[]>(DEFAULT_PADS);
  const [loading, setLoading] = useState<string | null>(null); // pad id being loaded
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const trigger = (pad: Pad) => {
    pad.fn();
    setActive(pad.id);
    setTimeout(() => setActive(null), 300);
  };

  const handleUpload = async (padId: string, file: File) => {
    setLoading(padId);
    try {
      const arrayBuf = await file.arrayBuffer();
      const ctx = getCtx();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const shortName = file.name.replace(/\.[^.]+$/, "").slice(0, 12);
      setPads(ps => ps.map(p => p.id === padId
        ? { ...p, label: shortName, fn: () => playBuffer(audioBuf), custom: true }
        : p
      ));
    } catch {
      // decode failed — leave pad as-is
    } finally {
      setLoading(null);
    }
  };

  const resetPad = (padId: string) => {
    const def = DEFAULT_PADS.find(p => p.id === padId);
    if (def) setPads(ps => ps.map(p => p.id === padId ? { ...def } : p));
  };

  return (
    <div className="bg-[#1e2430] rounded-2xl border border-[#2e3a4e] overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-[#2e3a4e] flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white tracking-widest uppercase">Sample Pads</span>
          <p className="text-[9px] text-[#8b949e] mt-0.5">Tap to fire · hover &amp; click to load custom audio</p>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2 justify-center">
        {pads.map(pad => (
          <div key={pad.id} className="relative group">
            <button
              onClick={() => trigger(pad)}
              disabled={loading === pad.id}
              className={`w-24 h-14 rounded-xl text-white font-bold text-[11px] tracking-wide transition-all select-none
                border border-white/10 shadow-lg
                ${pad.color}
                ${active === pad.id ? "scale-90 brightness-150 shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "hover:brightness-125 hover:scale-105 active:scale-90"}
                ${loading === pad.id ? "opacity-40 cursor-wait" : ""}`}>
              {loading === pad.id ? "…" : pad.label}
              {pad.custom && <span className="ml-1 text-yellow-300">★</span>}
            </button>
            <label className="absolute inset-0 opacity-0 cursor-pointer" title="Load custom audio">
              <input type="file" accept="audio/*" className="hidden"
                ref={el => { fileRefs.current[pad.id] = el; }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(pad.id, f); e.target.value = ""; }} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
