"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play, Pause, SkipBack, Headphones, Volume2, Repeat,
  Link2, Bookmark, ChevronLeft, ChevronRight, RefreshCw,
  Tv2, Lock, Unlock, Zap, Mic, MicOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HotCue { id: number; label: string; timeLabel: string; color: string; }
interface VideoDeck {
  videoId: string; title: string;
  volume: number; tempo: number; // tempo offset -100..+100 (maps to ±8%)
  eqHi: number; eqMid: number; eqLo: number; // -6..+6 visual
  hotCues: HotCue[];
  loopStart: string | null; loopEnd: string | null; loopActive: boolean;
  _startTime?: number;
}

const CUE_COLORS = ["#38bdf8","#f472b6","#34d399","#fb923c","#a78bfa","#facc15","#f87171","#60a5fa"];

const PRESETS = [
  { id: "dQw4w9WgXcQ", title: "Classic House Set" },
  { id: "3JZ_D3ELwOQ", title: "Techno DJ Set" },
  { id: "hT_nvWreIhg", title: "Hip-Hop Megamix" },
  { id: "2Vv-BfVoq4g", title: "EDM / Future Bass" },
  { id: "09R8_2nJtjg", title: "Lo-Fi Chill Beats" },
  { id: "kffacxfA7G4", title: "Drill Set" },
  { id: "tgbNymZ7vqY", title: "Afropop Party" },
  { id: "9K5GXUD0Yak", title: "R&B Mix" },
  { id: "REL0M_hqMWY", title: "Dancehall / Reggae" },
  { id: "0YRhPVQrZng", title: "Reggaeton / Latino" },
];

const FADE_SPEEDS = [
  { label: "Cut", ms: 0 },
  { label: "1s",  ms: 1000 },
  { label: "4s",  ms: 4000 },
  { label: "8s",  ms: 8000 },
];

const TRANSITION_FX = [
  { id: "none",    label: "None" },
  { id: "echo",    label: "Echo Out" },
  { id: "lowpass", label: "Low-Pass" },
  { id: "rise",    label: "Riser" },
  { id: "rewind",  label: "Rewind" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseYTId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : "https://" + s);
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    if (url.hostname === "youtu.be") { const id = url.pathname.slice(1).split("?")[0]; if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id; }
    const m2 = url.pathname.match(/\/(embed|shorts|v|live)\/([A-Za-z0-9_-]{11})/);
    if (m2) return m2[2];
  } catch {}
  const m = s.match(/[A-Za-z0-9_-]{11}/);
  return m ? m[0] : null;
}

