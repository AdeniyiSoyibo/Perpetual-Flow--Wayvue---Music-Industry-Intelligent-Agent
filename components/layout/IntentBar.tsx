"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, ChevronDown, ChevronUp } from "lucide-react";

// ── Simulated AI response engine ──────────────────────────────────────────────
// In production this calls your LLM endpoint. Here we produce deterministic
// context-aware replies based on keyword matching.
function simulateAIResponse(input: string, mode: string): string {
  const q = input.toLowerCase();
  if (q.includes("bridge") || q.includes("blend")) {
    return `🔍 Analysing loaded tracks… Flow Score 94. The onset density of Deck B (128 BPM, D minor) aligns with Deck A (126 BPM, F major) — a +2 BPM tempo nudge and a 3-step crossfade at 2:34 will give a smooth harmonic blend. Try Echo Out FX on the transition.`;
  }
  if (q.includes("warm") || q.includes("warm-up") || q.includes("30 min")) {
    return `🎵 Building 30-minute warm-up set… Suggested arc: Lo-Fi Chill Beats (0–10 min) → Afropop Party (10–20 min) → Hip-Hop Megamix (20–30 min). Energy ramp: 0.3 → 0.5 → 0.72. Loaded to queue.`;
  }
  if (q.includes("bpm") || q.includes("sync")) {
    return `🎚 BPM Analysis: Deck A is 126 BPM · Deck B is 132 BPM. To sync: set Deck B tempo fader to −4.5% (target offset). Key Lock enabled — pitch unchanged. Ready to mix.`;
  }
  if (q.includes("next") || q.includes("recommend")) {
    return `🤖 Top 3 next tracks based on current Flow Score (88):\n1. Techno DJ Set — Flow 93 · 128 BPM · harmonic match\n2. EDM / Future Bass — Flow 89 · 130 BPM · energy +12%\n3. Classic House Set — Flow 86 · 124 BPM · smooth cool-down`;
  }
  if (q.includes("chill") || q.includes("relax") || q.includes("lo-fi")) {
    return `🌙 Loading chill arc: Lo-Fi Chill Beats → R&B Mix → Afropop Party. Energy envelope: 0.25 → 0.38 → 0.45. Tempo range: 70–95 BPM. Set duration: ~45 min.`;
  }
  if (q.includes("peak") || q.includes("energy") || q.includes("hype")) {
    return `⚡ Peak hour mode: Loaded Techno DJ Set → EDM / Future Bass → Drill Set. Crossfader set to equal power. Suggested cue points stamped at downbeats. Flow Score projection: 96.`;
  }
  if (q.includes("key") || q.includes("harmonic") || q.includes("camelot")) {
    return `🎵 Harmonic analysis: Deck A is F major (Camelot 7B). Compatible keys for mix: C major (8B), D minor (7A), Bb major (6B). Loaded tracks matching: Hip-Hop Megamix (C major, Flow 91).`;
  }
  if (q.includes("video") || q.includes("visual")) {
    return `📺 Video Mixer suggestion: Load "Classic House Set" on Deck A and "Afropop Party" on Deck B. BPM sync projection: 126 BPM. Suggested Transition FX: Riser at 1:45. Hot cue at 2:08 for the drop.`;
  }
  if (q.includes("autopilot") || q.includes("auto")) {
    return `🤖 Autopilot activated. Monitoring Deck A BPM (${Math.floor(118 + Math.random() * 20)} BPM). Deck B queued with best-match track (Flow Score: ${Math.floor(88 + Math.random() * 10)}). I'll notify you 30 seconds before the optimal mix point.`;
  }
  return `🧠 Analysing "${input}" in ${mode} context… Flow Score: ${Math.floor(78 + Math.random() * 20)}. I see this as a ${["high-energy", "smooth", "transitional", "peak-hour"][Math.floor(Math.random() * 4)]} moment. ${["Try a 4-beat echo out before the drop.", "Stamp a hot cue here for quick recall.", "BPM sync recommended — Deck B is 2 BPM off.", "This key pairs perfectly with the queued track."][Math.floor(Math.random() * 4)]}`;
}

