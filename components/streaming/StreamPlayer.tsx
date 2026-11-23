"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { usePlatformStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/lib/utils";
import type { Track } from "@/lib/types";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Shuffle,
  Volume2, Upload, Link2, Music, X, Radio, ExternalLink,
  AlertCircle, Info
} from "lucide-react";

// ── Platform detection & routing ──────────────────────────────────────────────

export type StreamPlatform =
  | "youtube" | "soundcloud" | "deezer"
  | "spotify" | "applemusic" | "amazonmusic" | "tidal"
  | "tencent" | "netease" | "iheartradio" | "pandora" | "deezer"
  | "file" | "url" | "mock";

interface PlatformMeta {
  id: StreamPlatform;
  label: string;
  color: string;          // text colour
  bg: string;             // badge bg
  embedable: boolean;     // can render an iframe embed
  deeplinkFn?: (url: string) => string; // open on the external platform
}

const PLATFORM_MAP: PlatformMeta[] = [
  { id: "youtube",      label: "YT",     color: "text-red-600",    bg: "bg-red-50",     embedable: true  },
  { id: "soundcloud",   label: "SC",     color: "text-orange-500", bg: "bg-orange-50",  embedable: true  },
  { id: "deezer",       label: "DZ",     color: "text-purple-600", bg: "bg-purple-50",  embedable: true  },
  { id: "spotify",      label: "SP",     color: "text-green-600",  bg: "bg-green-50",   embedable: false, deeplinkFn: u => u },
  { id: "applemusic",   label: "AM",     color: "text-pink-600",   bg: "bg-pink-50",    embedable: false, deeplinkFn: u => u },
  { id: "amazonmusic",  label: "AZ",     color: "text-sky-600",    bg: "bg-sky-50",     embedable: false, deeplinkFn: u => u },
  { id: "tidal",        label: "TD",     color: "text-cyan-600",   bg: "bg-cyan-50",    embedable: false, deeplinkFn: u => u },
  { id: "tencent",      label: "QQ",     color: "text-blue-600",   bg: "bg-blue-50",    embedable: false, deeplinkFn: u => u },
  { id: "netease",      label: "NE",     color: "text-red-500",    bg: "bg-red-50",     embedable: false, deeplinkFn: u => u },
  { id: "iheartradio",  label: "IH",     color: "text-indigo-600", bg: "bg-indigo-50",  embedable: false, deeplinkFn: u => u },
  { id: "pandora",      label: "PD",     color: "text-blue-500",   bg: "bg-blue-50",    embedable: false, deeplinkFn: u => u },
  { id: "file",         label: "FILE",   color: "text-sky-500",    bg: "bg-sky-50",     embedable: false },
  { id: "url",          label: "URL",    color: "text-violet-500", bg: "bg-violet-50",  embedable: false },
  { id: "mock",         label: "MOCK",   color: "text-slate-400",  bg: "bg-slate-50",   embedable: false },
];

function getMeta(id?: string): PlatformMeta {
  return PLATFORM_MAP.find(p => p.id === id) ?? PLATFORM_MAP.find(p => p.id === "mock")!;
}

export function detectStreamPlatform(url: string): StreamPlatform {
  if (/youtu\.?be/i.test(url))             return "youtube";
  if (/soundcloud\.com/i.test(url))        return "soundcloud";
  if (/deezer\.com/i.test(url))            return "deezer";
  if (/spotify\.com/i.test(url))           return "spotify";
  if (/music\.apple\.com/i.test(url))      return "applemusic";
  if (/music\.amazon\.|music\.amazon\.com/i.test(url)) return "amazonmusic";
  if (/tidal\.com/i.test(url))             return "tidal";
  if (/y\.qq\.com|music\.qq\.com/i.test(url)) return "tencent";
  if (/music\.163\.com/i.test(url))        return "netease";
  if (/iheart\.com/i.test(url))            return "iheartradio";
  if (/pandora\.com/i.test(url))           return "pandora";
  return "url";
}

