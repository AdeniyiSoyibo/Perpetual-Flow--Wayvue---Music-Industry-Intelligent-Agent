"use client";
import { usePlatformStore } from "@/lib/store";
import { Play, Pause, Square, Upload, Lock, Unlock } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useMidiAction } from "./MidiEngine";

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Shared Web Audio context — one per page, both decks share it
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
  return sharedAudioCtx;
}

export type DeckNodes = { gain: GainNode; cueGain: GainNode; eqLo: BiquadFilterNode; eqMid: BiquadFilterNode; eqHi: BiquadFilterNode }
export const deckNodes: Record<"A" | "B", DeckNodes | null> = { A: null, B: null }
export const deckGains: Record<"A" | "B", GainNode | null> = { A: null, B: null }
export const deckCueGains: Record<"A" | "B", GainNode | null> = { A: null, B: null }

const TEMPO_RANGES = [
  { range: 4,  label: "±4%"  },
  { range: 8,  label: "±8%"  },
  { range: 16, label: "±16%" },
  { range: 50, label: "±50%" },
];
const RPM_MODES = [33, 45, 78] as const
type RPMMode = typeof RPM_MODES[number]
const CUE_COLORS = ["#38bdf8","#f472b6","#34d399","#fb923c","#a78bfa","#facc15","#f87171","#60a5fa"]

interface HotCue { time: number; label: string; color: string; }