// ── Prompt suggestions per mode ───────────────────────────────────────────────
const SUGGESTIONS: Record<string, string[]> = {
  dj: [
    "Find the best bridge track between the loaded tracks",
    "Build a 30-minute warm-up set",
    "Sync BPM between Deck A and Deck B",
    "What are the top 3 next tracks?",
    "Analyse harmonic compatibility",
  ],
  "video-mixer": [
    "Sync video loops to current audio BPM",
    "Best transition FX for this drop",
    "Build a 30-minute visual set",
    "Stamp hot cues at the drops",
  ],
  streaming: [
    "Start chill, end aggressive — build me a set",
    "Only 120–128 BPM house tracks",
    "Build a peak-hour playlist",
    "Find tracks with high danceability",
    "Create a 45-minute warm-up arc",
  ],
  default: [
    "What should I play next?",
    "Analyse the current track",
    "Build a set around this energy",
    "Find a smooth transition",
  ],
};

interface Message { role: "user" | "ai"; text: string; ts: string; }

interface IntentBarProps { mode?: string; }

export function IntentBar({ mode = "default" }: IntentBarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "I'm your AI DJ assistant. Ask me to build sets, analyse tracks, sync BPM, or recommend transitions.", ts: "now" }
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = SUGGESTIONS[mode] ?? SUGGESTIONS.default;

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", text: text.trim(), ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    // Simulate network latency
    setTimeout(() => {
      const reply = simulateAIResponse(text, mode);
      setMessages(m => [...m, { role: "ai", text: reply, ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      setLoading(false);
    }, 600 + Math.random() * 400);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-5xl mx-auto px-4 pb-3 pointer-events-auto">

        {/* Expanded chat panel */}
        {open && (
          <div className="mb-2 bg-[#0d1520] border border-[#2a3a4a] rounded-2xl shadow-2xl overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2a3a]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-bold text-white">AI Intent Engine</span>
                <span className="text-[10px] text-[#4a6070] bg-[#1a2a3a] px-2 py-0.5 rounded-full uppercase font-semibold">{mode}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#4a6070] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="h-56 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "ai" && (
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-sky-500 text-white rounded-br-sm"
                      : "bg-[#1a2a3a] text-[#c8d8e8] border border-[#2a3a4a] rounded-bl-sm"
                  }`}>
                    {m.text}
                    <div className={`text-[9px] mt-1 ${m.role === "user" ? "text-sky-200" : "text-[#4a6070]"}`}>{m.ts}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
                  </div>
                  <div className="bg-[#1a2a3a] border border-[#2a3a4a] rounded-2xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-[#1a2a3a] border border-[#2a3a4a] text-[#4a9abf] hover:border-sky-500 hover:text-sky-300 transition-colors">
                  {s}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 pb-3 flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder={`Ask the AI anything about your ${mode} session…`}
                className="flex-1 px-3 py-2 text-sm rounded-xl bg-[#1a2a3a] border border-[#2a3a4a] text-white placeholder:text-[#4a6070] focus:outline-none focus:border-sky-500"
              />
              <button onClick={() => send(input)} disabled={!input.trim() || loading}
                className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Collapsed trigger bar */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0d1520]/95 backdrop-blur-sm border border-[#2a3a4a] shadow-2xl hover:border-sky-500/50 transition-all group"
        >
          <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 group-hover:animate-pulse" />
          </div>
          <span className="text-sm text-[#4a6070] group-hover:text-sky-300 transition-colors flex-1 text-left">
            Ask AI — &quot;Find the best bridge track&quot; · &quot;Build a 30-min set&quot; · &quot;Sync BPM between decks&quot;…
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {messages.length > 1 && (
              <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full font-semibold">
                {messages.length - 1} msg{messages.length > 2 ? "s" : ""}
              </span>
            )}
            {open ? <ChevronDown className="w-4 h-4 text-[#4a6070]" /> : <ChevronUp className="w-4 h-4 text-[#4a6070]" />}
          </div>
        </button>
      </div>
    </div>
  );
}