export function buildEmbedUrl(platform: StreamPlatform, raw: string): string | undefined {
  if (platform === "youtube") {
    const short = raw.match(/youtu\.be\/([^?&]+)/);
    if (short) return `https://www.youtube.com/embed/${short[1]}?autoplay=1&enablejsapi=1`;
    const watch = raw.match(/[?&]v=([^&]+)/);
    if (watch) return `https://www.youtube.com/embed/${watch[1]}?autoplay=1&enablejsapi=1`;
    const embed = raw.match(/embed\/([^?&]+)/);
    if (embed) return `https://www.youtube.com/embed/${embed[1]}?autoplay=1&enablejsapi=1`;
    return undefined;
  }
  if (platform === "soundcloud") {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&color=%2338bdf8&auto_play=true&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
  }
  if (platform === "deezer") {
    // Deezer public widget: extract track/album/playlist ID
    // e.g. https://www.deezer.com/en/track/123456
    const trackM  = raw.match(/deezer\.com\/(?:\w+\/)?track\/(\d+)/i);
    const albumM  = raw.match(/deezer\.com\/(?:\w+\/)?album\/(\d+)/i);
    const playM   = raw.match(/deezer\.com\/(?:\w+\/)?playlist\/(\d+)/i);
    if (trackM)  return `https://widget.deezer.com/widget/dark/track/${trackM[1]}`;
    if (albumM)  return `https://widget.deezer.com/widget/dark/album/${albumM[1]}`;
    if (playM)   return `https://widget.deezer.com/widget/dark/playlist/${playM[1]}`;
    return undefined;
  }
  return undefined;
}

// Non-embeddable platforms — explanation to show user
const PLATFORM_BRIDGE: Record<string, { name: string; why: string; tip: string; icon: string }> = {
  spotify:     { name: "Spotify",          icon: "🎧", why: "Spotify does not allow third-party embedding or playback outside their app.", tip: "Copy the track URL in Spotify → paste here to open it instantly in Spotify's web player in a new tab." },
  applemusic:  { name: "Apple Music",      icon: "🍎", why: "Apple Music requires sign-in and does not expose a public embed API.", tip: "Copy any Apple Music link → paste here to open it in Apple Music web player in a new tab." },
  amazonmusic: { name: "Amazon Music",     icon: "📦", why: "Amazon Music requires Prime/Unlimited and has no public embed API.", tip: "Paste an Amazon Music link → we'll open it in their web player in a new tab." },
  tidal:       { name: "TIDAL",            icon: "🌊", why: "TIDAL uses a private API — no public iframe embedding.", tip: "Paste a TIDAL link → opens in TIDAL web player. For lossless playback, use the TIDAL desktop app." },
  tencent:     { name: "QQ Music",         icon: "🇨🇳", why: "QQ Music (Tencent) is region-locked and has no public embed for non-China browsers.", tip: "Paste a QQ Music or y.qq.com link → opens in a new tab on their platform." },
  netease:     { name: "NetEase Cloud Music", icon: "☁️", why: "NetEase Cloud Music is primarily available within China and has no public embed API.", tip: "Paste a music.163.com link → opens in a new tab on their platform." },
  iheartradio: { name: "iHeartRadio",      icon: "📻", why: "iHeartRadio is a broadcast platform — live radio streams use proprietary tokens.", tip: "Paste an iHeart link → opens in iHeart web player. Or paste a direct .m3u8 HLS stream URL to play it here." },
  pandora:     { name: "Pandora",          icon: "🎵", why: "Pandora requires US-based sign-in and has no public embed API.", tip: "Paste a Pandora link → opens in Pandora. Or use direct audio URLs for local playback." },
};

// ── Track type extended for stream platform ───────────────────────────────────
export type StreamTrack = Track & { platform?: StreamPlatform };