function Platter({ spinning, scratch, rpm, side }: { spinning: boolean; scratch: boolean; rpm: RPMMode; side: "A"|"B" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef  = useRef(0);
  const rafRef    = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = W / 2 - 2;
    const accent = side === "A" ? "#38bdf8" : "#a78bfa";
    const rpmSpeed = rpm === 33 ? 0.004 : rpm === 45 ? 0.006 : 0.011;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // Outer ring
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "#1a2233"; ctx.fill();
      // Grooves
      for (let r = R - 4; r > 8; r -= 6) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,0.03)`; ctx.lineWidth = 1; ctx.stroke();
      }
      // Spinning lines
      if (spinning || scratch) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(angleRef.current);
        for (let i = 0; i < 12; i++) {
          ctx.rotate(Math.PI * 2 / 12);
          ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, R - 4);
          ctx.strokeStyle = accent + "22"; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.restore();
        angleRef.current += rpmSpeed * (scratch ? 3 : 1);
      }
      // Centre label
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#252d3a"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.strokeStyle = accent + "66"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = accent; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(side, cx, cy);
    };

    const tick = () => { draw(); rafRef.current = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, scratch, rpm, side]);

  return <canvas ref={canvasRef} width={80} height={80} style={{ display: "block" }} />;
}

export function DeckController({ side }: { side: "A" | "B" }) {
  const { deckA, deckB, setDeckA, setDeckB, crossfade } = usePlatformStore();
  const track = side === "A" ? deckA : deckB;
  const setTrack = side === "A" ? setDeckA : setDeckB;

  const [playing, setPlayingState]  = useState(false);
  const playingRef = useRef(false);
  const setPlaying = (v: boolean) => { playingRef.current = v; setPlayingState(v); };
  const [progress, setProgress]     = useState(0);
  const [duration, setDuration]     = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [tempoRange, setTempoRange] = useState(8);
  const [tempoOffset, setTempoOffset] = useState(0);
  const [keyLock, setKeyLock]       = useState(false);
  const [rpm, setRpm]               = useState<RPMMode>(33);
  const [baseBpmOverride, setBaseBpmOverride] = useState<number | null>(null);
  const [targetBpm, setTargetBpm]   = useState("");
  const tapTimesRef = useRef<number[]>([]);
  const [tapBpm, setTapBpm]         = useState<number | null>(null);

  const [eqHi, setEqHi]   = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqLo, setEqLo]   = useState(0);
  const [trim, setTrim]   = useState(0);

  const [hotCues, setHotCues]       = useState<HotCue[]>([]);
  const [loopStart, setLoopStart]   = useState<number | null>(null);
  const [loopEnd, setLoopEnd]       = useState<number | null>(null);
  const [loopActive, setLoopActive] = useState(false);
  const [cuePoint, setCuePoint]     = useState(0);

  const [scratchVal, setScratchVal] = useState(0);
  const [cueVolume, setCueVolume]   = useState(40);

  const [uploadedURL,  setUploadedURL]  = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef     = useRef<GainNode | null>(null);
  const cueGainRef  = useRef<GainNode | null>(null);
  const eqLoRef     = useRef<BiquadFilterNode | null>(null);
  const eqMidRef    = useRef<BiquadFilterNode | null>(null);
  const eqHiRef     = useRef<BiquadFilterNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef      = useRef<number>(0);
  const platRef     = useRef<HTMLDivElement>(null);

  const accent   = side === "A" ? "#38bdf8" : "#a78bfa";
  const BASE     = "#1e2430";
  const SURFACE  = "#252d3a";
  const BORDER   = "#2e3a4e";
  const BORDER2  = "#37455a";

  const pitchPct = (tempoOffset / 100) * tempoRange;
  const playbackRate = 1 + pitchPct / 100;
  const baseBpm  = baseBpmOverride ?? tapBpm ?? track?.bpm ?? 120;
  const effectiveBpm = Math.round(baseBpm * playbackRate * 10) / 10;

  const displayTitle = uploadedName ?? track?.title ?? null;

  const handleTap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    const recent = taps.filter(t => now - t < 3000);
    recent.push(now);
    tapTimesRef.current = recent;
    if (recent.length >= 2) {
      const gaps = recent.slice(1).map((t, i) => t - recent[i]);
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const bpm = Math.round(60000 / avgGap);
      setTapBpm(Math.max(40, Math.min(220, bpm)));
    }
  }, []);

  const matchBpm = useCallback((targetStr: string) => {
    const target = parseFloat(targetStr);
    if (isNaN(target) || target < 40 || target > 220) return;
    const neededPct = (target / baseBpm - 1) * 100;
    const needed = Math.max(-tempoRange, Math.min(tempoRange, neededPct));
    setTempoOffset(Math.round((needed / tempoRange) * 100));
    setTargetBpm("");
  }, [baseBpm, tempoRange]);

  const autoLoop = useCallback((beats: number) => {
    const el = audioRef.current;
    if (!el) return;
    const beatsPerSec = effectiveBpm / 60;
    const loopDur = beats / beatsPerSec;
    const start = el.currentTime;
    setLoopStart(start);
    setLoopEnd(start + loopDur);
    setLoopActive(true);
  }, [effectiveBpm]);

  const loopHalve = useCallback(() => {
    if (loopStart === null || loopEnd === null) return;
    setLoopEnd(loopStart + (loopEnd - loopStart) / 2);
  }, [loopStart, loopEnd]);

  const loopDouble = useCallback(() => {
    if (loopStart === null || loopEnd === null) return;
    setLoopEnd(loopStart + (loopEnd - loopStart) * 2);
  }, [loopStart, loopEnd]);

  const ensureGraph = useCallback(() => {
    const el = audioRef.current;
    if (!el || sourceRef.current) return;
    const ctx = getAudioCtx();
    const source    = ctx.createMediaElementSource(el);
    const gainNode  = ctx.createGain();
    const cueNode   = ctx.createGain();
    const loNode    = ctx.createBiquadFilter();
    const midNode   = ctx.createBiquadFilter();
    const hiNode    = ctx.createBiquadFilter();
    loNode.type  = "lowshelf";  loNode.frequency.value  = 200;
    midNode.type = "peaking";   midNode.frequency.value = 1000; midNode.Q.value = 1;
    hiNode.type  = "highshelf"; hiNode.frequency.value  = 8000;
    source.connect(loNode); loNode.connect(midNode); midNode.connect(hiNode);
    hiNode.connect(gainNode);  gainNode.connect(ctx.destination);
    hiNode.connect(cueNode);   cueNode.connect(ctx.destination);
    sourceRef.current = source;
    gainRef.current   = gainNode;
    cueGainRef.current = cueNode;
    eqLoRef.current = loNode; eqMidRef.current = midNode; eqHiRef.current = hiNode;
    deckGains[side]    = gainNode;
    deckCueGains[side] = cueNode;
    deckNodes[side]    = { gain: gainNode, cueGain: cueNode, eqLo: loNode, eqMid: midNode, eqHi: hiNode };
    const angle = (crossfade / 100) * (Math.PI / 2);
    const xfade = side === "A"
      ? (crossfade >= 100 ? 0 : crossfade === 0 ? 1 : Math.cos(angle))
      : (crossfade <= 0   ? 0 : crossfade === 100 ? 1 : Math.sin(angle));
    gainNode.gain.value = xfade;
    cueNode.gain.value  = xfade === 0 ? (cueVolume / 100) : 0;
  }, [side, crossfade]); // eslint-disable-line

  useEffect(() => { if (eqLoRef.current)  eqLoRef.current.gain.value  = eqLo;  }, [eqLo]);
  useEffect(() => { if (eqMidRef.current) eqMidRef.current.gain.value = eqMid; }, [eqMid]);
  useEffect(() => { if (eqHiRef.current)  eqHiRef.current.gain.value  = eqHi;  }, [eqHi]);

  useEffect(() => {
    const g   = gainRef.current;
    const cue = cueGainRef.current;
    if (!g || !cue) return;
    const angle = (crossfade / 100) * (Math.PI / 2);
    const xfadeGain = side === "A"
      ? (crossfade >= 100 ? 0 : crossfade === 0 ? 1 : Math.cos(angle))
      : (crossfade <= 0   ? 0 : crossfade === 100 ? 1 : Math.sin(angle));
    g.gain.value   = xfadeGain * Math.pow(10, trim / 20);
    cue.gain.value = xfadeGain === 0 ? (cueVolume / 100) : 0;
  }, [crossfade, trim, cueVolume, side]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
    (el as any).preservesPitch = keyLock;
  }, [playbackRate, keyLock]);

  const activeSrc = uploadedURL;
  const hasAudio  = !!activeSrc;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !activeSrc) return;
    el.src = activeSrc;
    el.load();
    el.onloadedmetadata = () => {
      setDuration(el.duration);
      ensureGraph();
    };
  }, [activeSrc]); // eslint-disable-line

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !loopActive || loopStart === null || loopEnd === null) return;
    const id = setInterval(() => { if (el.currentTime >= loopEnd!) el.currentTime = loopStart!; }, 50);
    return () => clearInterval(id);
  }, [loopActive, loopStart, loopEnd]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !activeSrc) return;
    ensureGraph();
    el.playbackRate = playbackRate;
    if (el.paused) {
      el.play().then(() => {
        setPlaying(true);
        const tick = () => {
          setProgress((el.currentTime / (el.duration || 1)) * 100);
          setCurrentTime(el.currentTime);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }).catch(() => {});
    } else {
      el.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current);
    }
  };

  const stop = () => {
    const el = audioRef.current;
    if (!el) return;
    el.pause(); el.currentTime = 0;
    setPlaying(false); setProgress(0); setCurrentTime(0);
    cancelAnimationFrame(rafRef.current);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  const handleFile = useCallback((file: File) => {
    if (uploadedURL) URL.revokeObjectURL(uploadedURL);
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "");
    setUploadedURL(url);
    setUploadedName(name);
    setPlaying(false); setProgress(0); setCurrentTime(0);
    setTrack({ id: url, title: name, artist: "Local File", coverUrl: "", duration: 0, bpm: 120, energy: 0.8, valence: 0.5, danceability: 0.8, key: "—", platform: "file", src: url });
  }, [uploadedURL, setTrack]);

  const setHotCue = (idx: number) => {
    const el = audioRef.current;
    if (!el) return;
    const updated = [...hotCues];
    updated[idx] = { time: el.currentTime, label: `C${idx + 1}`, color: CUE_COLORS[idx] };
    setHotCues(updated);
  };
  const jumpHotCue = (idx: number) => {
    const el = audioRef.current; const c = hotCues[idx];
    if (!el || !c) return;
    el.currentTime = c.time;
    if (!playing) togglePlay();
  };

  const setLoopIn  = () => { const el = audioRef.current; if (el) setLoopStart(el.currentTime); };
  const setLoopOut = () => { const el = audioRef.current; if (el) { setLoopEnd(el.currentTime); setLoopActive(true); } };
  const clearLoop  = () => { setLoopStart(null); setLoopEnd(null); setLoopActive(false); };

  const midiPrefix = `deck_${side.toLowerCase()}_`;
  useMidiAction(useCallback((action: string, value: number) => {
    if (!action.startsWith(midiPrefix)) return;
    const ctrl = action.slice(midiPrefix.length);
    const el = audioRef.current;
    switch (ctrl) {
      case "play":    if (value > 63) togglePlay(); break;
      case "cue":     if (value > 63 && el) el.currentTime = cuePoint; break;
      case "tempo":   setTempoOffset(Math.round((value / 127) * 200 - 100)); break;
      case "volume":  setTrim(Math.round(((value / 127) * 24) - 12)); break;
      case "eq_hi":   setEqHi(Math.round(((value / 127) * 24) - 12)); break;
      case "eq_mid":  setEqMid(Math.round(((value / 127) * 24) - 12)); break;
      case "eq_lo":   setEqLo(Math.round(((value / 127) * 24) - 12)); break;
      case "loop_in": if (value > 63) setLoopIn(); break;
      case "loop_out":if (value > 63) setLoopOut(); break;
      default:
        if (ctrl.startsWith("hotcue_")) {
          const idx = parseInt(ctrl.slice(7)) - 1;
          if (!isNaN(idx) && value > 63) {
            if (hotCues[idx]) jumpHotCue(idx); else setHotCue(idx);
          }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiPrefix, cuePoint, hotCues]));

  // ── Scratch oscillator refs ───────────────────────────────────────────────
  const scratchOscRef  = useRef<OscillatorNode | null>(null);
  const scratchGainRef = useRef<GainNode | null>(null);
  const scratchBpRef   = useRef<BiquadFilterNode | null>(null);

  const startScratchOsc = () => {
    if (scratchOscRef.current) return;
    try {
      const ctx = getAudioCtx();
      // Sawtooth → bandpass (vinyl body resonance) → gain → destination
      const osc  = ctx.createOscillator();
      const bp   = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 300;
      bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 2.5;
      gain.gain.value = 0;
      osc.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
      osc.start();
      scratchOscRef.current  = osc;
      scratchBpRef.current   = bp;
      scratchGainRef.current = gain;
    } catch {}
  };

  const stopScratchOsc = () => {
    const osc  = scratchOscRef.current;
    const gain = scratchGainRef.current;
    if (!osc || !gain) return;
    try {
      const ctx = getAudioCtx();
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
      setTimeout(() => { try { osc.stop(); } catch {} }, 150);
    } catch {}
    scratchOscRef.current  = null;
    scratchGainRef.current = null;
    scratchBpRef.current   = null;
  };

  const handleScratchChange = (val: number) => {
    setScratchVal(val);
    const el = audioRef.current;
    if (!el || !activeSrc) return;
    ensureGraph();
    if (el.paused) el.play().catch(() => {});
    // Playback rate: centre=1×, right=4×, left=near-stop
    const rate = val >= 0
      ? 1 + (val / 100) * 3
      : Math.max(0.01, 1 + (val / 100));
    el.playbackRate = rate;

    // Drive the scratch oscillator to sound like vinyl being dragged
    startScratchOsc();
    const osc  = scratchOscRef.current;
    const gain = scratchGainRef.current;
    const bp   = scratchBpRef.current;
    if (!osc || !gain || !bp) return;
    try {
      const ctx  = getAudioCtx();
      const t    = ctx.currentTime;
      const absV = Math.abs(val) / 100;           // 0–1
      // Frequency: slow drag = low growl (~120Hz), fast = high zip (~1800Hz)
      const freq = 120 + absV * 1680;
      // Bandpass centre tracks pitch for vinyl "body" resonance
      const bpFreq = 800 + absV * 2400;
      // Volume: louder at higher speed, silent at centre
      const vol = absV * 0.55;
      osc.frequency.setTargetAtTime(freq,   t, 0.015);
      bp.frequency.setTargetAtTime(bpFreq,  t, 0.015);
      gain.gain.setTargetAtTime(vol,         t, 0.015);
    } catch {}
  };

  const handleScratchRelease = () => {
    setScratchVal(0);
    const el = audioRef.current;
    if (el) el.playbackRate = playbackRate;
    stopScratchOsc();
  };

  const SL = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: accent + "99" }}>{children}</p>
  );

  return (
    <div className="rounded-2xl overflow-hidden shadow-md flex flex-col"
      style={{ background: BASE, border: `1px solid ${accent}44` }}>

      {/* ── Header ── */}
      <div className="px-3 py-2.5 flex items-center gap-2.5"
        style={{ background: `linear-gradient(135deg, ${accent}30 0%, ${accent}10 100%)`, borderBottom: `1px solid ${accent}33` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 0 10px ${accent}44` }}>
          {side}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] font-bold tracking-widest uppercase flex-shrink-0" style={{ color: accent + "cc" }}>AUDIO DECK {side}</span>
          <span className="text-[11px] font-semibold text-white/80 truncate">{displayTitle ?? "No track loaded"}</span>
        </div>
        {playing && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>● LIVE</span>}
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-colors flex-shrink-0"
          style={{ background: accent + "25", color: accent, border: `1px solid ${accent}55` }}>
          <Upload className="w-3 h-3" /> Load
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* ── 2-column body ── */}
      <div className="p-3 grid grid-cols-2 gap-3 flex-1">

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="flex flex-col gap-2.5">

          {/* Platter + Transport */}
          <div className="flex gap-2.5 items-start">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div ref={platRef} className="w-20 h-20 rounded-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
                style={{ boxShadow: `0 0 14px ${accent}${scratchVal !== 0 ? "66" : "2a"}`, touchAction: "none" }}
                onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                onPointerMove={e => {
                  if (e.buttons === 0) return;
                  const dx = e.movementX;
                  const val = Math.max(-100, Math.min(100, Math.round(dx * 4)));
                  if (val !== 0) handleScratchChange(val);
                }}
                onPointerUp={handleScratchRelease}
                onPointerCancel={handleScratchRelease}>
                <Platter spinning={playing || scratchVal !== 0} scratch={scratchVal !== 0} rpm={rpm} side={side} />
              </div>
              <div className="w-20">
                <input
                  type="range" min={-100} max={100} step={1} value={scratchVal}
                  onChange={e => handleScratchChange(Number(e.target.value))}
                  onMouseUp={handleScratchRelease}
                  onTouchEnd={handleScratchRelease}
                  onPointerUp={handleScratchRelease}
                  className="w-full cursor-ew-resize"
                  style={{ accentColor: scratchVal !== 0 ? "#f59e0b" : accent }}
                />
                <div className="flex justify-between text-[7px]" style={{ color: accent + "66" }}>
                  <span>◀</span>
                  <span style={{ color: scratchVal !== 0 ? "#f59e0b" : accent + "88" }}>
                    {scratchVal !== 0 ? (scratchVal > 0 ? `▶ +${scratchVal}` : `◀ ${scratchVal}`) : "SCRATCH"}
                  </span>
                  <span>▶</span>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: "BPM", val: String(effectiveBpm) },
                  { label: "KEY", val: track?.key ?? "—" },
                  { label: "TIME", val: formatDuration(Math.floor(currentTime)) },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-md px-1.5 py-1 text-center"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                    <div className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: accent + "88" }}>{label}</div>
                    <div className="text-[11px] font-mono font-bold leading-none" style={{ color: accent }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 items-center">
                <button onClick={togglePlay} disabled={!hasAudio}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: playing ? "#22c55e" : accent, color: "#fff", boxShadow: playing ? "0 0 8px #22c55e44" : `0 0 8px ${accent}44` }}>
                  {playing ? <><Pause className="w-3 h-3" />PAUSE</> : <><Play className="w-3 h-3" />PLAY</>}
                </button>
                <button onClick={stop}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: "#7a9abf" }}>
                  <Square className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-1">
                {RPM_MODES.map(r => (
                  <button key={r} onClick={() => setRpm(r)}
                    className="flex-1 text-[8px] font-bold py-0.5 rounded-md transition-colors"
                    style={{ background: rpm === r ? accent + "30" : SURFACE, color: rpm === r ? accent : "#4a6580", border: `1px solid ${rpm === r ? accent + "55" : BORDER}` }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Waveform */}
          <div>
            <div className="h-8 flex items-end gap-px rounded-lg px-1.5 py-1 cursor-pointer"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
              onClick={seek}>
              {Array.from({ length: 50 }, (_, i) => {
                const v = 0.2 + 0.75 * Math.abs(Math.sin(i * 0.37 + (side === "A" ? 0 : 1.1)));
                const played = (i / 50) * 100 < progress;
                return <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, Math.round(v * 1000) / 10)}%`, background: played ? accent : accent + "22" }} />;
              })}
            </div>
            <div className="flex justify-between text-[8px] font-mono px-0.5 mt-0.5" style={{ color: accent + "55" }}>
              <span>{formatDuration(Math.floor(currentTime))}</span>
              <span>{formatDuration(Math.floor(duration))}</span>
            </div>
          </div>

          {/* Pitch / Tempo */}
          <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <SL>Pitch / Tempo</SL>
              <div className="flex gap-1">
                <button onClick={() => setKeyLock(k => !k)}
                  className="flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                  style={{ background: keyLock ? "#f59e0b22" : BASE, color: keyLock ? "#f59e0b" : "#4a6580", border: `1px solid ${keyLock ? "#f59e0b44" : BORDER}` }}>
                  {keyLock ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                  KEY {keyLock ? "LOCK" : "OFF"}
                </button>
                {TEMPO_RANGES.map(t => (
                  <button key={t.range} onClick={() => setTempoRange(t.range)}
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                    style={{ background: tempoRange === t.range ? accent + "22" : BASE, color: tempoRange === t.range ? accent : "#4a6580", border: `1px solid ${tempoRange === t.range ? accent + "55" : BORDER}` }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono w-6 text-right flex-shrink-0" style={{ color: "#ef4444" }}>−{tempoRange}</span>
              <input type="range" min={-100} max={100} step={0.5} value={tempoOffset}
                onChange={e => setTempoOffset(Number(e.target.value))}
                className="flex-1 cursor-pointer" style={{ accentColor: accent }} />
              <span className="text-[8px] font-mono w-6 flex-shrink-0" style={{ color: "#22c55e" }}>+{tempoRange}</span>
              <span className="text-[8px] font-mono font-bold w-10 text-right flex-shrink-0"
                style={{ color: pitchPct !== 0 ? (pitchPct > 0 ? "#22c55e" : "#ef4444") : "#4a6580" }}>
                {pitchPct === 0 ? "±0%" : `${pitchPct > 0 ? "+" : ""}${pitchPct.toFixed(1)}%`}
              </span>
              <button onClick={() => setTempoOffset(0)} className="text-[8px] px-1 rounded"
                style={{ color: "#4a6580" }}>✕</button>
            </div>
            <div className="flex gap-1 items-center pt-1 border-t" style={{ borderColor: BORDER }}>
              <button onPointerDown={handleTap}
                className="px-2 py-0.5 rounded-md text-[8px] font-bold flex-shrink-0 transition-colors active:scale-95 select-none"
                style={{ background: BASE, color: accent, border: `1px solid ${accent}44` }}>
                TAP{tapBpm ? ` ${tapBpm}` : ""}
              </button>
              {tapBpm && (
                <button onClick={() => { setBaseBpmOverride(tapBpm); setTapBpm(null); tapTimesRef.current = []; }}
                  className="px-1.5 py-0.5 rounded-md text-[8px] font-bold flex-shrink-0"
                  style={{ background: accent + "22", color: accent, border: `1px solid ${accent}44` }}>Lock</button>
              )}
              <input type="number" min={40} max={220} placeholder="BPM"
                value={targetBpm} onChange={e => setTargetBpm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") matchBpm(targetBpm); }}
                className="w-14 text-[8px] font-mono rounded-md px-1.5 py-0.5 text-center focus:outline-none flex-1 min-w-0"
                style={{ background: BASE, color: "#c9d1d9", border: `1px solid ${BORDER}` }} />
              <button onClick={() => matchBpm(targetBpm)} disabled={!targetBpm}
                className="px-2 py-0.5 rounded-md text-[8px] font-bold flex-shrink-0 disabled:opacity-30"
                style={{ background: accent, color: "#fff" }}>Match</button>
            </div>
          </div>

          {/* ── Ad Space ── reserved below Pitch/Tempo */}
          <div className="rounded-xl flex-1 flex flex-col items-center justify-center gap-1.5 min-h-[80px]"
            style={{ background: "#1a2130", border: "1px dashed #2e3a4e" }}>
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "#2e3a4e" }}>Ad Space</span>
            <span className="text-[7px]" style={{ color: "#253040" }}>320 × 80</span>
          </div>

        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="flex flex-col gap-2.5">

          {/* 3-Band EQ + Trim */}
          <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <SL>EQ + Trim</SL>
              <button onClick={() => { setEqHi(0); setEqMid(0); setEqLo(0); setTrim(0); }}
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: BASE, color: "#4a6580", border: `1px solid ${BORDER}` }}>Flat</button>
            </div>
            {[
              { label: "HIGH", val: eqHi,  set: setEqHi,  color: "#f472b6" },
              { label: "MID",  val: eqMid, set: setEqMid, color: "#fb923c" },
              { label: "LOW",  val: eqLo,  set: setEqLo,  color: "#38bdf8" },
              { label: "TRIM", val: trim,  set: setTrim,  color: "#a78bfa" },
            ].map(({ label, val, set, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-[8px] font-bold w-7 flex-shrink-0" style={{ color }}>{label}</span>
                <input type="range" min={-12} max={12} step={0.5} value={val}
                  onChange={e => set(Number(e.target.value))}
                  className="flex-1 cursor-pointer" style={{ accentColor: color }} />
                <span className="text-[8px] font-mono w-9 text-right flex-shrink-0" style={{ color }}>
                  {val > 0 ? "+" : ""}{val.toFixed(1)}
                </span>
                <button onClick={() => set(0)} className="text-[8px] w-4 flex-shrink-0" style={{ color: "#4a6580" }}>✕</button>
              </div>
            ))}
          </div>

          {/* Hot Cues */}
          <div className="rounded-xl p-2.5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <SL>Hot Cues</SL>
            <div className="grid grid-cols-4 gap-1 mb-1">
              {CUE_COLORS.map((color, i) => {
                const cue = hotCues[i];
                return (
                  <button key={i}
                    onClick={() => cue ? jumpHotCue(i) : setHotCue(i)}
                    className="h-7 rounded-lg text-[9px] font-bold transition-all active:scale-95"
                    style={{ background: cue ? color + "30" : BASE, color: cue ? color : "#4a6580", border: `1px solid ${cue ? color + "88" : BORDER}` }}
                    title={cue ? `${cue.label}: ${formatDuration(Math.floor(cue.time))}` : `Set C${i+1}`}
                    onContextMenu={e => { e.preventDefault(); const u = [...hotCues]; delete u[i]; setHotCues(u); }}>
                    {cue ? cue.label : `C${i+1}`}
                  </button>
                );
              })}
            </div>
            <p className="text-[7px]" style={{ color: BORDER2 }}>Tap to set · tap again to jump · right-click to clear</p>
          </div>

          {/* Loop */}
          <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between">
              <SL>Loop</SL>
              {loopActive && loopStart !== null && loopEnd !== null && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
                  style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>
                  ⟲ {formatDuration(Math.floor(loopStart))} → {formatDuration(Math.floor(loopEnd))}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {[1, 2, 4, 8, 16].map(beats => (
                <button key={beats} onClick={() => autoLoop(beats)}
                  className="flex-1 py-1 rounded-md text-[8px] font-bold transition-all active:scale-95"
                  style={{ background: BASE, color: "#7a9abf", border: `1px solid ${BORDER}` }}>
                  {beats}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {[
                { label: "IN",   onClick: setLoopIn,   active: loopStart !== null, activeStyle: { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" },  disabled: false },
                { label: "OUT",  onClick: setLoopOut,  active: loopEnd !== null,   activeStyle: { background: "#3b82f622", color: "#60a5fa", border: "1px solid #3b82f644" },  disabled: false },
                { label: loopActive ? "●LOOP" : "LOOP", onClick: () => setLoopActive(a => !a), active: loopActive, activeStyle: { background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }, disabled: loopStart === null || loopEnd === null },
                { label: "÷2",   onClick: loopHalve,   active: false, activeStyle: {}, disabled: loopStart === null || loopEnd === null },
                { label: "×2",   onClick: loopDouble,  active: false, activeStyle: {}, disabled: loopStart === null || loopEnd === null },
              ].map(({ label, onClick, active, activeStyle, disabled }) => (
                <button key={label} onClick={onClick} disabled={disabled}
                  className="flex-1 py-1 rounded-md text-[8px] font-bold transition-all disabled:opacity-30 active:scale-95"
                  style={active ? activeStyle : { background: BASE, color: "#7a9abf", border: `1px solid ${BORDER}` }}>
                  {label}
                </button>
              ))}
            </div>

            {/* CUE + Transport */}
            <div className="pt-1.5 border-t" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between mb-1">
                <SL>Cue</SL>
                {cuePoint > 0 && (
                  <span className="text-[8px] font-mono flex items-center gap-1" style={{ color: "#facc15" }}>
                    {formatDuration(Math.floor(cuePoint))}
                    <button onClick={() => setCuePoint(0)} style={{ color: "#4a6580" }}>✕</button>
                  </span>
                )}
              </div>
              <div className="flex gap-1 mb-1">
                {[
                  { label: "SET",   onClick: () => { const el = audioRef.current; if (el) setCuePoint(el.currentTime); }, style: { background: BASE, color: "#f59e0b", border: "1px solid #f59e0b44" } },
                  { label: "JUMP",  onClick: () => { const el = audioRef.current; if (!el || !hasAudio) return; el.currentTime = cuePoint; if (playing) { el.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); } }, style: { background: BASE, color: "#60a5fa", border: "1px solid #3b82f644" } },
                  { label: "CUE▶", onClick: () => {
                    const el = audioRef.current; if (!el || !hasAudio) return;
                    cancelAnimationFrame(rafRef.current);
                    el.currentTime = cuePoint;
                    el.play().then(() => {
                      setPlaying(true);
                      const tick = () => { setProgress((el.currentTime / (el.duration || 1)) * 100); setCurrentTime(el.currentTime); rafRef.current = requestAnimationFrame(tick); };
                      rafRef.current = requestAnimationFrame(tick);
                    }).catch(() => {});
                  }, style: { background: "#22c55e", color: "#fff", border: "1px solid #22c55e" } },
                ].map(({ label, onClick, style }) => (
                  <button key={label} onClick={onClick} disabled={!hasAudio}
                    className="flex-1 py-1 rounded-md text-[8px] font-bold transition-all active:scale-95 disabled:opacity-30"
                    style={style}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Play / Stop row */}
              <div className="flex gap-1">
                <button onClick={togglePlay} disabled={!hasAudio}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-bold transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: playing ? "#22c55e" : accent, color: "#fff", boxShadow: playing ? "0 0 8px #22c55e44" : `0 0 8px ${accent}44` }}>
                  {playing ? <><Pause className="w-3 h-3" />PAUSE</> : <><Play className="w-3 h-3" />PLAY</>}
                </button>
                <button onClick={stop} disabled={!hasAudio}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[9px] font-bold transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: SURFACE, color: "#ef4444", border: "1px solid #ef444433" }}>
                  <Square className="w-3 h-3" />STOP
                </button>
              </div>
              {/* CUE VOL — headphone monitor level */}
              <div className="flex items-center gap-1.5 pt-1.5 border-t mt-1.5" style={{ borderColor: BORDER }}>
                <span className="text-[8px] font-bold w-14 flex-shrink-0" style={{ color: "#f59e0b" }}>🎧 CUE VOL</span>
                <input type="range" min={0} max={100} step={1} value={cueVolume}
                  onChange={e => setCueVolume(Number(e.target.value))}
                  className="flex-1 cursor-pointer" style={{ accentColor: "#f59e0b" }} />
                <span className="text-[8px] font-mono w-7 text-right flex-shrink-0" style={{ color: "#f59e0b" }}>
                  {cueVolume}%
                </span>
                <button onClick={() => setCueVolume(40)} className="text-[8px] w-4 flex-shrink-0" style={{ color: "#4a6580" }}>✕</button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {scratchVal !== 0 && (
        <div className="mx-3 mb-3 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: "#f59e0b11", border: "1px solid #f59e0b33" }}>
          <span className="text-[9px] font-bold" style={{ color: "#f59e0b" }}>
            {scratchVal > 0 ? `▶▶ FORWARD SCRATCH  +${scratchVal}` : `◀◀ REVERSE SCRATCH  ${scratchVal}`}
          </span>
        </div>
      )}

      <audio ref={audioRef} onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); cancelAnimationFrame(rafRef.current); }} />
    </div>
  );
}
