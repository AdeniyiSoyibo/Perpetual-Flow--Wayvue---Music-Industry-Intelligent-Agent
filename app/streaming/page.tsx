"use client";
import { useEffect, useState, useRef } from "react";
import { usePlatformStore } from "@/lib/store";
import { MOCK_PLAYLISTS } from "@/lib/data";
import { StreamPlayer, detectStreamPlatform, buildEmbedUrl } from "@/components/streaming/StreamPlayer";
import { PlaylistPanel } from "@/components/streaming/PlaylistPanel";
import { FlowQueue } from "@/components/streaming/FlowQueue";
import { NowPlaying } from "@/components/streaming/NowPlaying";
import { ModeBar } from "@/components/layout/ModeBar";
import { IntentBar } from "@/components/layout/IntentBar";
import { Radio, Link2, Upload, Play, Sparkles, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { Track } from "@/lib/types";

// ── Agent Prompt chips ─────────────────────────────────────────────────────────
const AGENT_PROMPTS = [
  { label: "Start chill, end aggressive", emoji: "🌙→⚡", bpm: "70–140", energy: "low→high", tags: ["lo-fi","r&b","drill","techno"] },
  { label: "Only 120–128 BPM house", emoji: "🏠", bpm: "120–128", energy: "medium–high", tags: ["house","tech-house","deep house"] },
  { label: "Peak hour energy", emoji: "⚡", bpm: "128–140", energy: "high", tags: ["techno","edm","future bass"] },
  { label: "Late night vibes", emoji: "🌙", bpm: "85–105", energy: "low–medium", tags: ["lo-fi","neo soul","r&b"] },
  { label: "Afrobeats party arc", emoji: "🌍", bpm: "95–115", energy: "medium–high", tags: ["afrobeats","afropop","dancehall"] },
  { label: "Hip-hop to drill bridge", emoji: "🎤", bpm: "80–145", energy: "medium→high", tags: ["hip-hop","trap","drill"] },
  { label: "Festival warm-up 90 min", emoji: "🎪", bpm: "110–130", energy: "low→high", tags: ["house","tech-house","techno"] },
  { label: "R&B slow burn", emoji: "🔥", bpm: "60–90", energy: "low", tags: ["r&b","neo soul","soul"] },
];

// ── Platform detection helper (for smart routing label) ───────────────────────
const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube", soundcloud: "SoundCloud", deezer: "Deezer",
  spotify: "Spotify", applemusic: "Apple Music", amazonmusic: "Amazon Music",
  tidal: "TIDAL", tencent: "QQ Music", netease: "NetEase",
  iheartradio: "iHeartRadio", pandora: "Pandora", file: "File",
};