// ── Component ─────────────────────────────────────────────────────────────────
export function StreamPlayer() {
  const {
    currentTrack, setCurrentTrack, queue, setQueue,
    streamPlaying, setStreamPlaying,
    streamCurrentTime, setStreamCurrentTime,
    streamDuration, setStreamDuration,
  } = usePlatformStore();

  const [volume, setVolume]           = useState(80);
  const [crossfade, setCrossfadeVal]  = useState(3);
  const [repeat, setRepeat]           = useState(false);
  const [shuffle, setShuffle]         = useState(false);
  const [urlInput, setUrlInput]       = useState("");
  const [urlError, setUrlError]       = useState("");
  const [dragging, setDragging]       = useState(false);
  const [embedTrack, setEmbedTrack]   = useState<StreamTrack | null>(null);
  const [bridgeInfo, setBridgeInfo]   = useState<typeof PLATFORM_BRIDGE[string] | null>(null);
  const [bridgeUrl, setBridgeUrl]     = useState<string>("");

  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef       = useRef<number>(0);

  const track = currentTrack as StreamTrack | null;
  const activeIdx = queue.findIndex(t => t.id === track?.id);
  const progress  = streamDuration > 0 ? (streamCurrentTime / streamDuration) * 100 : 0;

  // ── when currentTrack changes ──────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    setStreamCurrentTime(0);
    setStreamDuration(0);
    setUrlError("");
    setBridgeInfo(null);
    setBridgeUrl("");

    if (!track) { setStreamPlaying(false); setEmbedTrack(null); return; }

    const platform = (track.platform ?? (track.src ? "file" : "mock")) as StreamPlatform;

    // Embeddable platforms
    if (platform === "youtube" || platform === "soundcloud" || platform === "deezer") {
      setEmbedTrack(track as StreamTrack);
      setStreamPlaying(true);
      return;
    }

    // Bridge platforms — open externally, show info
    if (PLATFORM_BRIDGE[platform]) {
      setEmbedTrack(null);
      setBridgeInfo(PLATFORM_BRIDGE[platform]);
      setBridgeUrl(track.src ?? "");
      setStreamPlaying(false);
      return;
    }

    setEmbedTrack(null);
    const el = audioRef.current;
    if (!el) return;

    if (!track.src) { setStreamPlaying(false); return; }

    el.src = track.src;
    el.volume = volume / 100;
    el.load();
    el.onloadedmetadata = () => setStreamDuration(el.duration || 0);
    el.onerror = () => {
      setUrlError(`Cannot play "${track.title}" — format unsupported or URL blocked (CORS). Try opening externally.`);
      setStreamPlaying(false);
    };
    el.play()
      .then(() => {
        setStreamPlaying(true);
        const tick = () => { setStreamCurrentTime(el.currentTime); rafRef.current = requestAnimationFrame(tick); };
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => setStreamPlaying(false));

    return () => { cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);

  const togglePlay = useCallback(() => {
    if (!track) return;
    const p = track.platform as StreamPlatform;
    if (p === "youtube" || p === "soundcloud" || p === "deezer" || PLATFORM_BRIDGE[p ?? ""]) return;
    const el = audioRef.current;
    if (!el || !track.src) return;
    if (el.paused) {
      el.play().then(() => {
        setStreamPlaying(true);
        const tick = () => { setStreamCurrentTime(el.currentTime); rafRef.current = requestAnimationFrame(tick); };
        rafRef.current = requestAnimationFrame(tick);
      }).catch(() => setStreamPlaying(false));
    } else {
      el.pause(); setStreamPlaying(false); cancelAnimationFrame(rafRef.current);
    }
  }, [track, setStreamPlaying, setStreamCurrentTime]);

  const skipTo = useCallback((idx: number) => {
    const target = queue[Math.max(0, Math.min(queue.length - 1, idx))];
    if (target) setCurrentTrack(target);
  }, [queue, setCurrentTrack]);

  const next = useCallback(() => {
    if (!queue.length) return;
    const idx = shuffle ? Math.floor(Math.random() * queue.length) : (activeIdx + 1) % queue.length;
    skipTo(idx);
  }, [queue, shuffle, activeIdx, skipTo]);

  const prev = useCallback(() => skipTo(activeIdx > 0 ? activeIdx - 1 : 0), [activeIdx, skipTo]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !streamDuration) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - r.left) / r.width) * streamDuration;
    setStreamCurrentTime(el.currentTime);
  };

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newTracks: StreamTrack[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) continue;
      newTracks.push({
        id: `upload-${Date.now()}-${f.name}`,
        title: f.name.replace(/\.[^.]+$/, ""), artist: "Uploaded", coverUrl: "",
        duration: 0, bpm: 0, energy: 0.5, valence: 0.5, danceability: 0.5, key: "C",
        src: URL.createObjectURL(f), platform: "file",
      });
    }
    if (!newTracks.length) return;
    setQueue([...queue, ...newTracks]);
    if (!currentTrack) setCurrentTrack(newTracks[0]);
  }, [queue, currentTrack, setQueue, setCurrentTrack]);

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlError("");
    const platform = detectStreamPlatform(url);
    const embedUrl = buildEmbedUrl(platform, url);
    const title = url.split("/").filter(Boolean).pop()?.split("?")[0] ?? "Stream";
    const bridge = PLATFORM_BRIDGE[platform];

    const newTrack: StreamTrack = {
      id: `stream-${Date.now()}`,
      title: bridge ? `${bridge.name}: ${title}` : title,
      artist: getMeta(platform).label,
      coverUrl: "", duration: 0, bpm: 0, energy: 0.5, valence: 0.5, danceability: 0.5, key: "C",
      // src always stores original URL so "Open in platform" link works for all platforms
      src: url,
      embedUrl,
      platform,
    };
    const updated = [...queue, newTrack];
    setQueue(updated);
    setCurrentTrack(newTrack);
    setUrlInput("");
  };

  const removeTrack = (id: string) => {
    const next = queue.filter(t => t.id !== id);
    setQueue(next);
    if (track?.id === id) setCurrentTrack(next[0] ?? null);
  };

  const PlatformBadge = ({ p }: { p?: string }) => {
    const meta = getMeta(p);
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.color} ${meta.bg}`}>
        {meta.label}
      </span>
    );
  };

  const platform = track?.platform as StreamPlatform | undefined;
  const isEmbedable = platform === "youtube" || platform === "soundcloud" || platform === "deezer";
  const isBridge    = !!PLATFORM_BRIDGE[platform ?? ""];
  const canDirectPlay = track?.src && !isEmbedable && !isBridge;
  const isMock = track && !track.src && !track.embedUrl && !isBridge;

  const embedHeight = platform === "youtube" ? 215 : platform === "deezer" ? 92 : 166;

  return (
    <Card title="Universal Stream Player" subtitle="YouTube · SoundCloud · Deezer · Spotify · Apple Music · Amazon · TIDAL · Direct audio · File upload">
      <audio ref={audioRef} onEnded={() => { if (repeat) audioRef.current?.play(); else next(); }} />

      <div className="p-4 space-y-4">

        {/* ── Import row ── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${
              dragging ? "border-sky-400 bg-sky-50 text-sky-600" : "border-[#cdd8e8] text-[#7a9abf] hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50"
            }`}>
            <Upload className="w-4 h-4" /> Upload / Drop
          </button>
          <input ref={fileInputRef} type="file" multiple accept="audio/*,video/*" className="hidden"
            onChange={e => addFiles(e.target.files)} />

          <div className="flex flex-1 min-w-[240px] gap-1">
            <div className="relative flex-1">
              <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7a9abf]" />
              <input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addUrl()}
                placeholder="Paste any music URL — YouTube · Spotify · Apple Music · SoundCloud · Deezer · TIDAL · MP3…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#cdd8e8] bg-[#f0f4f8] text-[#1a2a3a] placeholder:text-[#7a9abf] focus:outline-none focus:border-sky-400"
              />
            </div>
            <button onClick={addUrl}
              className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold transition-colors">
              Add
            </button>
          </div>
        </div>

        {/* ── Platform pills ── */}
        <div className="flex flex-wrap gap-1">
          {[
            { label: "YouTube",          color: "text-red-600 bg-red-50 border-red-100" },
            { label: "SoundCloud",       color: "text-orange-500 bg-orange-50 border-orange-100" },
            { label: "Deezer",           color: "text-purple-600 bg-purple-50 border-purple-100" },
            { label: "Spotify",          color: "text-green-600 bg-green-50 border-green-100" },
            { label: "Apple Music",      color: "text-pink-600 bg-pink-50 border-pink-100" },
            { label: "Amazon Music",     color: "text-sky-600 bg-sky-50 border-sky-100" },
            { label: "TIDAL",            color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
            { label: "QQ Music",         color: "text-blue-600 bg-blue-50 border-blue-100" },
            { label: "NetEase",          color: "text-red-500 bg-red-50 border-red-100" },
            { label: "iHeartRadio",      color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { label: "Pandora",          color: "text-blue-500 bg-blue-50 border-blue-100" },
            { label: "Direct MP3/FLAC",  color: "text-slate-600 bg-slate-50 border-slate-200" },
          ].map(p => (
            <span key={p.label} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>
          ))}
        </div>

        {urlError && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{urlError}</span>
          </div>
        )}

        {/* ── Bridge panel (Spotify / Apple Music / Amazon / etc.) ── */}
        {isBridge && bridgeInfo && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{bridgeInfo.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1a2a3a]">{bridgeInfo.name}</p>
                <p className="text-xs text-amber-700 mt-0.5">{bridgeInfo.why}</p>
                <p className="text-xs text-[#4a6580] mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-sky-500" />{bridgeInfo.tip}
                </p>
              </div>
            </div>
            {bridgeUrl && (
              <a href={bridgeUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 w-fit px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Open in {bridgeInfo.name}
              </a>
            )}
          </div>
        )}

        {/* ── Embed player (YouTube / SoundCloud / Deezer) ── */}
        {isEmbedable && embedTrack && embedTrack.embedUrl && (
          <div className="rounded-xl overflow-hidden border border-[#e8eef5]">
            <iframe
              key={embedTrack.id}
              src={embedTrack.embedUrl}
              className="w-full"
              style={{ height: embedHeight }}
              allow="autoplay; encrypted-media; fullscreen; clipboard-write; picture-in-picture"
              allowFullScreen
              title={embedTrack.title}
            />
            <div className="px-3 py-2 bg-[#f0f4f8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlatformBadge p={embedTrack.platform} />
                <span className="text-xs font-semibold text-[#1a2a3a] truncate max-w-[200px]">{embedTrack.title}</span>
              </div>
              {/* src now always holds the original URL — safe to link */}
              {embedTrack.src && (
                <a href={embedTrack.src} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#7a9abf] hover:text-sky-500">
                  <ExternalLink className="w-3 h-3" /> Open in {getMeta(embedTrack.platform).label}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Embed URL missing for embeddable platform */}
        {isEmbedable && embedTrack && !embedTrack.embedUrl && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
            Could not parse embed URL from this {platform} link. Please paste the full track/video URL.
          </div>
        )}

        {/* ── Now playing (direct audio or file) ── */}
        {!isEmbedable && !isBridge && track && (
          <>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f0f4f8] border border-[#e8eef5]">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Music className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-[#1a2a3a] truncate">{track.title}</p>
                  <PlatformBadge p={track.platform} />
                </div>
                <p className="text-xs text-[#7a9abf] truncate">{track.artist}</p>
              </div>
              {queue.length > 0 && (
                <span className="text-[10px] text-[#7a9abf] font-mono flex-shrink-0">{activeIdx + 1}/{queue.length}</span>
              )}
            </div>

            {isMock && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                📋 Mock track — no audio source. Upload a file or paste a direct URL to hear audio.
              </p>
            )}

            {canDirectPlay && (
              <div>
                <div className="h-2 bg-[#e8eef5] rounded-full cursor-pointer overflow-hidden" onClick={seek}>
                  <div className="h-full bg-gradient-to-r from-sky-400 to-purple-500 rounded-full transition-none"
                    style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-[#7a9abf] mt-1">
                  <span>{formatDuration(Math.floor(streamCurrentTime))}</span>
                  <span>{formatDuration(Math.floor(streamDuration))}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShuffle(!shuffle)}
                className={`p-2 rounded-xl transition-colors ${shuffle ? "text-sky-500 bg-sky-50" : "text-[#7a9abf] hover:bg-[#f0f4f8]"}`}>
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={prev} className="p-2 rounded-xl text-[#4a6580] hover:bg-[#f0f4f8] transition-colors">
                <SkipBack className="w-5 h-5" />
              </button>
              <button onClick={togglePlay} disabled={!!isMock}
                className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-md transition-opacity ${
                  isMock ? "bg-[#cdd8e8] cursor-not-allowed" : "bg-gradient-to-br from-sky-400 to-blue-600 hover:opacity-90"
                }`}>
                {streamPlaying && canDirectPlay ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={next} className="p-2 rounded-xl text-[#4a6580] hover:bg-[#f0f4f8] transition-colors">
                <SkipForward className="w-5 h-5" />
              </button>
              <button onClick={() => setRepeat(!repeat)}
                className={`p-2 rounded-xl transition-colors ${repeat ? "text-sky-500 bg-sky-50" : "text-[#7a9abf] hover:bg-[#f0f4f8]"}`}>
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#7a9abf] flex items-center gap-1 mb-1">
                  <Volume2 className="w-3 h-3" /> Volume {volume}%
                </label>
                <input type="range" min={0} max={100} value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="w-full h-1.5" style={{ accentColor: "#38bdf8" }} />
              </div>
              <div>
                <label className="text-[10px] text-[#7a9abf] mb-1 block">Auto-crossfade {crossfade}s</label>
                <input type="range" min={0} max={12} step={0.5} value={crossfade}
                  onChange={e => setCrossfadeVal(Number(e.target.value))}
                  className="w-full h-1.5" style={{ accentColor: "#38bdf8" }} />
              </div>
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {!track && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-[#cdd8e8]">
            <Radio className="w-10 h-10" />
            <p className="text-sm text-[#7a9abf]">Nothing loaded yet</p>
            <p className="text-xs text-[#cdd8e8] text-center max-w-xs">
              Paste a link from any platform above, upload audio files,<br />
              or click Play on a playlist in the left panel
            </p>
          </div>
        )}

        {/* ── Queue ── */}
        {queue.length > 0 && (
          <div className="border-t border-[#f0f4f8] pt-3 space-y-1 max-h-52 overflow-y-auto">
            <p className="text-[10px] font-semibold text-[#7a9abf] uppercase px-1 mb-2">Queue · {queue.length} tracks</p>
            {queue.map((t, i) => {
              const isActive = t.id === track?.id;
              return (
                <div key={t.id} onClick={() => setCurrentTrack(t)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
                    isActive ? "bg-sky-50 border border-sky-200" : "hover:bg-[#f0f4f8]"
                  }`}>
                  <span className={`text-[10px] font-mono w-4 flex-shrink-0 ${isActive ? "text-sky-500" : "text-[#cdd8e8]"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold text-[#1a2a3a] truncate">{t.title}</p>
                      <PlatformBadge p={(t as StreamTrack).platform} />
                    </div>
                    <p className="text-[10px] text-[#7a9abf] truncate">{t.artist}</p>
                  </div>
                  {isActive && streamPlaying && (
                    <div className="flex items-end gap-px h-4 w-4 flex-shrink-0">
                      {[0,1,2].map(j => (
                        <div key={j} className="flex-1 bg-sky-400 rounded-sm wave-bar" style={{ animationDelay:`${j*0.1}s` }} />
                      ))}
                    </div>
                  )}
                  <button onClick={e => { e.stopPropagation(); removeTrack(t.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-50 hover:text-rose-500 text-[#cdd8e8] transition-all flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </Card>
  );
}
