"use client";

import { useState, useEffect } from "react";
import { ModeBar } from "@/components/layout/ModeBar";
import { YouTubeMixPanel } from "@/components/dj/YouTubeMixPanel";
import { MidiEngineProvider } from "@/components/dj/MidiEngine";
import { IntentBar } from "@/components/layout/IntentBar";
import { PlaySquare, Bot, Zap } from "lucide-react";

export default function VideoMixerPage() {
  const [autopilot, setAutopilot] = useState(false);
  const [autopilotMsg, setAutopilotMsg] = useState("");

  useEffect(() => {
    if (!autopilot) { setAutopilotMsg(""); return; }
    const msgs = [
      "🎬 Autopilot: Video loop on Deck B synced to 126 BPM. Loop point stamped at bar 32.",
      "📺 Autopilot: Scene change detected — transitioning to Deck B at next downbeat.",
      "⚡ Autopilot: BPM match complete. Riser FX queued for 4-bar build.",
      "🌊 Autopilot: Smooth video blend window open — 8 bars to mix point.",
      "🎚 Autopilot: EQ low-cut applied to outgoing deck for cleaner visual transition.",
    ];
    setAutopilotMsg(msgs[0]);
    const iv = setInterval(() => {
      setAutopilotMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    }, 8000);
    return () => clearInterval(iv);
  }, [autopilot]);

  return (
    <MidiEngineProvider>
      <div className="flex flex-col gap-5 p-5 lg:p-6 pb-24">
        {/* Header */}
        <div className="gradient-header rounded-2xl px-5 py-4 border border-sky-100 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shadow-sm">
              <PlaySquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-[#1a2a3a]">Video Mixer</h1>
              <p className="text-xs text-[#7a9abf]">
                Animated vinyl decks · 3-band EQ · Hot cues · Loop · Transition FX · Crossfader · Sample pads
              </p>
            </div>
            {/* Autopilot toggle */}
            <button
              onClick={() => setAutopilot(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${autopilot ? "bg-red-500 text-white border-red-500 shadow-sm animate-pulse" : "bg-white border-[#cdd8e8] text-[#4a6580] hover:border-red-300"}`}
              title="Agent Autopilot — AI syncs video loops to audio BPM">
              <Bot className="w-3.5 h-3.5" />
              {autopilot ? "AUTOPILOT ON" : "Autopilot"}
            </button>
          </div>
          <ModeBar />
        </div>

        {/* Autopilot status bar */}
        {autopilot && autopilotMsg && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
            <Zap className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
            <p className="text-sm text-red-700 font-medium">{autopilotMsg}</p>
          </div>
        )}

        <YouTubeMixPanel />
      </div>
      <IntentBar mode="video-mixer" />
    </MidiEngineProvider>
  );
}
