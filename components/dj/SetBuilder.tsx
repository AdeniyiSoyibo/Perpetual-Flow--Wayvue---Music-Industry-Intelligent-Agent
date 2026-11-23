"use client";
import { useState, useMemo } from "react";
import { usePlatformStore } from "@/lib/store";
import { MOCK_TRACKS, computeTransitionScore } from "@/lib/data";
import {
  ListMusic, Plus, Trash2, ChevronUp, ChevronDown,
  ArrowRight, Download, Search, Zap, Music2,
} from "lucide-react";
import type { Track } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

function flowColor(score: number) {
  if (score >= 85) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 65) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-rose-600 bg-rose-50 border-rose-200";
}

function energyBar(energy: number, color: string) {
  return (
    <div className="w-16 h-1.5 rounded-full bg-[#e8eef5] overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${energy * 100}%` }} />
    </div>
  );
}

// ── Transition score badge between consecutive tracks ─────────────────────────
function TransitionBadge({ a, b }: { a: Track; b: Track }) {
  const { score } = useMemo(() => computeTransitionScore(a, b), [a, b]);
  return (
    <div className={`flex items-center gap-1 self-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${flowColor(score)}`}>
      <Zap className="w-2.5 h-2.5" />
      {score}
    </div>
  );
}

// ── BPM arc (mini SVG visualisation) ─────────────────────────────────────────
function BpmArc({ tracks }: { tracks: Track[] }) {
  if (tracks.length < 2) return null;
  const bpms = tracks.map(t => t.bpm);
  const min = Math.min(...bpms);
  const max = Math.max(...bpms);
  const range = max - min || 1;
  const W = 240;
  const H = 36;
  const pts = bpms.map((b, i) => {
    const x = (i / (bpms.length - 1)) * (W - 16) + 8;
    const y = H - 6 - ((b - min) / range) * (H - 14);
    return `${x},${y}`;
  });
  const d = "M " + pts.join(" L ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9" preserveAspectRatio="none">
      <defs>
        <linearGradient id="arcGrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#arcGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {bpms.map((b, i) => {
        const [x, y] = pts[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill="url(#arcGrad)" />;
      })}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SetBuilder() {
  const { deckA, deckB, addToQueue, setCurrentTrack } = usePlatformStore();
  const [setList, setSetList] = useState<Track[]>([]);
  const [sent, setSent] = useState(false);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("All");
  const [browserOpen, setBrowserOpen] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const genres = useMemo(() => {
    const gs = Array.from(new Set(MOCK_TRACKS.map(t => t.artist.split(".")[0]))).slice(0, 1); // unused; use BPM grouping
    const all = ["All", ...Array.from(new Set(MOCK_TRACKS.map(t =>
      t.bpm >= 130 ? "High BPM (130+)"
      : t.bpm >= 100 ? "Mid BPM (100–129)"
      : "Low BPM (<100)"
    )))];
    return all;
  }, []);

  const filtered = useMemo(() => {
    return MOCK_TRACKS.filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
      const matchGenre = genreFilter === "All"
        || (genreFilter === "High BPM (130+)" && t.bpm >= 130)
        || (genreFilter === "Mid BPM (100–129)" && t.bpm >= 100 && t.bpm < 130)
        || (genreFilter === "Low BPM (<100)" && t.bpm < 100);
      return matchSearch && matchGenre;
    });
  }, [search, genreFilter]);

  const inSet = useMemo(() => new Set(setList.map(t => t.id)), [setList]);

  const totalDuration = setList.reduce((acc, t) => acc + t.duration, 0);
  const avgEnergy = setList.length ? setList.reduce((acc, t) => acc + t.energy, 0) / setList.length : 0;
  const bpmRange = setList.length > 1
    ? `${Math.min(...setList.map(t => t.bpm))}–${Math.max(...setList.map(t => t.bpm))} BPM`
    : setList.length === 1 ? `${setList[0].bpm} BPM` : null;

  // Flow score = average pairwise transition score
  const flowScore = useMemo(() => {
    if (setList.length < 2) return null;
    let total = 0;
    for (let i = 0; i < setList.length - 1; i++) {
      total += computeTransitionScore(setList[i], setList[i + 1]).score;
    }
    return Math.round(total / (setList.length - 1));
  }, [setList]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const add = (t: Track) => {
    if (!inSet.has(t.id)) setSetList(p => [...p, t]);
  };
  const remove = (id: string) => setSetList(p => p.filter(t => t.id !== id));
  const moveUp = (i: number) => {
    if (i === 0) return;
    setSetList(p => { const n = [...p]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  };
  const moveDown = (i: number) => {
    if (i === setList.length - 1) return;
    setSetList(p => { const n = [...p]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; });
  };

  const sendToStreaming = () => {
    if (!setList.length) return;
    addToQueue(setList);
    setCurrentTrack(setList[0]);
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const exportSet = () => {
    const lines = [
      "# Perpetual Flow — DJ Set Export",
      `# ${setList.length} tracks · ${fmtDuration(totalDuration)} · Flow Score: ${flowScore ?? "—"}`,
      "",
      ...setList.map((t, i) =>
        `${String(i + 1).padStart(2, "0")}. ${t.title} — ${t.artist}  [${t.bpm} BPM · ${t.key} · ${fmtDuration(t.duration)}]`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "perpetual-flow-set.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-[#dce8f5] bg-white shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-[#e8eef5] flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ListMusic className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-[#1a2a3a]">Set Builder</h3>
            <p className="text-[10px] text-[#7a9abf]">Build, reorder &amp; score your DJ set · Send to Streaming</p>
          </div>
        </div>
        {/* Stats pills */}
        {setList.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {bpmRange && <span className="text-[10px] font-mono text-[#7a9abf] bg-[#f0f4f8] px-2 py-0.5 rounded-lg">{bpmRange}</span>}
            <span className="text-[10px] font-mono text-[#7a9abf] bg-[#f0f4f8] px-2 py-0.5 rounded-lg">{fmtDuration(totalDuration)}</span>
            {flowScore !== null && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${flowColor(flowScore)}`}>
                Flow {flowScore}
              </span>
            )}
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {deckA && <button onClick={() => add(deckA)} disabled={inSet.has(deckA.id)} className="text-[11px] px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-semibold hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">+A</button>}
          {deckB && <button onClick={() => add(deckB)} disabled={inSet.has(deckB.id)} className="text-[11px] px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">+B</button>}
          <button onClick={() => setBrowserOpen(v => !v)} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl font-semibold border transition-colors ${browserOpen ? "bg-sky-500 text-white border-sky-500" : "bg-white border-[#cdd8e8] text-[#4a6580] hover:border-sky-300"}`}>
            <Search className="w-3 h-3" /> Browse
          </button>
          <button onClick={() => setSetList([])} disabled={!setList.length} className="text-[11px] px-2.5 py-1.5 rounded-xl bg-white border border-[#cdd8e8] text-[#4a6580] hover:border-rose-300 hover:text-rose-500 disabled:opacity-30 transition-colors">Clear</button>
          <button onClick={sendToStreaming} disabled={!setList.length} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ArrowRight className="w-3 h-3" /> Stream
          </button>
          <button onClick={exportSet} disabled={!setList.length} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl bg-white border border-[#cdd8e8] text-[#4a6580] hover:border-sky-300 hover:text-sky-600 disabled:opacity-30 transition-colors">
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>

      {/* ── Track Browser ───────────────────────────────────────────────────── */}
      {browserOpen && (
        <div className="border-b border-[#e8eef5] bg-[#f7fafd] p-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7a9abf]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, artist, key…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#cdd8e8] bg-white focus:outline-none focus:border-sky-400" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {genres.map(g => (
                <button key={g} onClick={() => setGenreFilter(g)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${genreFilter === g ? "bg-sky-500 text-white border-sky-500" : "bg-white border-[#cdd8e8] text-[#4a6580] hover:border-sky-300"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
            {filtered.length === 0 && <p className="text-xs text-[#7a9abf] text-center py-4">No tracks match</p>}
            {filtered.map(t => (
              <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-[#e8eef5] hover:border-sky-200 transition-colors">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#1a2a3a] truncate">{t.title}</p>
                  <p className="text-[10px] text-[#7a9abf]">{t.artist} · {t.bpm} BPM · {t.key}</p>
                </div>
                {energyBar(t.energy, "bg-sky-400")}
                <button onClick={() => add(t)} disabled={inSet.has(t.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white disabled:bg-[#e8eef5] disabled:text-[#cdd8e8] disabled:cursor-not-allowed transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Set list ───────────────────────────────────────────────────────── */}
      <div className="p-3 space-y-2">
        {sent && (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold">
            ✓ Set added to Streaming queue — playing from track 1
          </div>
        )}

        {setList.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <ListMusic className="w-10 h-10 text-[#cdd8e8] mx-auto" />
            <p className="text-xs text-[#7a9abf]">No tracks yet — click <strong>Browse</strong> to add tracks, or use <strong>+A / +B</strong> to add the loaded decks</p>
          </div>
        ) : (
          <>
            {/* BPM arc */}
            <div className="px-1">
              <BpmArc tracks={setList} />
            </div>

            <div className="space-y-1">
              {setList.map((t, i) => (
                <div key={t.id}>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f0f4f8] border border-[#e8eef5] group hover:border-sky-200 transition-colors">
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveUp(i)} disabled={i === 0} className="text-[#cdd8e8] hover:text-sky-500 disabled:opacity-20 leading-none p-0.5 rounded">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => moveDown(i)} disabled={i === setList.length - 1} className="text-[#cdd8e8] hover:text-sky-500 disabled:opacity-20 leading-none p-0.5 rounded">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Number */}
                    <span className="text-[10px] text-[#7a9abf] font-mono w-4 text-center flex-shrink-0">{i + 1}</span>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1a2a3a] truncate">{t.title}</p>
                      <p className="text-[10px] text-[#7a9abf]">{t.artist} · {t.bpm} BPM · {t.key} · {fmtDuration(t.duration)}</p>
                    </div>
                    {/* Energy bar */}
                    {energyBar(t.energy, t.energy > 0.7 ? "bg-sky-500" : t.energy > 0.4 ? "bg-amber-400" : "bg-emerald-400")}
                    {/* Remove */}
                    <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-50 text-[#cdd8e8] hover:text-rose-500 transition-all flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Transition score connector */}
                  {i < setList.length - 1 && (
                    <div className="flex items-center gap-2 pl-10 py-0.5">
                      <div className="flex-1 h-px bg-[#e8eef5]" />
                      <TransitionBadge a={setList[i]} b={setList[i + 1]} />
                      <div className="flex-1 h-px bg-[#e8eef5]" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary row */}
            <div className="flex items-center gap-3 pt-1 px-1 flex-wrap">
              <span className="text-[10px] text-[#7a9abf]">{setList.length} tracks · {fmtDuration(totalDuration)}</span>
              <span className="text-[10px] text-[#7a9abf]">Avg energy {Math.round(avgEnergy * 100)}%</span>
              {flowScore !== null && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${flowColor(flowScore)}`}>
                  Set Flow Score {flowScore}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
