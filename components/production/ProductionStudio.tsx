"use client";

import { useState, useEffect, useRef } from "react";
import {
  Cpu, HardDrive, Mic2, Monitor, Layers, Zap, Shield,
  Settings, ChevronDown, ChevronUp, Activity, Headphones,
  Music, Waves, RefreshCw, Check, Lock, AlertCircle,
  Play, Square, Circle, SkipBack, Plus, Volume2, Minus,
  Grid, List, Share2, Download, Piano, Sliders, GitBranch,
  FolderOpen, Users, Upload, FileAudio, Repeat, Shuffle,
  ArrowRight, Mic, BarChart2, Wand2
} from "lucide-react";
import { useUser } from "@/lib/userContext";

// ── Web Audio ─────────────────────────────────────────────────────────────────
function getCtx(): AudioContext {
  const w = window as Window & { _prodCtx?: AudioContext };
  if (!w._prodCtx || w._prodCtx.state === "closed") w._prodCtx = new AudioContext();
  if (w._prodCtx.state === "suspended") w._prodCtx.resume();
  return w._prodCtx;
}

function playClick(beat: number) {
  const ctx = getCtx();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.value = beat === 0 ? 1000 : 440;
  g.gain.setValueAtTime(0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
  o.start(); o.stop(ctx.currentTime + 0.04);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Track {
  id: string; name: string; type: "audio"|"midi"|"bus";
  armed: boolean; muted: boolean; solo: boolean;
  volume: number; pan: number; color: string;
  peak: number; // simulated VU level
}
interface Plugin { id: string; name: string; category: string; enabled: boolean; tier: "free"|"pro"; }

const TRACK_COLORS = ["#38bdf8","#a78bfa","#34d399","#f472b6","#fb923c","#facc15","#f87171","#818cf8"];

const INIT_TRACKS: Track[] = [
  { id:"t1", name:"Kick / Drums", type:"audio", armed:false, muted:false, solo:false, volume:85, pan:0,   color:TRACK_COLORS[0], peak:0 },
  { id:"t2", name:"Bass",         type:"audio", armed:false, muted:false, solo:false, volume:78, pan:0,   color:TRACK_COLORS[1], peak:0 },
  { id:"t3", name:"Lead Synth",   type:"midi",  armed:false, muted:false, solo:false, volume:72, pan:-20, color:TRACK_COLORS[2], peak:0 },
  { id:"t4", name:"Vocals",       type:"audio", armed:false, muted:false, solo:false, volume:80, pan:0,   color:TRACK_COLORS[3], peak:0 },
  { id:"t5", name:"FX / Atmos",   type:"audio", armed:false, muted:false, solo:false, volume:55, pan:12,  color:TRACK_COLORS[7], peak:0 },
  { id:"t6", name:"Mix Bus",      type:"bus",   armed:false, muted:false, solo:false, volume:90, pan:0,   color:TRACK_COLORS[5], peak:0 },
];

const PLUGINS: Plugin[] = [
  { id:"p1",  name:"Parametric EQ",        category:"EQ",        enabled:true,  tier:"free" },
  { id:"p2",  name:"Dynamic Compressor",   category:"Dynamics",  enabled:true,  tier:"free" },
  { id:"p3",  name:"Brick-Wall Limiter",   category:"Dynamics",  enabled:true,  tier:"free" },
  { id:"p4",  name:"Reverb (Room/Plate)",  category:"Time",      enabled:false, tier:"free" },
  { id:"p5",  name:"Stereo Delay",         category:"Time",      enabled:false, tier:"free" },
  { id:"p6",  name:"Chorus / Flanger",     category:"Modulation",enabled:false, tier:"free" },
  { id:"p7",  name:"Auto-Align (Phase)",   category:"Utility",   enabled:false, tier:"pro"  },
  { id:"p8",  name:"Vocal Tuning (AI)",    category:"Repair",    enabled:false, tier:"pro"  },
  { id:"p9",  name:"VocAlign (Timing)",    category:"Repair",    enabled:false, tier:"pro"  },
  { id:"p10", name:"Noise Removal (RX)",   category:"Repair",    enabled:false, tier:"pro"  },
  { id:"p11", name:"Click Repair (RX)",    category:"Repair",    enabled:false, tier:"pro"  },
  { id:"p12", name:"Drum Replacement",     category:"Utility",   enabled:false, tier:"pro"  },
  { id:"p13", name:"AI Mix Assistant",     category:"AI",        enabled:false, tier:"pro"  },
  { id:"p14", name:"Room Correction",      category:"Reference", enabled:false, tier:"pro"  },
  { id:"p15", name:"Atmos Renderer (7.1.4)",category:"Immersive",enabled:false, tier:"pro"  },
  { id:"p16", name:"Multiband Compressor", category:"Dynamics",  enabled:false, tier:"pro"  },
];

const ROOM_PRESETS = [
  { id:"dry",       label:"Dry Studio",    rt60:"< 0.2s", desc:"Dead booth — zero coloration" },
  { id:"small",     label:"Small Room",    rt60:"0.3s",   desc:"Intimate treated live room" },
  { id:"midroom",   label:"Control Room",  rt60:"0.5s",   desc:"Symmetrical near-field setup" },
  { id:"live",      label:"Live Room",     rt60:"1.2s",   desc:"Bright with hardwood floor" },
  { id:"club",      label:"Club Venue",    rt60:"1.8s",   desc:"Concrete walls, crowd absorption" },
  { id:"hall",      label:"Concert Hall",  rt60:"2.2s",   desc:"Large hall, warm diffuse tail" },
  { id:"cathedral", label:"Cathedral",     rt60:"4.5s",   desc:"Dense stone reverb" },
  { id:"atmos",     label:"Immersive Room",  rt60:"0.4s",   desc:"Immersive 7.1.4 object-based" },
];

const MONITOR_PRESETS = [
  { id:"genelec",  label:"Precision Nearfield",      desc:"Accurate flat nearfield response" },
  { id:"ns10",     label:"Mid-Forward Reference",    desc:"Mid-forward — exposes mix problems" },
  { id:"mono",     label:"Single-Driver Mono Check", desc:"Mono mid-range translation check" },
  { id:"hphone",   label:"Headphones",               desc:"Crossfeed binaural compensation" },
  { id:"consumer", label:"Consumer Playback",        desc:"V-curve: boosted bass & treble" },
];

const AI_SUGGESTIONS = [
  { tag:"Low End",      msg:"Low-end buildup at 80–120Hz on Bass — high-pass at 40Hz recommended." },
  { tag:"Vocal",        msg:"Sibilance spike at 7.8kHz on Vocals — de-esser threshold –18dB." },
  { tag:"Mix Bus",      msg:"RMS averaging –9 LUFS — headroom available; try glue compression." },
  { tag:"Phase",        msg:"Stereo FX bus phase correlation near zero — check mono compatibility." },
  { tag:"Frequency",    msg:"Kick and bass fighting at 120Hz — surgical –3dB cut at 118Hz on Bass." },
  { tag:"Loudness",     msg:"True peak approaching –0.1dBTP — tighten limiter ceiling to –1dBTP." },
  { tag:"Atmos",        msg:"Height channels quiet — send reverb tail to overhead Atmos objects." },
];

const ACOUSTIC_ITEMS = [
  { icon:"🔲", label:"Bass Traps",            detail:"Floor-to-ceiling tri-corners — tames 40–250Hz modes" },
  { icon:"🟫", label:"Broadband Absorption",  detail:"4\" panels at first reflection points — 250Hz–8kHz" },
  { icon:"🔳", label:"QRD Diffusers",         detail:"Rear wall scattering — scatter highs, preserve energy" },
  { icon:"〰️", label:"Flutter Echo Control",  detail:"Angled side panels break parallel wall reflections" },
  { icon:"📈", label:"Modal Analysis (AI)",   detail:"Live room modes plotted at 20Hz intervals — auto-updated" },
  { icon:"🎙️", label:"Calibration Sweep",    detail:"Sweep mic → AI correction EQ → applied at monitor output" },
  { icon:"🤖", label:"AI Self-Calibration",   detail:"Continuous session-over-session correction curve learning" },
  { icon:"📐", label:"Symmetrical Layout",    detail:"Equilateral triangle · tweeters at ear height" },
];

// ── Step sequencer grid data ──────────────────────────────────────────────────
const STEP_INSTRUMENTS = ["Kick","Snare","Hi-Hat","Clap","Tom","Open HH","Cowbell","FX"];
const STEPS = 16;

// ── Sample browser categories ─────────────────────────────────────────────────
const SAMPLE_CATS = [
  { label:"Drums",    samples:["Kick 808","Kick Punchy","Snare Crack","Snare Rimshot","Hi-Hat Closed","Hi-Hat Open","Clap Tight","Perc Loop"] },
  { label:"Bass",     samples:["808 Sub C","808 Sub F","Reese Bass","Filtered Bass","Pluck Bass","DI Bass","Fretless","Upright"] },
  { label:"Synths",   samples:["Supersaw Lead","Pad Warm","Stab House","Pluck Bell","Arp Rise","Chord Pad","Mono Lead","FM Bell"] },
  { label:"Vocals",   samples:["Vox Chop 1","Breath FX","Ad-lib Hit","Falsetto Riff","Spoken Word","Choir Layer","Gospel One","Rap Stab"] },
  { label:"FX",       samples:["Riser 4-bar","Impact Boom","Vinyl Crackle","White Noise","Tape Stop","Rewind FX","Transition","Downlifter"] },
  { label:"Loops",    samples:["Afrobeat 128","Trap Loop 140","Lo-Fi 90","House 128","DnB 174","Reggae 90","Latin 100","Amapiano 112"] },
];

// ── Automation lanes ──────────────────────────────────────────────────────────
const AUTO_PARAMS = ["Volume","Pan","Send A (Reverb)","Send B (Delay)","Plugin: Compressor Threshold","Plugin: EQ 100Hz","Plugin: EQ 1kHz","Pitch Bend"];

// ── Export formats ────────────────────────────────────────────────────────────
const EXPORT_FORMATS = [
  { id:"wav48",   label:"WAV 48kHz / 24-bit",   desc:"Studio master — full quality" },
  { id:"wav44",   label:"WAV 44.1kHz / 16-bit",  desc:"CD-spec delivery" },
  { id:"wav32f",  label:"WAV 32-bit Float",       desc:"Maximum headroom for processing" },
  { id:"aiff",    label:"AIFF 48kHz / 24-bit",    desc:"Studio master — broad DAW compatibility" },
  { id:"flac",    label:"FLAC 48kHz / 24-bit",    desc:"Lossless compressed archive" },
  { id:"mp3_320", label:"MP3 320kbps",             desc:"Streaming / reference listen" },
  { id:"stems",   label:"Stem Export (per track)", desc:"Individual tracks — requires Pro" },
  { id:"atmos",   label:"Immersive Audio ADM BWF",  desc:"Immersive 7.1.4 object delivery — requires Pro" },
];

// ── Piano roll note data ──────────────────────────────────────────────────────
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const PIANO_OCTAVES = [5,4,3];
const DEMO_PATTERN = [
  { note:"C5", beat:0 }, { note:"E5", beat:1 }, { note:"G5", beat:2 },
  { note:"C5", beat:3 }, { note:"D5", beat:4 }, { note:"F5", beat:5 },
  { note:"A5", beat:6 }, { note:"G5", beat:7 }, { note:"E5", beat:8 },
  { note:"D5", beat:9 }, { note:"C5", beat:10 }, { note:"B4", beat:11 },
];
const TOTAL_PIANO_BEATS = 16;

// ── Small reusable UI ─────────────────────────────────────────────────────────
function Pill({ children, color = "bg-sky-100 text-sky-700" }: { children: React.ReactNode; color?: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color} whitespace-nowrap`}>{children}</span>;
}

function Accordion({ id, label, icon: Icon, badge, open, toggle, children }: {
  id: string; label: string; icon: React.ElementType; badge?: React.ReactNode;
  open: boolean; toggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#cdd8e8] overflow-hidden shadow-sm">
      <button onClick={toggle} className="w-full flex items-center justify-between px-5 py-3.5 bg-[#f0f4f8] hover:bg-sky-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <span className="text-sm font-bold text-[#1a2a3a]">{label}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#7a9abf]" /> : <ChevronDown className="w-4 h-4 text-[#7a9abf]" />}
      </button>
      {open && <div className="bg-white">{children}</div>}
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} role="switch" aria-checked={on}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? "bg-sky-500" : "bg-[#cdd8e8]"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function ProductionStudio() {
  const { hasAccess } = useUser();
  const isPro = hasAccess("producer_pro");

  // Transport
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beat, setBeat] = useState(0); // current beat in bar (0-3)
  const [bar, setBar]   = useState(1);
  const [atmos, setAtmos] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Metronome / transport tick
  useEffect(() => {
    if (playing) {
      const interval = (60 / bpm) * 1000;
      timerRef.current = setInterval(() => {
        setBeat(b => {
          const next = (b + 1) % 4;
          if (next === 0) setBar(br => br + 1);
          playClick(next);
          return next;
        });
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, bpm]);

  // Tracks
  const [tracks, setTracks] = useState<Track[]>(INIT_TRACKS);
  const vuRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate VU meters when playing
  useEffect(() => {
    if (playing) {
      vuRef.current = setInterval(() => {
        setTracks(ts => ts.map(t => {
          if (t.muted) return { ...t, peak: 0 };
          const hasSolo = ts.some(x => x.solo);
          if (hasSolo && !t.solo) return { ...t, peak: 0 };
          const base = t.volume / 100;
          return { ...t, peak: Math.max(0, Math.min(1, base * (0.6 + Math.random() * 0.4))) };
        }));
      }, 80);
    } else {
      if (vuRef.current) clearInterval(vuRef.current);
      setTracks(ts => ts.map(t => ({ ...t, peak: 0 })));
    }
    return () => { if (vuRef.current) clearInterval(vuRef.current); };
  }, [playing]);

  const stopTransport = () => { setPlaying(false); setRecording(false); setBeat(0); setBar(1); };

  const updateTrack = (id: string, patch: Partial<Track>) =>
    setTracks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));

  const addTrack = (type: "audio"|"midi"|"bus") => {
    const idx = tracks.length;
    setTracks(ts => [...ts, {
      id: `t${Date.now()}`, name: `${type === "midi" ? "MIDI" : type === "bus" ? "Bus" : "Audio"} ${idx + 1}`,
      type, armed:false, muted:false, solo:false, volume:75, pan:0,
      color: TRACK_COLORS[idx % TRACK_COLORS.length], peak:0,
    }]);
  };

  const removeTrack = (id: string) => setTracks(ts => ts.filter(t => t.id !== id));

  const hasSolo = tracks.some(t => t.solo);

  // Plugins
  const [plugins, setPlugins] = useState<Plugin[]>(PLUGINS);
  const [pluginCat, setPluginCat] = useState("All");
  const cats = ["All", ...Array.from(new Set(PLUGINS.map(p => p.category)))];
  const visPlugins = pluginCat === "All" ? plugins : plugins.filter(p => p.category === pluginCat);
  const togglePlugin = (id: string) =>
    setPlugins(ps => ps.map(p => p.id === id && !(p.tier === "pro" && !isPro) ? { ...p, enabled: !p.enabled } : p));

  // AI suggestions
  const [aiIdx, setAiIdx] = useState(0);
  const [aiApplied, setAiApplied] = useState<number[]>([]);
  const applyAi = () => { setAiApplied(a => [...a, aiIdx]); setAiIdx(i => (i + 1) % AI_SUGGESTIONS.length); };
  const skipAi  = () => setAiIdx(i => (i + 1) % AI_SUGGESTIONS.length);

  // Room & monitors
  const [room, setRoom]         = useState("midroom");
  const [monitor, setMonitor]   = useState("genelec");
  const [calibrating, setCalib] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const [calibPct, setCalibPct] = useState(0);

  const runCalib = () => {
    if (calibrating) return;
    setCalib(true); setCalibPct(0); setCalibrated(false);
    let pct = 0;
    const t = setInterval(() => {
      pct += 4 + Math.random() * 6;
      setCalibPct(Math.min(100, pct));
      if (pct >= 100) { clearInterval(t); setCalib(false); setCalibrated(true); }
    }, 80);
  };

  // ── New section state ──────────────────────────────────────────────────────
  // Step sequencer
  const initGrid = () => STEP_INSTRUMENTS.map(() => Array(STEPS).fill(false));
  const [grid, setGrid] = useState<boolean[][]>(initGrid);
  const [stepSwing, setStepSwing] = useState(50);
  const toggleStep = (row: number, col: number) =>
    setGrid(g => g.map((r, ri) => ri === row ? r.map((v, ci) => ci === col ? !v : v) : r));

  // Sample browser
  const [sampleCat, setSampleCat] = useState("Drums");
  const [sampleSearch, setSampleSearch] = useState("");
  const [loadedSamples, setLoadedSamples] = useState<string[]>([]);
  const sampleFileRef = useRef<HTMLInputElement>(null);
  const curSamples = (SAMPLE_CATS.find(c => c.label === sampleCat)?.samples ?? [])
    .filter(s => s.toLowerCase().includes(sampleSearch.toLowerCase()));

  // Arranger / Song timeline
  const [arrangerZoom, setArrangerZoom] = useState(1);
  const ARRANGER_CLIPS = [
    { track:0, start:0,  len:4,  label:"Intro",    color:"#38bdf8" },
    { track:0, start:4,  len:8,  label:"Verse 1",  color:"#38bdf8" },
    { track:0, start:12, len:4,  label:"Chorus 1", color:"#60a5fa" },
    { track:1, start:0,  len:2,  label:"Bass Fill",color:"#a78bfa" },
    { track:1, start:4,  len:8,  label:"Bass Main",color:"#a78bfa" },
    { track:2, start:4,  len:4,  label:"Synth A",  color:"#34d399" },
    { track:2, start:12, len:4,  label:"Synth B",  color:"#34d399" },
    { track:3, start:8,  len:8,  label:"Vocals",   color:"#f472b6" },
  ];
  const TRACK_BARS = 16;

  // Piano roll
  const [pianoPattern, setPianoPattern] = useState(
    DEMO_PATTERN.reduce<Record<string,boolean>>((acc, n) => { acc[`${n.note}-${n.beat}`] = true; return acc; }, {})
  );
  const [selectedOctave, setSelectedOctave] = useState(5);
  const toggleNote = (note: string, beat: number) => {
    const k = `${note}-${beat}`;
    setPianoPattern(p => ({ ...p, [k]: !p[k] }));
  };

  // Automation
  const [autoParam, setAutoParam] = useState(AUTO_PARAMS[0]);
  const [autoPoints] = useState([0.8,0.75,0.72,0.78,0.65,0.70,0.80,0.85,0.78,0.72,0.68,0.70,0.75,0.80,0.82,0.78]);

  // Per-track FX chain
  const [fxTrack, setFxTrack] = useState<string>("t1");
  const [fxChain, setFxChain] = useState<Record<string, { name:string; enabled:boolean }[]>>({
    t1: [{ name:"Gate",enabled:true},{ name:"Comp",enabled:true},{ name:"EQ",enabled:true},{ name:"Reverb",enabled:false}],
    t2: [{ name:"HP Filter",enabled:true},{ name:"Comp",enabled:true},{ name:"Saturator",enabled:false}],
    t3: [{ name:"Arp",enabled:true},{ name:"Chorus",enabled:false},{ name:"Delay",enabled:true},{ name:"Reverb",enabled:true}],
    t4: [{ name:"De-Esser",enabled:true},{ name:"Tuner",enabled:true},{ name:"Comp",enabled:true},{ name:"EQ",enabled:true},{ name:"Reverb",enabled:false}],
    t5: [{ name:"Reverb",enabled:true},{ name:"Delay",enabled:true},{ name:"Flanger",enabled:false}],
    t6: [{ name:"Bus Comp",enabled:true},{ name:"Limiter",enabled:true},{ name:"Clipper",enabled:false}],
  });

  // Export
  const [exportFmt, setExportFmt] = useState("wav48");
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [exported, setExported] = useState(false);
  const runExport = () => {
    if (exporting) return;
    setExporting(true); setExportPct(0); setExported(false);
    let pct = 0;
    const t = setInterval(() => {
      pct += 3 + Math.random() * 7;
      setExportPct(Math.min(100, pct));
      if (pct >= 100) { clearInterval(t); setExporting(false); setExported(true); }
    }, 80);
  };

  // Collaboration
  const [colabLink] = useState("https://flow.app/session/pf-" + Math.random().toString(36).slice(2,8));
  const [colabCopied, setColabCopied] = useState(false);
  const copyColab = () => { navigator.clipboard.writeText(colabLink).catch(()=>{}); setColabCopied(true); setTimeout(()=>setColabCopied(false),2000); };
  const COLLAB_USERS = [
    { initials:"KV", name:"Kira Vault",   role:"Producer",   color:"#38bdf8", online:true  },
    { initials:"AX", name:"Axiom",        role:"Mixer",      color:"#a78bfa", online:true  },
    { initials:"DN", name:"Demi Nox",     role:"Vocalist",   color:"#f472b6", online:false },
  ];

  // Sections open state
  const [open, setOpen] = useState<Record<string,boolean>>({
    transport:true, mixer:true, stepseq:false, piano:false, arranger:false,
    fx:false, automation:false, samples:false,
    plugins:false, ai:true, monitors:false, hw:false, acoustic:false,
    export:false, collab:false,
  });
  const tog = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));

  // LUFS meter (simulated, updates when playing)
  const [lufs, setLufs] = useState(-14);
  useEffect(() => {
    if (!playing) { setLufs(-14); return; }
    const t = setInterval(() => setLufs(l => Math.max(-24, Math.min(-6, l + (Math.random() - 0.5) * 0.4))), 300);
    return () => clearInterval(t);
  }, [playing]);

  return (
    <div className="space-y-3">

      {/* ── TRANSPORT ───────────────────────────────────────────────────────── */}
      <Accordion id="transport" label="DAW Engine & Transport" icon={Activity}
        badge={playing ? <Pill color="bg-red-100 text-red-600">● REC LIVE</Pill> : <Pill color="bg-green-100 text-green-700">Ready</Pill>}
        open={open.transport} toggle={() => tog("transport")}>
        <div className="p-5 space-y-4">
          {/* Transport controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={stopTransport}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f0f4f8] hover:bg-red-50 border border-[#cdd8e8] hover:border-red-300 transition-colors" title="Stop">
              <Square className="w-4 h-4 text-[#4a6580]" />
            </button>
            <button onClick={() => { stopTransport(); }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f0f4f8] hover:bg-sky-50 border border-[#cdd8e8] transition-colors" title="Rewind">
              <SkipBack className="w-4 h-4 text-[#4a6580]" />
            </button>
            <button onClick={() => setPlaying(p => !p)}
              className={`w-12 h-9 flex items-center justify-center rounded-xl font-bold text-white transition-colors shadow-sm ${playing ? "bg-amber-500 hover:bg-amber-600" : "bg-sky-500 hover:bg-sky-600"}`} title="Play / Pause">
              {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => { if (!playing) setPlaying(true); setRecording(r => !r); }}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${recording ? "bg-red-500 border-transparent text-white animate-pulse" : "bg-[#f0f4f8] border-[#cdd8e8] hover:bg-red-50 hover:border-red-300"}`} title="Record">
              <Circle className={`w-4 h-4 ${recording ? "text-white" : "text-red-400"}`} />
            </button>

            {/* Beat counter */}
            <div className="flex items-center gap-1 bg-[#1a2a3a] rounded-xl px-3 py-1.5">
              <span className="text-[10px] text-[#7a9abf] font-mono">BAR</span>
              <span className="text-sm font-mono font-bold text-white w-5 text-center">{bar}</span>
              <span className="text-[10px] text-[#7a9abf] font-mono ml-1">BEAT</span>
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full mx-0.5 transition-colors ${playing && beat === i ? "bg-sky-400" : "bg-[#3a4a5a]"}`} />
              ))}
            </div>

            {/* BPM */}
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setBpm(b => Math.max(40, b - 1))} className="w-7 h-7 rounded-lg bg-[#f0f4f8] border border-[#cdd8e8] flex items-center justify-center hover:bg-sky-50"><Minus className="w-3 h-3 text-[#4a6580]" /></button>
              <div className="flex flex-col items-center">
                <input type="number" min={40} max={300} value={bpm} onChange={e => setBpm(Number(e.target.value))}
                  className="w-14 text-center px-1 py-1 text-sm font-mono font-bold text-[#1a2a3a] bg-[#f0f4f8] border border-[#cdd8e8] rounded-lg focus:outline-none focus:border-sky-400" />
                <span className="text-[9px] text-[#7a9abf]">BPM</span>
              </div>
              <button onClick={() => setBpm(b => Math.min(300, b + 1))} className="w-7 h-7 rounded-lg bg-[#f0f4f8] border border-[#cdd8e8] flex items-center justify-center hover:bg-sky-50"><Plus className="w-3 h-3 text-[#4a6580]" /></button>
            </div>

            <div className="flex items-center gap-2">
              <Pill color="bg-[#f0f4f8] text-[#4a6580]">4/4</Pill>
              <Pill color="bg-[#f0f4f8] text-[#4a6580]">44.1kHz · 24-bit</Pill>
              <button onClick={() => setAtmos(a => !a)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-colors ${atmos ? "bg-purple-500 text-white border-transparent" : "border-[#cdd8e8] text-[#4a6580] hover:border-purple-400"}`}>
                Immersive Audio
              </button>
            </div>
          </div>

          {/* Master meter */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
            {[
              { l:"LUFS",       v:`${lufs.toFixed(1)}`,  ok: lufs > -16 && lufs < -8 },
              { l:"True Peak",  v:"-1.1 dBTP",           ok:true  },
              { l:"D.Range",    v:"DR11",                 ok:true  },
              { l:"Latency",    v:"2.3 ms",               ok:true  },
              { l:"CPU",        v:playing ? `${12 + Math.round(Math.random()*8)}%` : "6%", ok:true },
            ].map(({ l, v, ok }) => (
              <div key={l} className={`rounded-xl px-3 py-2 border ${ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="text-[#7a9abf] font-semibold">{l}</div>
                <div className={`font-mono font-bold text-sm ${ok ? "text-green-700" : "text-red-600"}`}>{v}</div>
              </div>
            ))}
          </div>
          {atmos && (
            <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-2 text-[11px] text-purple-700">
              <span className="font-bold">Immersive Audio 7.1.4 active — </span>
              {["Bed (7.1.0)", "Kick (floor)", "Vocal (centre)", "FX (L/R overhead)", "Reverb (all objects)"].map(o => (
                <span key={o} className="mr-2 font-mono">{o}</span>
              ))}
            </div>
          )}
        </div>
      </Accordion>

      {/* ── MULTI-TRACK MIXER ───────────────────────────────────────────────── */}
      <Accordion id="mixer" label="Multi-Track Mixer" icon={Layers}
        badge={<Pill>{tracks.length} tracks</Pill>}
        open={open.mixer} toggle={() => tog("mixer")}>
        <div className="p-4 space-y-2">
          {/* Track rows */}
          <div className="space-y-1.5">
            {tracks.map(t => {
              const active = !t.muted && (!hasSolo || t.solo);
              const vuW = active && playing ? t.peak : 0;
              const vuColor = vuW > 0.85 ? "#f87171" : vuW > 0.7 ? "#fbbf24" : "#34d399";
              return (
                <div key={t.id} className={`grid items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${t.armed ? "border-red-300 bg-red-50" : t.solo ? "border-green-300 bg-green-50" : t.muted ? "border-[#e8eef5] bg-[#f8fafc]" : "border-[#e8eef5] bg-[#f0f4f8]"}`}
                  style={{ gridTemplateColumns: "8px 1fr auto auto auto auto 90px 70px 32px 20px" }}>
                  {/* Color bar */}
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  {/* Name */}
                  <div>
                    <div className={`text-xs font-bold ${t.muted ? "text-[#aab8c8]" : "text-[#1a2a3a]"}`}>{t.name}</div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${t.type==="midi"?"bg-purple-100 text-purple-600":t.type==="bus"?"bg-yellow-100 text-yellow-600":"bg-sky-100 text-sky-600"}`}>
                      {t.type.toUpperCase()}
                    </span>
                  </div>
                  {/* ARM */}
                  <button onClick={() => updateTrack(t.id, { armed: !t.armed })}
                    className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${t.armed ? "bg-red-500 text-white" : "bg-white border border-[#cdd8e8] text-[#7a9abf] hover:border-red-300"}`}>R</button>
                  {/* MUTE */}
                  <button onClick={() => updateTrack(t.id, { muted: !t.muted })}
                    className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${t.muted ? "bg-yellow-400 text-white" : "bg-white border border-[#cdd8e8] text-[#7a9abf] hover:border-yellow-300"}`}>M</button>
                  {/* SOLO */}
                  <button onClick={() => updateTrack(t.id, { solo: !t.solo })}
                    className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${t.solo ? "bg-green-500 text-white" : "bg-white border border-[#cdd8e8] text-[#7a9abf] hover:border-green-300"}`}>S</button>
                  {/* Volume fader */}
                  <Volume2 className="w-3.5 h-3.5 text-[#7a9abf] flex-shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <input type="range" min={0} max={100} value={t.volume}
                      onChange={e => updateTrack(t.id, { volume: Number(e.target.value) })}
                      className="flex-1 h-1.5 accent-sky-500" style={{ accentColor: t.color }} />
                    <span className="text-[10px] font-mono text-[#7a9abf] w-7 text-right">{t.volume}</span>
                  </div>
                  {/* VU meter */}
                  <div className="h-2.5 rounded-full bg-[#e8eef5] overflow-hidden w-full">
                    <div className="h-full rounded-full transition-all duration-75" style={{ width:`${vuW*100}%`, background: vuColor }} />
                  </div>
                  {/* Delete */}
                  <button onClick={() => removeTrack(t.id)} className="text-[#cdd8e8] hover:text-red-400 transition-colors text-sm leading-none">×</button>
                </div>
              );
            })}
          </div>
          {/* Add track */}
          <div className="flex gap-2 pt-1">
            {(["audio","midi","bus"] as const).map(type => (
              <button key={type} onClick={() => addTrack(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors
                  ${type==="midi"?"text-purple-600 border-purple-200 hover:bg-purple-50":type==="bus"?"text-yellow-600 border-yellow-200 hover:bg-yellow-50":"text-sky-600 border-sky-200 hover:bg-sky-50"}`}>
                <Plus className="w-3.5 h-3.5" />
                {type.charAt(0).toUpperCase()+type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Accordion>

      {/* ── PLUGIN RACK ────────────────────────────────────────────────────── */}
      <Accordion id="plugins" label="Plugin Rack" icon={Music}
        badge={<Pill color="bg-purple-100 text-purple-700">{plugins.filter(p=>p.enabled).length} active</Pill>}
        open={open.plugins} toggle={() => tog("plugins")}>
        <div className="p-4 space-y-3">
          {/* Category tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {cats.map(c => (
              <button key={c} onClick={() => setPluginCat(c)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-colors ${pluginCat===c?"bg-sky-500 text-white border-transparent":"bg-[#f0f4f8] border-[#cdd8e8] text-[#4a6580] hover:border-sky-400"}`}>
                {c}
              </button>
            ))}
          </div>
          {/* Plugin grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {visPlugins.map(p => {
              const blocked = p.tier === "pro" && !isPro;
              return (
                <div key={p.id} onClick={() => !blocked && togglePlugin(p.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                    ${p.enabled ? "border-sky-300 bg-sky-50 shadow-sm" : "border-[#cdd8e8] bg-white hover:border-sky-200"}
                    ${blocked ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.enabled ? "bg-green-400" : "bg-[#cdd8e8]"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1a2a3a] truncate">{p.name}</div>
                      <div className="text-[9px] text-[#7a9abf]">{p.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    {p.tier === "pro" && <Pill color="bg-yellow-100 text-yellow-600">Pro</Pill>}
                    {blocked ? <Lock className="w-3.5 h-3.5 text-[#cdd8e8]" /> : (
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${p.enabled ? "bg-sky-500" : "bg-[#cdd8e8]"}`}>
                        <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all" style={{ left: p.enabled ? "calc(100% - 14px)" : "2px" }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!isPro && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              Pro plugins (AI, Repair, Immersive) require the Producer Pro plan.
            </div>
          )}
        </div>
      </Accordion>

      {/* ── AI MIX ASSISTANT ───────────────────────────────────────────────── */}
      <Accordion id="ai" label="AI Mix Assistant" icon={Zap}
        badge={<Pill color="bg-green-100 text-green-700">Always Learning</Pill>}
        open={open.ai} toggle={() => tog("ai")}>
        <div className="p-4 space-y-3">
          <div className="bg-[#f0f4f8] rounded-xl p-3 border border-[#cdd8e8]">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
              <div>
                <Pill color="bg-sky-100 text-sky-700">{AI_SUGGESTIONS[aiIdx].tag}</Pill>
                <p className="text-xs text-[#1a2a3a] mt-1">{AI_SUGGESTIONS[aiIdx].msg}</p>
              </div>
            </div>
            {aiApplied.includes(aiIdx) && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-green-600 font-semibold">
                <Check className="w-3.5 h-3.5" /> Fix applied to session
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={applyAi} disabled={aiApplied.includes(aiIdx)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold transition-colors">
              <Check className="w-3.5 h-3.5" /> Apply Fix
            </button>
            <button onClick={skipAi}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#cdd8e8] hover:bg-sky-50 text-[#4a6580] text-xs font-semibold transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Next
            </button>
          </div>
          {/* Analysis readouts */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { l:"LUFS",    v:`${lufs.toFixed(1)}`,     ok: lufs > -17 },
              { l:"True Pk", v:"-1.1 dBTP",              ok:true  },
              { l:"DR",      v:"DR11",                    ok:true  },
              { l:"Width",   v:"74%",                     ok:true  },
              { l:"Phase",   v:"0.82",                    ok:true  },
              { l:"Mono",    v:"Pass ✓",                  ok:true  },
            ].map(({ l, v, ok }) => (
              <div key={l} className={`rounded-xl px-2 py-2 text-center border ${ok?"bg-green-50 border-green-200":"bg-red-50 border-red-200"}`}>
                <div className="text-[9px] text-[#7a9abf] font-semibold">{l}</div>
                <div className={`text-sm font-mono font-bold ${ok?"text-green-700":"text-red-600"}`}>{v}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#7a9abf]">{aiApplied.length} fix{aiApplied.length !== 1 ? "es" : ""} applied this session · AI continuously analyzes mix against loudness standards, phase coherence, and genre references.</p>
        </div>
      </Accordion>

      {/* ── REFERENCE MONITORS ─────────────────────────────────────────────── */}
      <Accordion id="monitors" label="Reference Monitor Simulation" icon={Monitor}
        open={open.monitors} toggle={() => tog("monitors")}>
        <div className="p-4 space-y-2">
          <p className="text-xs text-[#7a9abf]">Simulate how your mix translates across playback systems. Frequency compensation is applied to the monitor output chain.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {MONITOR_PRESETS.map(m => (
              <button key={m.id} onClick={() => setMonitor(m.id)}
                className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${monitor===m.id ? "border-sky-400 bg-sky-50 shadow-sm" : "border-[#cdd8e8] hover:border-sky-300"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#1a2a3a] leading-tight">{m.label}</span>
                  {monitor===m.id && <Check className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />}
                </div>
                <div className="text-[10px] text-[#7a9abf] leading-tight">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </Accordion>

      {/* ── HARDWARE ───────────────────────────────────────────────────────── */}
      <Accordion id="hw" label="Hardware & Studio Setup" icon={Cpu} open={open.hw} toggle={() => tog("hw")}>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { Icon:Cpu,        label:"Workstation",              desc:"Apple M3 Max / Intel i9 · 128GB RAM · 8TB NVMe",   tier:"pro"  as const },
              { Icon:HardDrive,  label:"Audio Interface (TB4)",    desc:"32-in/32-out · 24-bit/192kHz · < 1ms round-trip", tier:"pro"  as const },
              { Icon:Mic2,       label:"Preamps (48V phantom)",    desc:"Class-A discrete · 4ch · EIN < –128 dB",          tier:"free" as const },
              { Icon:Monitor,    label:"Studio Monitors",          desc:"Calibrated stereo pair · room-corrected",          tier:"free" as const },
              { Icon:Headphones, label:"Reference Headphones",     desc:"Open-back + closed-back · crossfeed corrected",    tier:"free" as const },
              { Icon:Settings,   label:"Motorized Fader Surface",  desc:"16-ch DAW controller · standard control protocol", tier:"pro"  as const },
              { Icon:Settings,   label:"Monitor Controller",       desc:"Speaker switching · Dim/Mute · Mono sum",          tier:"free" as const },
              { Icon:Zap,        label:"Hardware Bus Compressor",  desc:"VCA glue on mix bus · discrete analog-style",      tier:"pro"  as const },
              { Icon:Shield,     label:"500-Series Rack",          desc:"Discrete analog-style EQ per channel",             tier:"pro"  as const },
              { Icon:Shield,     label:"Macro Shortcut Controller",desc:"Programmable shortcut deck · 32 workflow keys",    tier:"free" as const },
            ].map(({ Icon, label, desc, tier }) => {
              const blocked = tier === "pro" && !isPro;
              return (
                <div key={label} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${blocked?"border-[#e8eef5] opacity-60":"border-[#cdd8e8]"}`}>
                  <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-[#1a2a3a]">{label}</span>
                      {tier==="pro" && <Pill color="bg-yellow-100 text-yellow-600">Pro</Pill>}
                      {blocked && <Lock className="w-3 h-3 text-[#cdd8e8]" />}
                    </div>
                    <div className="text-[10px] text-[#7a9abf] mt-0.5">{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Accordion>

      {/* ── ACOUSTIC ENVIRONMENT ───────────────────────────────────────────── */}
      <Accordion id="acoustic" label="Acoustic Environment — World-Class Room" icon={Waves}
        badge={<Pill color="bg-green-100 text-green-700">AI Self-Calibrating</Pill>}
        open={open.acoustic} toggle={() => tog("acoustic")}>
        <div className="p-4 space-y-4">
          {/* Room presets */}
          <div>
            <p className="text-xs font-bold text-[#1a2a3a] mb-2">Room / Venue</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROOM_PRESETS.map(r => (
                <button key={r.id} onClick={() => setRoom(r.id)}
                  className={`text-left px-3 py-2 rounded-xl border transition-colors ${room===r.id?"border-sky-400 bg-sky-50 shadow-sm":"border-[#cdd8e8] hover:border-sky-300"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1a2a3a]">{r.label}</span>
                    {room===r.id && <Check className="w-3 h-3 text-sky-500" />}
                  </div>
                  <div className="text-[10px] font-mono text-sky-500 mt-0.5">RT60 {r.rt60}</div>
                  <div className="text-[10px] text-[#7a9abf] leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Treatment spec */}
          <div>
            <p className="text-xs font-bold text-[#1a2a3a] mb-2">Acoustic Treatment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ACOUSTIC_ITEMS.map(item => (
                <div key={item.label} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#f0f4f8] border border-[#e8eef5]">
                  <span className="text-base flex-shrink-0 leading-none mt-0.5">{item.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-[#1a2a3a]">{item.label}</div>
                    <div className="text-[10px] text-[#7a9abf] leading-tight">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calibration */}
          <div className="rounded-xl bg-[#f0f4f8] border border-[#cdd8e8] p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#1a2a3a]">Room Correction Calibration</p>
                <p className="text-[10px] text-[#7a9abf]">Sweep mic → AI correction EQ → applied to monitor output. Auto-updates each session.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {calibrated && <Pill color="bg-green-100 text-green-700">✓ Calibrated</Pill>}
                <button onClick={runCalib} disabled={calibrating}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-colors ${calibrating?"bg-[#7a9abf] cursor-wait":"bg-sky-500 hover:bg-sky-600"}`}>
                  {calibrating ? "Sweeping…" : calibrated ? "Re-calibrate" : "Run Calibration"}
                </button>
              </div>
            </div>
            {calibrating && (
              <div>
                <div className="h-2 rounded-full bg-[#e8eef5] overflow-hidden">
                  <div className="h-full bg-sky-400 rounded-full transition-all" style={{ width:`${calibPct}%` }} />
                </div>
                <p className="text-[10px] text-[#7a9abf] mt-1">Sweeping 20Hz – 20kHz… {Math.round(calibPct)}%</p>
              </div>
            )}
            {calibrated && !calibrating && (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[["40Hz","+3.2"],["80Hz","−1.8"],["250Hz","+0.4"],["1kHz","−0.2"],["4kHz","+1.1"],["8kHz","−0.9"],["12kHz","+0.3"],["16kHz","+0.6"]].map(([f,c]) => (
                  <div key={f} className="bg-white border border-[#e8eef5] rounded-lg p-1.5 text-center">
                    <div className="text-[9px] text-[#7a9abf]">{f}</div>
                    <div className={`text-[11px] font-mono font-bold ${c.startsWith("+")?"text-green-600":"text-red-500"}`}>{c}dB</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Accordion>

      {/* ── STEP SEQUENCER ─────────────────────────────────────────────────── */}
      <Accordion id="stepseq" label="Beat Grid — Step Sequencer" icon={Grid}
        badge={<Pill color="bg-emerald-100 text-emerald-700">16-step · 8 instruments</Pill>}
        open={open.stepseq} toggle={() => tog("stepseq")}>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {["4/4","3/4","6/8","5/4"].map(sig=>(
                <button key={sig} className="px-3 py-1 rounded-lg border border-[#cdd8e8] text-[10px] font-bold text-[#4a6580] hover:border-sky-400 hover:text-sky-600 transition-colors">{sig}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#7a9abf]">Swing {stepSwing}%</span>
              <input type="range" min={50} max={75} value={stepSwing} onChange={e=>setStepSwing(Number(e.target.value))} className="w-20 h-1.5" style={{accentColor:"#38bdf8"}} />
              <button onClick={()=>setGrid(initGrid())} className="px-2 py-1 rounded-lg border border-[#cdd8e8] text-[10px] font-bold text-rose-500 hover:bg-rose-50 transition-colors">Clear</button>
              <button onClick={()=>setGrid(STEP_INSTRUMENTS.map(()=>Array.from({length:STEPS},()=>Math.random()>0.75)))}
                className="px-2 py-1 rounded-lg border border-sky-200 text-[10px] font-bold text-sky-600 hover:bg-sky-50 transition-colors">Random</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="flex mb-1 ml-20">
                {Array.from({length:STEPS},(_,i)=>(
                  <div key={i} className={`flex-1 text-center text-[9px] font-mono ${i%4===0?"text-sky-500 font-bold":"text-[#cdd8e8]"}`}>
                    {i%4===0 ? Math.floor(i/4)+1 : "·"}
                  </div>
                ))}
              </div>
              {grid.map((row,ri)=>(
                <div key={ri} className="flex items-center gap-1 mb-1">
                  <div className="w-20 text-[10px] font-semibold text-[#4a6580] text-right pr-2 flex-shrink-0">{STEP_INSTRUMENTS[ri]}</div>
                  {row.map((on,ci)=>(
                    <button key={ci} onClick={()=>toggleStep(ri,ci)}
                      className={`flex-1 h-7 rounded-md transition-all border ${on?"border-transparent shadow-sm":"border-[#e8eef5] bg-white hover:bg-sky-50"} ${ci%4===0&&!on?"bg-[#f8fafc]":""}`}
                      style={on?{background:TRACK_COLORS[ri%TRACK_COLORS.length]}:undefined}/>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Accordion>

      {/* ── PIANO ROLL ─────────────────────────────────────────────────────── */}
      <Accordion id="piano" label="Piano Roll — MIDI Editor" icon={Piano}
        badge={<Pill color="bg-purple-100 text-purple-700">Click to toggle notes</Pill>}
        open={open.piano} toggle={() => tog("piano")}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#7a9abf]">Oct</span>
              {PIANO_OCTAVES.map(o=>(
                <button key={o} onClick={()=>setSelectedOctave(o)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-colors ${selectedOctave===o?"bg-purple-500 text-white border-transparent":"border-[#cdd8e8] text-[#4a6580] hover:border-purple-400"}`}>{o}</button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {["C Maj","A min","G Maj","Pentatonic","Blues"].map(scale=>(
                <button key={scale} className="px-2 py-1 rounded-lg border border-[#cdd8e8] text-[9px] font-bold text-[#7a9abf] hover:border-purple-400 hover:text-purple-600 transition-colors">{scale}</button>
              ))}
            </div>
            <button onClick={()=>setPianoPattern({})} className="ml-auto px-2 py-1 rounded-lg border border-[#cdd8e8] text-[10px] font-bold text-rose-500 hover:bg-rose-50 transition-colors">Clear</button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex mb-1 ml-24">
                {Array.from({length:TOTAL_PIANO_BEATS},(_,i)=>(
                  <div key={i} className={`flex-1 text-center text-[9px] font-mono ${i%4===0?"text-purple-500 font-bold":"text-[#cdd8e8]"}`}>{i%4===0?i/4+1:"·"}</div>
                ))}
              </div>
              {PIANO_OCTAVES.flatMap(oct=>
                [...NOTES].reverse().map(note=>{
                  const full=`${note}${oct}`;
                  const isBlack=note.includes("#");
                  return (
                    <div key={full} className="flex items-center mb-px">
                      <div className={`w-24 h-6 flex-shrink-0 flex items-center justify-end pr-2 rounded-l-md text-[9px] font-mono font-bold border-r border-[#e8eef5] ${isBlack?"bg-[#1a2a3a] text-white/50":"bg-[#f8fafc] text-[#7a9abf]"}`}>{full}</div>
                      {Array.from({length:TOTAL_PIANO_BEATS},(_,beat)=>{
                        const on=pianoPattern[`${full}-${beat}`];
                        return (
                          <button key={beat} onClick={()=>toggleNote(full,beat)}
                            className={`flex-1 h-6 border-r border-[#f0f4f8] transition-all ${on?"shadow-sm":isBlack?"bg-[#f0f4f8] hover:bg-purple-50":"bg-white hover:bg-purple-50"}`}
                            style={on?{background:"#a78bfa"}:undefined}/>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <p className="text-[10px] text-[#7a9abf]">Velocity · Chord builder · Scale snap — v0.6</p>
        </div>
      </Accordion>

      {/* ── ARRANGER ────────────────────────────────────────────────────────── */}
      <Accordion id="arranger" label="Arranger — Song Timeline" icon={List}
        badge={<Pill color="bg-sky-100 text-sky-700">16 bars</Pill>}
        open={open.arranger} toggle={() => tog("arranger")}>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#7a9abf]">Zoom</span>
              {[0.5,1,2,4].map(z=>(
                <button key={z} onClick={()=>setArrangerZoom(z)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-colors ${arrangerZoom===z?"bg-sky-500 text-white border-transparent":"border-[#cdd8e8] text-[#4a6580] hover:border-sky-400"}`}>{z}×</button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {["Intro","Verse","Pre-Ch","Chorus","Bridge","Outro"].map(s=>(
                <span key={s} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4f8] text-[#7a9abf] border border-[#e8eef5]">{s}</span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div style={{minWidth:`${TRACK_BARS*40*arrangerZoom}px`}}>
              <div className="flex mb-1 ml-20">
                {Array.from({length:TRACK_BARS},(_,i)=>(
                  <div key={i} style={{flex:`0 0 ${40*arrangerZoom}px`}}
                    className={`text-center text-[9px] font-mono border-l border-[#e8eef5] ${i%4===0?"text-sky-500 font-bold":"text-[#cdd8e8]"}`}>
                    {i+1}
                  </div>
                ))}
              </div>
              {["Drums","Bass","Synth","Vocals"].map((tname,ti)=>(
                <div key={tname} className="flex items-center mb-1">
                  <div className="w-20 text-[10px] font-semibold text-[#4a6580] text-right pr-2 flex-shrink-0">{tname}</div>
                  <div className="relative flex-1 h-8 bg-[#f8fafc] border border-[#e8eef5] rounded-r-xl overflow-hidden">
                    {Array.from({length:TRACK_BARS},(_,i)=>(
                      <div key={i} className="absolute top-0 bottom-0 border-l border-[#e8eef5]" style={{left:`${(i/TRACK_BARS)*100}%`}}/>
                    ))}
                    {ARRANGER_CLIPS.filter(c=>c.track===ti).map((c,ci)=>(
                      <div key={ci} className="absolute top-1 bottom-1 rounded-lg flex items-center px-1.5 overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                        style={{left:`${(c.start/TRACK_BARS)*100}%`,width:`${(c.len/TRACK_BARS)*100}%`,background:c.color+"33",border:`1px solid ${c.color}66`}}>
                        <span className="text-[9px] font-bold truncate" style={{color:c.color}}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-[#7a9abf]">Drag clips · Loop markers · Full arrangement edit — v0.6</p>
        </div>
      </Accordion>

      {/* ── PER-TRACK FX CHAIN ──────────────────────────────────────────────── */}
      <Accordion id="fx" label="Per-Track Effects Chain" icon={Sliders}
        badge={<Pill color="bg-indigo-100 text-indigo-700">Insert · Send · Bus routing</Pill>}
        open={open.fx} toggle={() => tog("fx")}>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tracks.map(t=>(
              <button key={t.id} onClick={()=>setFxTrack(t.id)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-colors ${fxTrack===t.id?"text-white border-transparent":"border-[#cdd8e8] text-[#4a6580] hover:border-sky-400"}`}
                style={fxTrack===t.id?{background:t.color}:undefined}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(fxChain[fxTrack]??[]).map((fx,i)=>(
              <div key={i} onClick={()=>setFxChain(c=>({...c,[fxTrack]:c[fxTrack].map((f,fi)=>fi===i?{...f,enabled:!f.enabled}:f)}))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${fx.enabled?"border-sky-300 bg-sky-50 text-sky-700":"border-[#e8eef5] bg-[#f8fafc] text-[#7a9abf]"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${fx.enabled?"bg-sky-400":"bg-[#cdd8e8]"}`}/>{fx.name}
              </div>
            ))}
            <div className="text-[#cdd8e8] text-sm font-bold">→</div>
            <div className="px-3 py-2 rounded-xl border border-dashed border-[#cdd8e8] text-[10px] font-bold text-[#cdd8e8]">Master</div>
            <button onClick={()=>setFxChain(c=>({...c,[fxTrack]:[...(c[fxTrack]??[]),{name:"New FX",enabled:true}]}))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-sky-200 text-sky-600 text-[10px] font-bold hover:bg-sky-50 transition-colors">
              <Plus className="w-3 h-3"/>Add
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["Send A → Reverb Bus","Send B → Delay Bus","Send C → Sub Bus","Send D → Vocal Bus"].map(send=>(
              <div key={send} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#e8eef5]">
                <span className="text-[10px] font-semibold text-[#4a6580]">{send}</span>
                <input type="range" min={0} max={100} defaultValue={send.includes("Rev")?40:send.includes("Del")?25:0} className="w-20 h-1" style={{accentColor:"#38bdf8"}}/>
              </div>
            ))}
          </div>
        </div>
      </Accordion>

      {/* ── AUTOMATION LANES ────────────────────────────────────────────────── */}
      <Accordion id="automation" label="Automation Lanes" icon={GitBranch}
        badge={<Pill color="bg-amber-100 text-amber-700">{AUTO_PARAMS.length} params</Pill>}
        open={open.automation} toggle={() => tog("automation")}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[#7a9abf] font-semibold">Parameter:</span>
            <select value={autoParam} onChange={e=>setAutoParam(e.target.value)}
              className="text-xs border border-[#cdd8e8] rounded-lg px-2 py-1.5 bg-white text-[#1a2a3a] focus:outline-none focus:border-sky-400">
              {AUTO_PARAMS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            {["Write","Read","Latch","Touch"].map(m=>(
              <button key={m} className="px-3 py-1 rounded-lg border border-[#cdd8e8] text-[10px] font-bold text-[#4a6580] hover:bg-sky-50 hover:border-sky-400 transition-colors">{m}</button>
            ))}
          </div>
          <div className="relative h-20 bg-[#f8fafc] border border-[#e8eef5] rounded-xl overflow-hidden">
            <svg viewBox={`0 0 ${autoPoints.length} 1`} preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="autoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              <polyline points={autoPoints.map((v,i)=>`${i},${1-v}`).join(" ")} fill="none" stroke="#38bdf8" strokeWidth="0.04"/>
              <polygon points={`0,1 ${autoPoints.map((v,i)=>`${i},${1-v}`).join(" ")} ${autoPoints.length-1},1`} fill="url(#autoGrad)"/>
              {autoPoints.map((v,i)=>(
                <circle key={i} cx={i} cy={1-v} r="0.06" fill="#38bdf8"/>
              ))}
            </svg>
            {[0,4,8,12,16].map(b=>(
              <div key={b} className="absolute top-0 bottom-0 border-l border-[#e8eef5]" style={{left:`${(b/16)*100}%`}}>
                <span className="text-[8px] text-[#cdd8e8] ml-0.5">{b/4+1}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#7a9abf]">Draw curves · LFO shapes · Pencil/Line/Lasso tools — v0.6</p>
        </div>
      </Accordion>

      {/* ── SAMPLE BROWSER ──────────────────────────────────────────────────── */}
      <Accordion id="samples" label="Sample & Loop Browser" icon={FolderOpen}
        badge={<Pill color="bg-orange-100 text-orange-700">{SAMPLE_CATS.reduce((s,c)=>s+c.samples.length,0)} samples</Pill>}
        open={open.samples} toggle={() => tog("samples")}>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {SAMPLE_CATS.map(c=>(
              <button key={c.label} onClick={()=>setSampleCat(c.label)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-colors ${sampleCat===c.label?"bg-orange-500 text-white border-transparent":"border-[#cdd8e8] text-[#4a6580] hover:border-orange-400"}`}>
                {c.label}
              </button>
            ))}
            <button onClick={()=>sampleFileRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1 rounded-lg border border-dashed border-[#cdd8e8] text-[10px] font-bold text-[#7a9abf] hover:border-sky-400 hover:text-sky-600 transition-colors ml-auto">
              <Upload className="w-3 h-3"/>Upload
            </button>
            <input ref={sampleFileRef} type="file" accept="audio/*" multiple className="hidden"
              onChange={e=>{if(e.target.files)setLoadedSamples(p=>[...p,...Array.from(e.target.files!).map(f=>f.name)]);}}/>
          </div>
          <input value={sampleSearch} onChange={e=>setSampleSearch(e.target.value)}
            placeholder="Search samples…" className="w-full text-xs px-3 py-2 rounded-xl border border-[#cdd8e8] bg-[#f8fafc] focus:outline-none focus:border-sky-400 text-[#1a2a3a] placeholder:text-[#cdd8e8]"/>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
            {curSamples.map(s=>(
              <div key={s} className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#e8eef5] bg-white hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer group">
                <FileAudio className="w-3 h-3 text-[#cdd8e8] group-hover:text-orange-400 flex-shrink-0"/>
                <span className="text-[10px] font-semibold text-[#1a2a3a] truncate">{s}</span>
              </div>
            ))}
            {loadedSamples.map(s=>(
              <div key={s} className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-sky-200 bg-sky-50 cursor-pointer">
                <FileAudio className="w-3 h-3 text-sky-400 flex-shrink-0"/>
                <span className="text-[10px] font-semibold text-sky-700 truncate">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </Accordion>

      {/* ── EXPORT ──────────────────────────────────────────────────────────── */}
      <Accordion id="export" label="Export & Delivery" icon={Download}
        badge={<Pill color="bg-green-100 text-green-700">WAV · FLAC · MP3 · Stems · Atmos</Pill>}
        open={open.export} toggle={() => tog("export")}>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {EXPORT_FORMATS.map(f=>{
              const blocked=(f.id==="stems"||f.id==="atmos")&&!isPro;
              return (
                <div key={f.id} onClick={()=>!blocked&&setExportFmt(f.id)}
                  className={`flex flex-col px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${exportFmt===f.id?"border-sky-400 bg-sky-50 shadow-sm":"border-[#cdd8e8] bg-white hover:border-sky-200"} ${blocked?"opacity-50 cursor-not-allowed":""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#1a2a3a]">{f.label}</span>
                    {exportFmt===f.id&&<Check className="w-3 h-3 text-sky-500"/>}
                    {blocked&&<Lock className="w-3 h-3 text-[#cdd8e8]"/>}
                  </div>
                  <span className="text-[9px] text-[#7a9abf]">{f.desc}</span>
                  {(f.id==="stems"||f.id==="atmos")&&<Pill color="bg-yellow-100 text-yellow-600">Pro</Pill>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-[#4a6580]">
              <span>Normalize to:</span>
              {["-14 LUFS (Streaming)","-16 LUFS (Podcast)","-23 LUFS (Broadcast)","Off"].map(n=>(
                <button key={n} className="px-2 py-1 rounded-lg border border-[#cdd8e8] text-[9px] font-bold hover:border-sky-400 hover:text-sky-600 transition-colors">{n}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={runExport} disabled={exporting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-sm transition-colors ${exporting?"bg-[#7a9abf] cursor-wait":"bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90"}`}>
              <Download className="w-4 h-4"/>
              {exporting ? "Exporting…" : exported ? "Export Again" : "Export Mix"}
            </button>
            {isPro&&<button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors"><FileAudio className="w-4 h-4"/>Export Stems</button>}
          </div>
          {exporting&&(
            <div>
              <div className="h-2 rounded-full bg-[#e8eef5] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all" style={{width:`${exportPct}%`}}/>
              </div>
              <p className="text-[10px] text-[#7a9abf] mt-1">Rendering… {Math.round(exportPct)}%</p>
            </div>
          )}
          {exported&&!exporting&&(
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
              <Check className="w-4 h-4"/>Mix exported successfully · Ready for delivery
            </div>
          )}
        </div>
      </Accordion>

      {/* ── COLLABORATION ───────────────────────────────────────────────────── */}
      <Accordion id="collab" label="Collaboration — Real-Time Session" icon={Users}
        badge={<Pill color="bg-rose-100 text-rose-700">2 online now</Pill>}
        open={open.collab} toggle={() => tog("collab")}>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f0f4f8] border border-[#cdd8e8]">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#7a9abf] font-semibold">Session Link</p>
              <p className="text-xs font-mono text-[#1a2a3a] truncate">{colabLink}</p>
            </div>
            <button onClick={copyColab}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-colors flex-shrink-0 ${colabCopied?"bg-green-500 text-white border-transparent":"border-sky-300 text-sky-600 hover:bg-sky-50"}`}>
              {colabCopied?"Copied!":"Copy Link"}
            </button>
          </div>
          <div className="space-y-2">
            {COLLAB_USERS.map(u=>(
              <div key={u.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#e8eef5] bg-white">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{background:u.color}}>{u.initials}</div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${u.online?"bg-green-400":"bg-[#cdd8e8]"}`}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1a2a3a]">{u.name}</p>
                  <p className="text-[10px] text-[#7a9abf]">{u.role} · {u.online?"Editing now":"Last seen 2h ago"}</p>
                </div>
                <div className="flex gap-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${u.online?"bg-green-100 text-green-600":"bg-[#f0f4f8] text-[#7a9abf]"}`}>
                    {u.online?"Online":"Offline"}
                  </span>
                </div>
              </div>
            ))}
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#cdd8e8] text-[10px] font-bold text-[#7a9abf] hover:border-sky-400 hover:text-sky-600 transition-colors">
              <Plus className="w-3 h-3"/>Invite collaborator
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[{l:"Version",v:"v14 (auto-saved)"},{l:"Changes",v:"38 edits"},{l:"Comments",v:"5 threads"}].map(({l,v})=>(
              <div key={l} className="rounded-xl bg-[#f8fafc] border border-[#e8eef5] px-2 py-2">
                <div className="text-[9px] text-[#7a9abf] font-semibold">{l}</div>
                <div className="text-[10px] font-bold text-[#1a2a3a] mt-0.5">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Accordion>

    </div>
  );
}
