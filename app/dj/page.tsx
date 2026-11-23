"use client";

import { useEffect, useState } from "react";
import { usePlatformStore } from "@/lib/store";
import { DeckController } from "@/components/dj/DeckController";
import { CrossfaderModule } from "@/components/dj/CrossfaderModule";
import { HardwareConnectPanel } from "@/components/dj/HardwareConnectPanel";
import { SetBuilder } from "@/components/dj/SetBuilder";
import { SamplePad } from "@/components/dj/SamplePad";
import { SoundBrowser } from "@/components/dj/SoundBrowser";
import { ModeBar } from "@/components/layout/ModeBar";
import { MidiEngineProvider } from "@/components/dj/MidiEngine";
import { IntentBar } from "@/components/layout/IntentBar";
import { Music2, Bot, Zap } from "lucide-react";

export default function DJPage() {
  const { setDeckA, setDeckB } = usePlatformStore();
  const [autopilot, setAutopilot] = useState(false);
  const [autopilotMsg, setAutopilotMsg] = useState("");

  useEffect(() => {
    setDeckA(null);
    setDeckB(null);
  }, [setDeckA, setDeckB]);

  // Autopilot: periodically emit AI suggestions when active
  useEffect(() => {
    if (!autopilot) { setAutopilotMsg(""); return; }
    const msgs = [
      "🤖 Autopilot: Deck B loaded with best-match track (Flow 94). Mix point in ~28s.",
      "🎚 Autopilot: BPM drift detected (+1.2 BPM). Nudging Deck B tempo fader.",
      "🎵 Autopilot: Harmonic shift incoming — recommend crossfade at 2:34.",
      "⚡ Autopilot: Energy peak reached. Queueing high-energy track for Deck B.",
      "🌊 Autopilot: Smooth blend window open — 8 bars to mix point.",
    ];
    setAutopilotMsg(msgs[0]);
    const iv = setInterval(() => {
      setAutopilotMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    }, 8000);
    return () => clearInterval(iv);
  }, [autopilot]);

  return (
    <MidiEngineProvider>
    <div className="bg-[#141922] pb-24">
      <div className="flex flex-col gap-4 p-4 lg:p-5 max-w-[1600px] mx-auto">

      {/* ── Header ── */}
      <div className="gradient-header rounded-2xl px-5 py-4 border border-sky-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-[#1a2a3a]">DJ Mode</h1>
          </div>
          <button
            onClick={() => setAutopilot(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              autopilot
                ? "bg-sky-500 text-white border-sky-500 shadow-sm animate-pulse"
                : "bg-white border-[#cdd8e8] text-[#4a6580] hover:border-sky-300"
            }`}
            title="Agent Autopilot — AI manages Deck B and mix timing">
            <Bot className="w-3.5 h-3.5" />
            {autopilot ? "AUTOPILOT ON" : "Autopilot"}
          </button>
        </div>
        <ModeBar />
      </div>

      {/* ── Autopilot bar ── */}
      {autopilot && autopilotMsg && (
        <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-2.5">
          <Zap className="w-4 h-4 text-sky-500 flex-shrink-0 animate-pulse" />
          <p className="text-sm text-sky-700 font-medium">{autopilotMsg}</p>
        </div>
      )}

      {/* ── Crossfader — full width ── */}
      <CrossfaderModule />

      {/* ── Decks side-by-side, right tools column on xl+ ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <DeckController side="A" />
        <DeckController side="B" />
      </div>

      <HardwareConnectPanel />
      <SamplePad />
      <SoundBrowser />
      <SetBuilder />

      </div>
    </div>
    <IntentBar mode="dj" />
    </MidiEngineProvider>
  );
}