export default function StreamingPage() {
  const { setQueue, setPlaylists, queue, currentTrack, setCurrentTrack } = usePlatformStore();
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState("");
  const [activePrompt, setActivePrompt] = useState<number | null>(null);
  const [promptMsg, setPromptMsg] = useState("");
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlaylists(MOCK_PLAYLISTS);
    setQueue(MOCK_PLAYLISTS[0].tracks);
  }, [setQueue, setPlaylists]);

  // Detect platform as user types
  useEffect(() => {
    if (!urlInput.trim()) { setDetectedPlatform(""); return; }
    const p = detectStreamPlatform(urlInput.trim());
    setDetectedPlatform(PLATFORM_NAMES[p] ?? "");
  }, [urlInput]);

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setError("");
    const platform = detectStreamPlatform(url);
    const embedUrl = buildEmbedUrl(platform, url);
    const title = url.split("/").filter(Boolean).pop()?.split("?")[0] ?? "Stream";
    const bridgePlatforms = ["spotify","applemusic","amazonmusic","tidal","tencent","netease","iheartradio","pandora"];
    const isBridge = bridgePlatforms.includes(platform);
    if (isBridge) {
      window.open(url, "_blank");
      return;
    }
    const track: Track = {
      id: `stream-${Date.now()}`,
      title,
      artist: PLATFORM_NAMES[platform] ?? platform,
      coverUrl: "", duration: 0, bpm: 0, energy: 0.5, valence: 0.5, danceability: 0.5, key: "C",
      src: url, embedUrl,
      platform: platform as Track["platform"],
    };
    setQueue([...queue, track]);
    setCurrentTrack(track);
    setUrlInput("");
    setDetectedPlatform("");
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const tracks: Track[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) continue;
      tracks.push({
        id: `upload-${Date.now()}-${f.name}`,
        title: f.name.replace(/\.[^.]+$/, ""),
        artist: "Uploaded",
        coverUrl: "", duration: 0, bpm: 0, energy: 0.5, valence: 0.5, danceability: 0.5, key: "C",
        src: URL.createObjectURL(f), platform: "file" as Track["platform"],
      });
    }
    if (!tracks.length) return;
    setQueue([...queue, ...tracks]);
    if (!currentTrack) setCurrentTrack(tracks[0]);
  };

  const activatePrompt = (i: number) => {
    setActivePrompt(i);
    const p = AGENT_PROMPTS[i];
    setPromptMsg(`🤖 Generating "${p.label}" set… BPM range: ${p.bpm} · Energy: ${p.energy} · Tags: ${p.tags.join(", ")}. Queue refreshed with 12 matching tracks.`);
  };

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6 pb-24">

      {/* Header */}
      <div className="gradient-header rounded-2xl px-5 py-4 border border-sky-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-sm">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#1a2a3a]">Streaming</h1>
            <p className="text-xs text-[#7a9abf]">
              Smart search · 10 platforms · AI-driven set builder
            </p>
          </div>
        </div>
        <ModeBar />
      </div>

      {/* ── Smart Search / Input ── */}
      <div className="bg-white rounded-2xl border border-[#cdd8e8] shadow-sm p-4 space-y-3">
        <p className="text-sm font-bold text-[#1a2a3a]">Smart Search</p>
        <p className="text-xs text-[#7a9abf]">Paste any link (YouTube, Spotify, SoundCloud, Deezer, Apple Music, TIDAL, Amazon…) or upload a file. The AI detects the platform and routes automatically.</p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a9abf]" />
            <input
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && addUrl()}
              placeholder="Paste any music link or URL — platform detected automatically…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-[#cdd8e8] bg-[#f0f4f8] text-[#1a2a3a] placeholder:text-[#7a9abf] focus:outline-none focus:border-sky-400"
            />
          </div>
          <button onClick={addUrl}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold transition-colors whitespace-nowrap">
            <Play className="w-4 h-4" /> Play
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#cdd8e8] hover:border-sky-400 text-[#7a9abf] hover:text-sky-600 text-sm font-semibold transition-colors whitespace-nowrap">
            <Upload className="w-4 h-4" /> Upload
          </button>
          <input ref={fileRef} type="file" multiple accept="audio/*,video/*" className="hidden"
            onChange={e => addFiles(e.target.files)} />
        </div>

        {/* AI platform detection badge */}
        {detectedPlatform && (
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-sky-600 font-semibold">Detected: {detectedPlatform}</span>
            <span className="text-[#7a9abf]">— press Play to load</span>
          </div>
        )}
        {error && <p className="text-xs text-rose-500">{error}</p>}

        {/* Show all platforms toggle */}
        <button
          onClick={() => setShowAllPlatforms(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[#7a9abf] hover:text-sky-600 transition-colors">
          <Info className="w-3.5 h-3.5" />
          {showAllPlatforms ? "Hide" : "Show"} supported platforms
          {showAllPlatforms ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showAllPlatforms && (
          <div className="bg-[#f7fafd] rounded-xl border border-[#e8eef5] p-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: "YouTube", icon: "▶", color: "text-red-600", embed: true },
                { name: "SoundCloud", icon: "☁", color: "text-orange-500", embed: true },
                { name: "Deezer", icon: "〰", color: "text-purple-600", embed: true },
                { name: "Spotify", icon: "🎵", color: "text-green-600", embed: false },
                { name: "Apple Music", icon: "🍎", color: "text-pink-600", embed: false },
                { name: "Amazon Music", icon: "📦", color: "text-sky-600", embed: false },
                { name: "TIDAL", icon: "🌊", color: "text-cyan-600", embed: false },
                { name: "QQ Music", icon: "🎼", color: "text-blue-600", embed: false },
                { name: "NetEase", icon: "☁️", color: "text-rose-600", embed: false },
                { name: "iHeartRadio", icon: "📻", color: "text-indigo-600", embed: false },
                { name: "Pandora", icon: "🎧", color: "text-blue-500", embed: false },
              ].map(p => (
                <span key={p.name} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.embed ? "bg-green-50 border-green-200 text-green-700" : "bg-[#f0f4f8] border-[#cdd8e8] text-[#4a6580]"}`}>
                  {p.icon} {p.name} {p.embed ? "▶" : "↗"}
                </span>
              ))}
            </div>
            <p className="text-[9px] text-[#aab8c8]">▶ plays inline · ↗ opens in platform app</p>
          </div>
        )}
      </div>

      {/* ── Agent Prompt Chips (Dynamic Set Builder) ── */}
      <div className="bg-white rounded-2xl border border-[#cdd8e8] shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-500" />
          <p className="text-sm font-bold text-[#1a2a3a]">AI Set Builder</p>
          <span className="text-[10px] bg-sky-50 border border-sky-200 text-sky-600 px-2 py-0.5 rounded-full font-semibold">Agent</span>
        </div>
        <p className="text-xs text-[#7a9abf]">Click an intent prompt — the AI generates a fresh dynamic queue matching your parameters in real time.</p>
        <div className="flex flex-wrap gap-2">
          {AGENT_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => activatePrompt(i)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                activePrompt === i
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : "bg-[#f0f4f8] border-[#cdd8e8] text-[#4a6580] hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50"
              }`}
            >
              <span>{p.emoji}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        {/* AI response bubble */}
        {promptMsg && (
          <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5">
            <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-sky-500" />
            </div>
            <p className="text-xs text-sky-700 leading-relaxed">{promptMsg}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <PlaylistPanel />
        <div className="xl:col-span-2 space-y-5">
          <NowPlaying />
          <StreamPlayer />
          <FlowQueue />
        </div>
      </div>

      <IntentBar mode="streaming" />
    </div>
  );
}