function ytSearch(q: string) { return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`; }

function equalPower(x: number) {
  const angle = (x / 100) * (Math.PI / 2);
  return {
    a: x === 100 ? 0 : x === 0 ? 1 : Math.cos(angle),
    b: x === 0   ? 0 : x === 100 ? 1 : Math.sin(angle),
  };
}

// Web Audio for FX / sample pads
function getVidCtx(): AudioContext {
  const w = window as Window & { _vidAudioCtx?: AudioContext };
  if (!w._vidAudioCtx || w._vidAudioCtx.state === "closed") w._vidAudioCtx = new AudioContext();
  if (w._vidAudioCtx.state === "suspended") w._vidAudioCtx.resume();
  return w._vidAudioCtx;
}

async function fireFX(fx: string) {
  if (fx === "none") return;
  const ctx = getVidCtx();
  // Always resume first — browser blocks audio until a user gesture has occurred
  if (ctx.state !== "running") await ctx.resume();
  const now = ctx.currentTime;
  if (fx === "echo") {
    const o = ctx.createOscillator(), g = ctx.createGain(), d = ctx.createDelay(2);
    d.delayTime.value = 0.35; o.connect(g); g.connect(d); d.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    o.start(now); o.stop(now + 2.5);
  } else if (fx === "lowpass") {
    // White noise swept through a falling low-pass filter
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "lowpass"; f.frequency.setValueAtTime(3000, now);
    f.frequency.exponentialRampToValueAtTime(60, now + 1.5);
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.5); s.start(now);
  } else if (fx === "rise") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = "sawtooth";
    o.frequency.setValueAtTime(60, now); o.frequency.exponentialRampToValueAtTime(2400, now + 2.5);
    g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    o.start(now); o.stop(now + 2.5);
  } else if (fx === "rewind") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = "sawtooth";
    o.frequency.setValueAtTime(1400, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.7);
    g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    o.start(now); o.stop(now + 0.7);
  }
}

// Sample pads (8 synth sounds)
const VIDEO_PADS = [
  { label: "Airhorn",  color: "#0ea5e9", play: () => { const ctx = getVidCtx(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sawtooth"; o.frequency.setValueAtTime(220, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); g.gain.setValueAtTime(0.6, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2); o.start(); o.stop(ctx.currentTime + 1.2); } },
  { label: "Siren",    color: "#ef4444", play: () => { const ctx = getVidCtx(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.setValueAtTime(400, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4); o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.8); g.gain.setValueAtTime(0.5, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0); o.start(); o.stop(ctx.currentTime + 1.0); } },
  { label: "Riser",    color: "#a855f7", play: () => { const ctx = getVidCtx(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sawtooth"; o.frequency.setValueAtTime(80, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 2.5); g.gain.setValueAtTime(0.3, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5); o.start(); o.stop(ctx.currentTime + 2.5); } },
  { label: "Drop",     color: "#f97316", play: () => { const ctx = getVidCtx(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.setValueAtTime(2000, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3); g.gain.setValueAtTime(0.7, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8); o.start(); o.stop(ctx.currentTime + 0.8); } },
  { label: "Scratch",  color: "#22c55e", play: () => { const ctx = getVidCtx(); const b = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.08); const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); s.start(); } },
  { label: "Rewind",   color: "#eab308", play: () => { const ctx = getVidCtx(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sawtooth"; o.frequency.setValueAtTime(1200, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.6); g.gain.setValueAtTime(0.5, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6); o.start(); o.stop(ctx.currentTime + 0.6); } },
  { label: "Stutter",  color: "#ec4899", play: () => { const ctx = getVidCtx(); for (let i = 0; i < 8; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "square"; o.frequency.value = 220; const t = ctx.currentTime + i * 0.06; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.start(t); o.stop(t + 0.05); } } },
  { label: "Big Room", color: "#6366f1", play: () => { const ctx = getVidCtx(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = "sine"; o.frequency.setValueAtTime(60, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15); g.gain.setValueAtTime(0.9, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(); o.stop(ctx.currentTime + 0.5); } },
];

// ── Vinyl platter SVG ─────────────────────────────────────────────────────────
function VideoPlatter({ spinning, side, scratch }: { spinning: boolean; side: "A" | "B"; scratch: boolean }) {
  const angle = useRef(0);
  const raf = useRef<number>(0);
  const gRef = useRef<SVGGElement>(null);
  const accent = side === "A" ? "#38bdf8" : "#a78bfa";

  useEffect(() => {
    const degsPerMs = (33 / 60) * 360 / 1000;
    let last = performance.now();
    const tick = (now: number) => {
      if (spinning && !scratch) {
        const dt = now - last;
        angle.current = (angle.current + degsPerMs * dt) % 360;
        if (gRef.current) gRef.current.setAttribute("transform", `rotate(${angle.current} 60 60)`);
      }
      last = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [spinning, scratch]);

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
      <circle cx="60" cy="60" r="58" fill="#1a2a3a" stroke="#2a3a4a" strokeWidth="1.5" />
      {[50,42,34,26,18,12].map(r => (
        <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="#243040" strokeWidth="0.8" />
      ))}
      {/* TV icon on vinyl */}
      <text x="60" y="65" textAnchor="middle" fontSize="14" fill="#2a3a4a">📺</text>
      <g ref={gRef} transform="rotate(0 60 60)">
        {Array.from({ length: 32 }, (_, i) => {
          const a = (i / 32) * Math.PI * 2;
          return <circle key={i} cx={+(60 + 55 * Math.cos(a)).toFixed(4)} cy={+(60 + 55 * Math.sin(a)).toFixed(4)} r="1.2" fill={accent} opacity="0.7" />;
        })}
        {[0,45,90,135].map(a => (
          <line key={a} x1="60" y1="60" x2={+(60 + 8 * Math.cos(a * Math.PI/180)).toFixed(4)} y2={+(60 + 8 * Math.sin(a * Math.PI/180)).toFixed(4)} stroke={accent} strokeWidth="1.5" />
        ))}
        <circle cx="60" cy="60" r="16" fill="#141620" stroke={accent} strokeWidth="1" />
        <text x="60" y="57" textAnchor="middle" fill={accent} fontSize="5" fontWeight="bold">PERPETUAL</text>
        <text x="60" y="64" textAnchor="middle" fill={accent} fontSize="4">FLOW</text>
      </g>
      <line x1="100" y1="20" x2="72" y2="52" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="100" cy="20" r="3" fill="#facc15" opacity="0.7" />
      <circle cx="60" cy="60" r="4" fill={accent} opacity="0.9" />
      {scratch && <text x="60" y="115" textAnchor="middle" fill="#facc15" fontSize="6" fontWeight="bold">SCRATCH</text>}
    </svg>
  );
}

// ── EQ Band slider ─────────────────────────────────────────────────────────────
function EQFader({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[9px] font-bold text-[#4a7090] uppercase">{label}</span>
      <input
        type="range" min={-6} max={6} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: color }}
      />
      <span className="text-[9px] font-mono" style={{ color }}>{value > 0 ? `+${value}` : value}dB</span>
    </div>
  );
}

// ── EQ Frequency Response Curve (SVG) ─────────────────────────────────────────
function EQCurve({ hi, mid, lo, color }: { hi: number; mid: number; lo: number; color: string }) {
  // Build a simplified 3-point curve: x=lo band, x=mid, x=hi mapped to 0..200 width
  // y = 0dB line at centre (y=20), each band shifts its region up/down ±6dB = ±12px
  const W = 200; const H = 40; const MID = H / 2;
  const scale = (db: number) => (db / 6) * 12; // 6dB → 12px
  // 5 control points: far-left, lo-band, mid-band, hi-band, far-right
  const pts: [number, number][] = [
    [0,     MID - scale(lo)],
    [30,    MID - scale(lo)],
    [70,    MID - scale(mid)],
    [130,   MID - scale(mid)],
    [170,   MID - scale(hi)],
    [W,     MID - scale(hi)],
  ];
  // Smooth path using cubic bezier through points
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx1 = px + (x - px) / 2; const cx2 = cx1;
    return `${acc} C ${cx1} ${py} ${cx2} ${y} ${x} ${y}`;
  }, "");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="rounded-lg overflow-hidden" style={{ background: "#0a1018" }}>
      {/* 0dB centre line */}
      <line x1="0" y1={MID} x2={W} y2={MID} stroke="#2a3a4a" strokeWidth="1" strokeDasharray="3 3" />
      {/* +6 / -6 guides */}
      <line x1="0" y1={MID - 12} x2={W} y2={MID - 12} stroke="#1a2a3a" strokeWidth="0.5" />
      <line x1="0" y1={MID + 12} x2={W} y2={MID + 12} stroke="#1a2a3a" strokeWidth="0.5" />
      {/* Filled area under curve */}
      <path d={`${d} L ${W} ${MID} L 0 ${MID} Z`} fill={color} fillOpacity="0.12" />
      {/* Curve line */}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
      {/* Band labels */}
      <text x="20"  y={H - 3} fontSize="5" fill="#4a6070" textAnchor="middle">Lo</text>
      <text x="100" y={H - 3} fontSize="5" fill="#4a6070" textAnchor="middle">Mid</text>
      <text x="180" y={H - 3} fontSize="5" fill="#4a6070" textAnchor="middle">Hi</text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function YouTubeMixPanel() {
  const mkDeck = (videoId: string, title: string): VideoDeck => ({
    videoId, title, volume: 80, tempo: 0,
    eqHi: 0, eqMid: 0, eqLo: 0,
    hotCues: [], loopStart: null, loopEnd: null, loopActive: false,
  });

  const [deckA, setDeckA] = useState<VideoDeck>(() => mkDeck("dQw4w9WgXcQ", "Classic House Set"));
  const [deckB, setDeckB] = useState<VideoDeck>(() => mkDeck("3JZ_D3ELwOQ", "Techno DJ Set"));
  const [crossfade,    setCrossfade]    = useState(50);
  const [fadeSpeedMs,  setFadeSpeedMs]  = useState(0);
  const [transitionFx, setTransitionFx] = useState("none");
  const [playA, setPlayA] = useState(false);
  const [playB, setPlayB] = useState(false);
  const [cueA,  setCueA]  = useState(false);
  const [cueB,  setCueB]  = useState(false);
  const [scratchA, setScratchA] = useState(false);
  const [scratchB, setScratchB] = useState(false);
  const [urlA, setUrlA] = useState(""); const [urlB, setUrlB] = useState("");
  const [errA, setErrA] = useState(""); const [errB, setErrB] = useState("");
  const [searchA, setSearchA] = useState(""); const [searchB, setSearchB] = useState("");
  const [activePad, setActivePad] = useState<number | null>(null);
  const [loadingPad, setLoadingPad] = useState<number | null>(null);
  // pads: start from the module-level VIDEO_PADS defaults, can be replaced with uploaded audio
  const [vidPads, setVidPads] = useState(() =>
    VIDEO_PADS.map(p => ({ ...p, custom: false, customAudioBuf: null as AudioBuffer | null }))
  );
  const [keyLockA, setKeyLockA] = useState(false);
  const [keyLockB, setKeyLockB] = useState(false);
  const fadingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const scratchLastX   = useRef<{ [k: string]: number }>({});
  const scratchActive  = useRef<{ A: boolean; B: boolean }>({ A: false, B: false });
  const scratchOscA    = useRef<{ osc: OscillatorNode; gain: GainNode; bp: BiquadFilterNode } | null>(null);
  const scratchOscB    = useRef<{ osc: OscillatorNode; gain: GainNode; bp: BiquadFilterNode } | null>(null);
  // Per-deck EQ filter chain: hi-shelf → peaking → lo-shelf → destination
  type EQChain = { hi: BiquadFilterNode; mid: BiquadFilterNode; lo: BiquadFilterNode; input: GainNode };
  const eqChainA = useRef<EQChain | null>(null);
  const eqChainB = useRef<EQChain | null>(null);
  // Per-deck system-audio capture (getDisplayMedia)
  const captureStreamA = useRef<MediaStream | null>(null);
  const captureStreamB = useRef<MediaStream | null>(null);
  const captureSourceA = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureSourceB = useRef<MediaStreamAudioSourceNode | null>(null);
  const [captureActiveA, setCaptureActiveA] = useState(false);
  const [captureActiveB, setCaptureActiveB] = useState(false);
  const [scratchVelA, setScratchVelA] = useState(0);
  const [scratchVelB, setScratchVelB] = useState(0);

  // Computed gains
  const { a: rawA, b: rawB } = equalPower(crossfade);
  const aGainPct = Math.round(rawA * 100);
  const bGainPct = Math.round(rawB * 100);
  const aIsCue = cueA;
  const bIsCue = cueB;
  const aOut = aIsCue ? 0 : Math.round((aGainPct / 100) * deckA.volume);
  const bOut = bIsCue ? 0 : Math.round((bGainPct / 100) * deckB.volume);

  // Live indicator
  const live = (!aIsCue && bIsCue) ? "A" : (aIsCue && !bIsCue) ? "B" : crossfade === 0 ? "A" : crossfade === 100 ? "B" : "both";

  const sweepTo = useCallback((target: number) => {
    if (fadingRef.current) clearInterval(fadingRef.current);
    if (transitionFx !== "none") fireFX(transitionFx);
    if (fadeSpeedMs === 0) { setCrossfade(target); return; }
    const steps = Math.max(1, Math.round(fadeSpeedMs / 30));
    let step = 0;
    fadingRef.current = setInterval(() => {
      step++;
      setCrossfade(prev => {
        const next = prev + (target - prev) * (step / steps);
        return step >= steps ? target : Math.round(next);
      });
      if (step >= steps) { clearInterval(fadingRef.current!); fadingRef.current = null; }
    }, 30);
  }, [fadeSpeedMs, transitionFx]);

  const handleUrl = (side: "A" | "B", val: string) => {
    side === "A" ? setUrlA(val) : setUrlB(val);
    side === "A" ? setErrA("") : setErrB("");
    if (val.trim().length < 10) return;
    if (val.includes("/results")) { (side === "A" ? setErrA : setErrB)("Paste a direct video URL, not search results."); return; }
    const id = parseYTId(val);
    if (!id) { (side === "A" ? setErrA : setErrB)("No video ID found — paste a direct YouTube link."); return; }
    const update = mkDeck(id, `Video ${id}`);
    side === "A" ? (setDeckA(update), setUrlA("")) : (setDeckB(update), setUrlB(""));
  };

  const addHotCue = (side: "A" | "B", label: string) => {
    const deck = side === "A" ? deckA : deckB;
    const setDeck = side === "A" ? setDeckA : setDeckB;
    if (deck.hotCues.length >= 8) return;
    const idx = deck.hotCues.length;
    setDeck(d => ({ ...d, hotCues: [...d.hotCues, { id: Date.now(), label: label || `C${idx + 1}`, timeLabel: "0:00", color: CUE_COLORS[idx] }] }));
  };

  const removeHotCue = (side: "A" | "B", id: number) => {
    const setDeck = side === "A" ? setDeckA : setDeckB;
    setDeck(d => ({ ...d, hotCues: d.hotCues.filter(c => c.id !== id) }));
  };

  // ── EQ filter chain (hi-shelf → peaking mid → lo-shelf → destination) ────────
  const getEQChain = (side: "A" | "B"): EQChain | null => {
    const chainRef = side === "A" ? eqChainA : eqChainB;
    if (chainRef.current) return chainRef.current;
    try {
      const ctx = getVidCtx();
      const input = ctx.createGain();
      const hi  = ctx.createBiquadFilter(); hi.type  = "highshelf"; hi.frequency.value  = 8000; hi.gain.value  = 0;
      const mid = ctx.createBiquadFilter(); mid.type = "peaking";   mid.frequency.value = 1000; mid.Q.value = 1; mid.gain.value = 0;
      const lo  = ctx.createBiquadFilter(); lo.type  = "lowshelf";  lo.frequency.value  = 250;  lo.gain.value  = 0;
      input.connect(hi); hi.connect(mid); mid.connect(lo); lo.connect(ctx.destination);
      chainRef.current = { hi, mid, lo, input };
      return chainRef.current;
    } catch { return null; }
  };

  // Sync filter gains whenever EQ state changes
  const applyEQ = (side: "A" | "B", hiDb: number, midDb: number, loDb: number) => {
    const chain = getEQChain(side);
    if (!chain) return;
    const ctx = getVidCtx();
    const t = ctx.currentTime;
    chain.hi.gain.setTargetAtTime(hiDb * 2, t, 0.02);  // ±6 steps → ±12 dB
    chain.mid.gain.setTargetAtTime(midDb * 2, t, 0.02);
    chain.lo.gain.setTargetAtTime(loDb * 2, t, 0.02);
  };

  // ── System-audio capture via getDisplayMedia ─────────────────────────────────
  // Chrome/Edge 94+: user grants "Share tab audio" → stream routed through EQ chain
  const startCapture = async (side: "A" | "B") => {
    const streamRef  = side === "A" ? captureStreamA  : captureStreamB;
    const sourceRef  = side === "A" ? captureSourceA  : captureSourceB;
    const setActive  = side === "A" ? setCaptureActiveA : setCaptureActiveB;
    // Stop any existing capture first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      sourceRef.current?.disconnect();
      streamRef.current = null; sourceRef.current = null;
    }
    try {
      const stream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia(c: object): Promise<MediaStream>
      }).getDisplayMedia({ video: false, audio: true } as DisplayMediaStreamOptions);
      const ctx = getVidCtx();
      if (ctx.state !== "running") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const chain  = getEQChain(side);
      if (chain) source.connect(chain.input);
      else       source.connect(ctx.destination);
      streamRef.current  = stream;
      sourceRef.current  = source;
      setActive(true);
      // Auto-stop when user clicks "Stop sharing" in browser UI
      stream.getAudioTracks()[0]?.addEventListener("ended", () => stopCapture(side));
    } catch (err: unknown) {
      // User cancelled or browser denied — not an error
      if (err instanceof Error && err.name !== "NotAllowedError") console.warn("Capture error:", err);
    }
  };

  const stopCapture = (side: "A" | "B") => {
    const streamRef = side === "A" ? captureStreamA : captureStreamB;
    const sourceRef = side === "A" ? captureSourceA : captureSourceB;
    const setActive = side === "A" ? setCaptureActiveA : setCaptureActiveB;
    streamRef.current?.getTracks().forEach(t => t.stop());
    sourceRef.current?.disconnect();
    streamRef.current = null; sourceRef.current = null;
    setActive(false);
  };

  // ── Scratch simulation via Web Audio ────────────────────────────────────────
  // YouTube iframes can't have playbackRate changed — we simulate scratch with
  // a pitched noise oscillator routed through the deck's EQ chain.
  const startScratchOsc = async (side: "A" | "B") => {
    const ref = side === "A" ? scratchOscA : scratchOscB;
    if (ref.current) return;
    try {
      const ctx = getVidCtx();
      if (ctx.state !== "running") await ctx.resume();
      const chain = getEQChain(side);
      const osc  = ctx.createOscillator();
      const bp   = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 300;
      bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 2.5;
      gain.gain.value = 0;
      osc.connect(bp); bp.connect(gain);
      if (chain) gain.connect(chain.input);
      else gain.connect(ctx.destination);
      osc.start();
      ref.current = { osc, gain, bp };
    } catch {}
  };

  const stopScratchOsc = (side: "A" | "B") => {
    const ref = side === "A" ? scratchOscA : scratchOscB;
    if (!ref.current) return;
    try {
      ref.current.gain.gain.setTargetAtTime(0, getVidCtx().currentTime, 0.04);
      const { osc } = ref.current;
      setTimeout(() => { try { osc.stop(); } catch {} }, 150);
    } catch {}
    ref.current = null;
  };

  const onScratchStart = (side: "A" | "B", e: React.PointerEvent) => {
    scratchLastX.current[side] = e.clientX;
    scratchActive.current[side] = true;
    side === "A" ? setScratchA(true) : setScratchB(true);
    side === "A" ? setScratchVelA(0) : setScratchVelB(0);
    startScratchOsc(side);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onScratchMove = (side: "A" | "B", e: React.PointerEvent) => {
    if (!scratchActive.current[side]) return;
    const dx = e.clientX - (scratchLastX.current[side] ?? e.clientX);
    scratchLastX.current[side] = e.clientX;
    // left = reverse (negative vel), right = forward (positive vel)
    const vel = dx;
    const absVel = Math.abs(vel);
    side === "A" ? setScratchVelA(vel) : setScratchVelB(vel);

    // Drive the oscillator with professional vinyl scratch timbre
    const ref = side === "A" ? scratchOscA : scratchOscB;
    if (ref.current) {
      try {
        const ctx  = getVidCtx();
        const t    = ctx.currentTime;
        const norm = Math.min(absVel / 20, 1);          // normalise drag speed 0–1
        const freq    = 120 + norm * 1680;              // 120Hz growl → 1800Hz zip
        const bpFreq  = 800 + norm * 2400;              // bandpass tracks pitch
        const vol     = norm * 0.55;                    // silent at rest, loud at speed
        ref.current.osc.frequency.setTargetAtTime(freq,   t, 0.015);
        ref.current.bp.frequency.setTargetAtTime(bpFreq,  t, 0.015);
        ref.current.gain.gain.setTargetAtTime(vol,         t, 0.015);
      } catch {}
    }
  };

  const onScratchEnd = (side: "A" | "B", e: React.PointerEvent) => {
    scratchActive.current[side] = false;
    side === "A" ? setScratchA(false) : setScratchB(false);
    side === "A" ? setScratchVelA(0) : setScratchVelB(0);
    stopScratchOsc(side);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // ── Single deck renderer ───────────────────────────────────────────────────
  const renderDeck = (side: "A" | "B") => {
    const deck      = side === "A" ? deckA : deckB;
    const setDeck   = side === "A" ? setDeckA : setDeckB;
    const url       = side === "A" ? urlA : urlB;
    const err       = side === "A" ? errA : errB;
    const search    = side === "A" ? searchA : searchB;
    const setSearch = side === "A" ? setSearchA : setSearchB;
    const isPlaying = side === "A" ? playA : playB;
    const setPlay   = side === "A" ? setPlayA : setPlayB;
    const isCue     = side === "A" ? aIsCue : bIsCue;
    const setCue    = side === "A" ? setCueA : setCueB;
    const scratch       = side === "A" ? scratchA : scratchB;
    const scratchVel    = side === "A" ? scratchVelA : scratchVelB;
    const keyLock       = side === "A" ? keyLockA : keyLockB;
    const setKeyLock    = side === "A" ? setKeyLockA : setKeyLockB;
    const captureActive = side === "A" ? captureActiveA : captureActiveB;
    const outVol    = side === "A" ? aOut : bOut;
    const gainPct   = side === "A" ? aGainPct : bGainPct;
    const isLive    = live === side || live === "both";

    const accent    = side === "A" ? "#38bdf8" : "#a78bfa";
    const accentBg  = side === "A" ? "bg-sky-500" : "bg-purple-500";
    const grad      = side === "A" ? "from-sky-500 to-blue-600" : "from-purple-500 to-indigo-600";
    const pitchPct  = (deck.tempo / 100) * 8;
    const tempoLabel = pitchPct === 0 ? "±0%" : (pitchPct > 0 ? `+${pitchPct.toFixed(1)}%` : `${pitchPct.toFixed(1)}%`);
    const embedSrc  = `https://www.youtube.com/embed/${deck.videoId}?controls=1&rel=0&modestbranding=1&autoplay=${isPlaying ? 1 : 0}${deck._startTime != null ? `&start=${Math.floor(deck._startTime)}` : ""}`;

    const BASE    = "#1e2430";
    const SURFACE = "#252d3a";
    const BORDER  = "#2e3a4e";

    return (
      <div className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: BASE, border: `1px solid ${accent}33` }}>

        {/* Header */}
        <div className={`px-3 py-2 bg-gradient-to-r ${grad} flex items-center gap-2`}>
          <Tv2 className="w-4 h-4 text-white flex-shrink-0" />
          <span className="text-[11px] font-bold text-white tracking-widest flex-1 truncate">VIDEO DECK {side}</span>
          {isPlaying && isLive && <span className="text-[9px] font-bold bg-green-400 text-green-900 px-2 py-0.5 rounded-full flex-shrink-0">● LIVE</span>}
          {isCue && <span className="text-[9px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">◎ CUE</span>}
          <button onClick={() => setCue(v => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors flex-shrink-0 ${isCue ? "bg-amber-400 text-amber-900" : "bg-white/20 text-white hover:bg-white/30"}`}
            title={isCue ? "CUE — monitoring on headphones" : "Pre-listen on headphones"}>
            <Headphones className="w-3 h-3" /> {isCue ? "CUE ON" : "CUE"}
          </button>
        </div>

        {/* 2-column body */}
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* ══ LEFT COLUMN ══ */}
          <div className="flex flex-col gap-2.5">

            {/* Platter + transport row */}
            <div className="flex gap-2 items-start">
              {/* Vinyl platter */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
                  style={{ touchAction: "none", boxShadow: `0 0 14px ${accent}2a` }}
                  onPointerDown={e => onScratchStart(side, e)}
                  onPointerMove={e => onScratchMove(side, e)}
                  onPointerUp={e => onScratchEnd(side, e)}
                  onPointerCancel={e => onScratchEnd(side, e)}>
                  <VideoPlatter spinning={isPlaying} side={side} scratch={scratch} />
                </div>
                {/* Scratch velocity bar */}
                <div className="w-20 h-2.5 rounded-full overflow-hidden relative flex items-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: BORDER }} />
                  {scratchVel !== 0 && (
                    <div className="absolute h-full rounded-full"
                      style={{
                        background: scratchVel > 0 ? accent : "#f87171",
                        left:  scratchVel > 0 ? "50%" : `${Math.max(0, 50 - Math.min(50, Math.abs(scratchVel) * 2))}%`,
                        right: scratchVel < 0 ? "50%" : `${Math.max(0, 50 - Math.min(50, Math.abs(scratchVel) * 2))}%`,
                      }} />
                  )}
                </div>
                <p className="text-[7px] text-center" style={{ color: accent + "88" }}>
                  {scratch ? (scratchVel > 1 ? "▶▶ FWD" : scratchVel < -1 ? "◀◀ REV" : "SCRATCH") : "drag"}
                </p>
              </div>

              {/* Readouts + transport */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "TEMPO", val: tempoLabel },
                    { label: "OUT", val: `${outVol}%` },
                    { label: "FADE", val: `${gainPct}%` },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-md px-1 py-1 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                      <div className="text-[7px] font-bold uppercase tracking-wider" style={{ color: accent + "88" }}>{label}</div>
                      <div className="text-[11px] font-mono font-bold leading-tight" style={{ color: accent }}>{val}</div>
                    </div>
                  ))}
                </div>
                {/* Play/Pause + CUE toggle */}
                <div className="flex gap-1">
                  <button onClick={() => setPlay(v => !v)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                    style={{ background: isPlaying ? "#22c55e" : accent, color: "#fff", boxShadow: isPlaying ? "0 0 8px #22c55e44" : `0 0 8px ${accent}44` }}>
                    {isPlaying ? <><Pause className="w-3 h-3" />PAUSE</> : <><Play className="w-3 h-3" />PLAY</>}
                  </button>
                  <button onClick={() => setCue(v => !v)}
                    className="px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all flex-shrink-0"
                    style={isCue
                      ? { background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b55" }
                      : { background: SURFACE, color: "#8b949e", border: `1px solid ${BORDER}` }}>
                    <Headphones className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Video embed */}
            <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: "56.25%", border: `1px solid ${BORDER}` }}>
              <iframe
                key={`${side}-${deck.videoId}-${deck._startTime ?? 0}-${isPlaying ? "play" : "pause"}`}
                src={embedSrc}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen title={deck.title} />
            </div>

            {/* Track title */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg min-w-0" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <Tv2 className="w-3 h-3 flex-shrink-0" style={{ color: accent + "88" }} />
              <span className="text-[10px] font-semibold truncate flex-1 min-w-0" style={{ color: "#c9d1d9" }}>{deck.title}</span>
            </div>

            {/* Tempo fader */}
            <div className="rounded-xl px-2.5 py-2" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: accent + "99" }}>Tempo ±8%</span>
                <button onClick={() => setKeyLock(v => !v)}
                  className="flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                  style={keyLock
                    ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
                    : { background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}>
                  {keyLock ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />} KEY
                </button>
              </div>
              <input type="range" min={-100} max={100} value={deck.tempo}
                onChange={e => setDeck(d => ({ ...d, tempo: Number(e.target.value) }))}
                className="w-full cursor-pointer" style={{ accentColor: accent }} />
              <div className="flex justify-between text-[7px] mt-0.5" style={{ color: accent + "55" }}>
                <span>-8%</span><span>0</span><span>+8%</span>
              </div>
            </div>

            {/* URL input + Search */}
            <div className="space-y-1.5">
              <div className="relative">
                <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "#6b7a90" }} />
                <input value={url} onChange={e => handleUrl(side, e.target.value)}
                  onPaste={e => { const v = e.clipboardData.getData("text"); setTimeout(() => handleUrl(side, v), 0); }}
                  placeholder="Paste YouTube URL…"
                  className="w-full pl-7 pr-2 py-1.5 text-[10px] rounded-lg focus:outline-none"
                  style={{ background: BASE, color: "#c9d1d9", border: `1px solid ${BORDER}` }} />
              </div>
              {err && <p className="text-[10px] text-red-400">{err}</p>}
              <div className="flex gap-1.5">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && search.trim()) window.open(ytSearch(search), "_blank"); }}
                  placeholder="Search videos…"
                  className="flex-1 px-2 py-1.5 text-[10px] rounded-lg focus:outline-none min-w-0"
                  style={{ background: BASE, color: "#c9d1d9", border: `1px solid ${BORDER}` }} />
                <a href={search.trim() ? ytSearch(search) : "#"} target="_blank" rel="noopener noreferrer"
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r ${grad} hover:opacity-90 whitespace-nowrap flex-shrink-0`}>
                  Search →
                </a>
              </div>
            </div>

            {/* Quick presets */}
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wide mb-1" style={{ color: accent + "88" }}>Quick Load</p>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setDeck(mkDeck(p.id, p.title))}
                    className="text-[9px] px-2 py-0.5 rounded-md border transition-colors"
                    style={deck.videoId === p.id
                      ? { background: accent + "22", color: accent, border: `1px solid ${accent}55` }
                      : { background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}>
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="flex flex-col gap-2.5">

            {/* 3-Band EQ */}
            <div className="rounded-xl px-2.5 py-2 space-y-1.5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: accent + "99" }}>3-Band EQ</span>
                <div className="flex gap-1">
                  <button onClick={() => captureActive ? stopCapture(side) : startCapture(side)}
                    className="flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-md border transition-colors"
                    style={captureActive
                      ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
                      : { background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}>
                    {captureActive ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                    {captureActive ? "LIVE" : "Capture"}
                  </button>
                  <button onClick={() => { setDeck(d => ({ ...d, eqHi: 0, eqMid: 0, eqLo: 0 })); applyEQ(side, 0, 0, 0); }}
                    className="text-[8px] px-1.5 py-0.5 rounded-md border transition-colors"
                    style={{ background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}>Flat</button>
                </div>
              </div>
              {captureActive && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: "#22c55e11", border: "1px solid #22c55e33" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  <p className="text-[8px] text-green-300">Tab audio captured — EQ active</p>
                </div>
              )}
              <EQCurve hi={deck.eqHi} mid={deck.eqMid} lo={deck.eqLo} color={accent} />
              <EQFader label="Hi  8kHz" value={deck.eqHi}  onChange={v => { applyEQ(side, v, deck.eqMid, deck.eqLo); setDeck(d => ({ ...d, eqHi: v })); }}  color={accent} />
              <EQFader label="Mid 1kHz" value={deck.eqMid} onChange={v => { applyEQ(side, deck.eqHi, v, deck.eqLo); setDeck(d => ({ ...d, eqMid: v })); }} color={accent} />
              <EQFader label="Lo 250Hz" value={deck.eqLo}  onChange={v => { applyEQ(side, deck.eqHi, deck.eqMid, v); setDeck(d => ({ ...d, eqLo: v })); }} color={accent} />
            </div>

            {/* Hot Cue Pads */}
            <div className="rounded-xl px-2.5 py-2" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <p className="text-[8px] font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color: accent + "99" }}>
                <Bookmark className="w-2.5 h-2.5" /> Hot Cues ({deck.hotCues.length}/8)
              </p>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 8 }, (_, i) => {
                  const c = deck.hotCues[i];
                  return (
                    <button key={i}
                      onClick={() => { if (c) removeHotCue(side, c.id); else addHotCue(side, `C${i + 1}`); }}
                      className="h-8 rounded-lg text-[9px] font-bold flex flex-col items-center justify-center transition-all active:scale-95"
                      style={c
                        ? { background: c.color + "30", color: c.color, border: `1px solid ${c.color}88` }
                        : { background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}
                      title={c ? `Remove ${c.label}` : `Set C${i + 1}`}>
                      {c ? c.label : `C${i + 1}`}
                    </button>
                  );
                })}
              </div>
              <p className="text-[7px] mt-1" style={{ color: BORDER }}>Tap to set · tap again to remove</p>
            </div>

            {/* Loop */}
            <div className="rounded-xl px-2.5 py-2" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-1 mb-1.5">
                <Repeat className="w-2.5 h-2.5" style={{ color: accent + "99" }} />
                <span className="text-[8px] font-bold uppercase tracking-wide flex-1" style={{ color: accent + "99" }}>Loop</span>
                {deck.loopActive && <span className="text-[8px] font-bold animate-pulse" style={{ color: "#22c55e" }}>● LOOPING</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setDeck(d => ({ ...d, loopStart: "set", loopActive: false }))}
                  className="flex-1 py-1 rounded-md text-[8px] font-bold transition-colors"
                  style={deck.loopStart
                    ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
                    : { background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}>
                  IN {deck.loopStart ? "✓" : ""}
                </button>
                <button onClick={() => setDeck(d => ({ ...d, loopEnd: "set", loopActive: !!(d.loopStart) }))}
                  className="flex-1 py-1 rounded-md text-[8px] font-bold transition-colors"
                  style={deck.loopEnd
                    ? { background: "#3b82f622", color: "#60a5fa", border: "1px solid #3b82f644" }
                    : { background: BASE, color: "#6b7a90", border: `1px solid ${BORDER}` }}>
                  OUT {deck.loopEnd ? "✓" : ""}
                </button>
                <button onClick={() => setDeck(d => ({ ...d, loopStart: null, loopEnd: null, loopActive: false }))}
                  className="px-2 py-1 rounded-md text-[8px] font-bold transition-colors"
                  style={{ background: BASE, color: "#ef4444", border: "1px solid #ef444433" }}>Clear</button>
              </div>
            </div>

            {/* Volume */}
            <div className="rounded-xl px-2.5 py-2" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: accent + "99" }}>Volume</span>
                <span className="text-[8px] font-mono font-bold" style={{ color: accent }}>{deck.volume}%</span>
              </div>
              <input type="range" min={0} max={100} value={deck.volume}
                onChange={e => setDeck(d => ({ ...d, volume: Number(e.target.value) }))}
                className="w-full cursor-pointer" style={{ accentColor: accent }} />
            </div>

          </div>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>

      {/* Decks side-by-side */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderDeck("A")}
        {renderDeck("B")}
      </div>

      {/* ── Crossfader ── */}
      <div className="mx-3 mb-3 rounded-2xl overflow-hidden" style={{ background: "#252d3a", border: "1px solid #2e3a4e" }}>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#38bdf810 0%,#a78bfa10 100%)", borderBottom: "1px solid #2e3a4e" }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <p className="text-xs font-bold text-white">Video Crossfader</p>
          </div>
          <div className="text-right">
            {/* Live / CUE status pills */}
            <div className="flex gap-2">
              {[
                { label: "VIDEO A", isLive: crossfade < 50, equal: crossfade === 50, accent: "#38bdf8" },
                { label: "VIDEO B", isLive: crossfade > 50, equal: crossfade === 50, accent: "#a78bfa" },
              ].map(({ label, isLive: l, equal, accent: a }) => (
                <span key={label} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={l
                    ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
                    : equal
                    ? { background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }
                    : { background: "#252d3a", color: a, border: `1px solid ${a}44` }}>
                  {l ? "● LIVE" : equal ? "= MIX" : "◎ CUE"} {label.replace("VIDEO ", "")}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Fader */}
          <div>
            <div className="flex justify-between text-[9px] font-bold mb-1">
              <span style={{ color: "#38bdf8" }}>◀ DECK A</span>
              <span style={{ color: "#6b7a90" }}>50/50</span>
              <span style={{ color: "#a78bfa" }}>DECK B ▶</span>
            </div>
            <div className="relative h-12 flex items-center rounded-xl px-3" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>
              <div className="absolute inset-y-0 left-3 right-3 flex items-center pointer-events-none">
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#2e3a4e" }}>
                  <div className="h-full rounded-full" style={{ width: `${crossfade}%`, background: "linear-gradient(to right,#38bdf8,#a78bfa)" }} />
                </div>
              </div>
              <div className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none z-10"
                style={{
                  left: `calc(${crossfade}% * (100% - 44px) / 100 + 12px - 10px)`,
                  top: "50%", transform: "translateY(-50%)",
                  background: crossfade <= 50 ? "#38bdf8" : "#a78bfa",
                  boxShadow: `0 0 10px ${crossfade <= 50 ? "#38bdf844" : "#a78bfa44"}`,
                }} />
              <input type="range" min={0} max={100} value={crossfade}
                onChange={e => { if (fadingRef.current) { clearInterval(fadingRef.current); fadingRef.current = null; } setCrossfade(Number(e.target.value)); }}
                className="relative w-full h-10 z-20 bg-transparent cursor-pointer opacity-0" />
            </div>
            {/* Level meters */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { label: "A", pct: aGainPct, isCue: aIsCue, from: "#38bdf8", to: "#0ea5e9" },
                { label: "B", pct: bGainPct, isCue: bIsCue, from: "#a78bfa", to: "#7c3aed" },
              ].map(({ label, pct, isCue, from, to }) => (
                <div key={label}>
                  <div className="flex justify-between text-[8px] mb-0.5">
                    <span style={{ color: from }}>Deck {label} {isCue && "◎"}</span>
                    <span className="font-mono font-bold" style={{ color: isCue ? "#f59e0b" : from }}>{isCue ? "CUE" : `${pct}%`}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2e3a4e" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to right,${from},${to})` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fade speed + Snap + Transition FX in one row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

            {/* Fade speed */}
            <div className="rounded-xl p-2" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>
              <p className="text-[8px] font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color: "#38bdf888" }}>
                <Zap className="w-2.5 h-2.5" />Fade Speed
              </p>
              <div className="flex flex-col gap-1">
                {FADE_SPEEDS.map(({ label, ms }) => (
                  <button key={ms} onClick={() => setFadeSpeedMs(ms)}
                    className="w-full py-1 rounded-md text-[8px] font-bold text-left px-1.5 transition-all"
                    style={fadeSpeedMs === ms
                      ? { background: "#38bdf822", color: "#38bdf8", border: "1px solid #38bdf844" }
                      : { background: "transparent", color: "#6b7a90", border: "1px solid #2e3a4e" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Snap positions */}
            <div className="rounded-xl p-2" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>
              <p className="text-[8px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#a78bfa88" }}>Snap To</p>
              <div className="flex flex-col gap-1">
                {[
                  { v: 0, l: "Full A" }, { v: 25, l: "A Mix" }, { v: 50, l: "Center" }, { v: 75, l: "B Mix" }, { v: 100, l: "Full B" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => sweepTo(v)}
                    className="w-full py-1 rounded-md text-[8px] font-bold text-left px-1.5 transition-all"
                    style={crossfade === v
                      ? { background: v <= 50 ? "#38bdf822" : "#a78bfa22", color: v <= 50 ? "#38bdf8" : "#a78bfa", border: `1px solid ${v <= 50 ? "#38bdf844" : "#a78bfa44"}` }
                      : { background: "transparent", color: "#6b7a90", border: "1px solid #2e3a4e" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Transition FX */}
            <div className="rounded-xl p-2" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>
              <p className="text-[8px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#a78bfa88" }}>Transition FX</p>
              <div className="flex flex-col gap-1">
                {TRANSITION_FX.map(({ id, label }) => (
                  <button key={id} onClick={() => setTransitionFx(id)}
                    className="w-full py-1 rounded-md text-[8px] font-bold text-left px-1.5 transition-all"
                    style={transitionFx === id
                      ? { background: "#a78bfa22", color: "#a78bfa", border: "1px solid #a78bfa44" }
                      : { background: "transparent", color: "#6b7a90", border: "1px solid #2e3a4e" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Sample Pads ── */}
      <div className="mx-3 mb-3 rounded-2xl overflow-hidden" style={{ background: "#1e2430", border: "1px solid #2e3a4e" }}>
        <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: "#2e3a4e" }}>
          <span className="text-xs font-bold text-white tracking-widest uppercase">Sample Pads</span>
          <p className="text-[9px] mt-0.5" style={{ color: "#8b949e" }}>Tap to fire · hover → 📂 load custom · ↺ restore</p>
        </div>
        <div className="p-3 flex flex-wrap gap-2 justify-center">
          {vidPads.map((pad, i) => {
            const isActive  = activePad === i;
            const isLoading = loadingPad === i;
            const playPad = async () => {
              if (isLoading) return;
              setActivePad(i);
              const ctx = getVidCtx();
              if (ctx.state !== "running") await ctx.resume();
              if (pad.customAudioBuf) {
                const s = ctx.createBufferSource(), g = ctx.createGain();
                s.buffer = pad.customAudioBuf; s.connect(g); g.connect(ctx.destination);
                g.gain.value = 0.8; s.start();
              } else { pad.play(); }
            };
            return (
              <div key={i} className="relative group">
                <button onPointerDown={playPad} onPointerUp={() => setActivePad(null)} onPointerLeave={() => setActivePad(null)}
                  disabled={isLoading}
                  className="w-24 h-14 rounded-xl text-white font-bold text-[11px] tracking-wide transition-all select-none border border-white/10 shadow-lg disabled:opacity-40"
                  style={{
                    background: pad.color,
                    transform: isActive ? "scale(0.9)" : "scale(1)",
                    boxShadow: isActive ? `0 0 12px ${pad.color}88` : undefined,
                  }}>
                  {isLoading ? "…" : pad.label}
                  {pad.custom && <span className="ml-1 text-yellow-300 text-[9px]">★</span>}
                </button>
                <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex gap-px z-10 rounded-b-xl overflow-hidden">
                  <label className="flex-1 flex items-center justify-center py-1 bg-black/70 hover:bg-black/90 text-white text-[10px] cursor-pointer">
                    📂
                    <input type="file" accept="audio/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return;
                        setLoadingPad(i);
                        try {
                          const ctx = getVidCtx();
                          if (ctx.state !== "running") await ctx.resume();
                          const buf = await ctx.decodeAudioData(await file.arrayBuffer());
                          const name = file.name.replace(/\.[^.]+$/, "").slice(0, 10);
                          setVidPads(ps => ps.map((p, idx) => idx !== i ? p : { ...p, label: name, custom: true, customAudioBuf: buf }));
                        } catch {} finally { setLoadingPad(null); e.target.value = ""; }
                      }} />
                  </label>
                  {pad.custom && (
                    <button onClick={() => setVidPads(ps => ps.map((p, idx) => idx !== i ? p : { ...VIDEO_PADS[i], custom: false, customAudioBuf: null }))}
                      className="flex-1 flex items-center justify-center py-1 bg-black/70 hover:bg-black/90 text-white text-[10px]">↺</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
