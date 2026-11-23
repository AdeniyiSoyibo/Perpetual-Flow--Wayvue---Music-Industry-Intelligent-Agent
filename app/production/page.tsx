"use client";
import { usePlatformStore } from "@/lib/store";
import { BeatLibrary } from "@/components/production/BeatLibrary";
import { WaveformPlayer } from "@/components/production/WaveformPlayer";
import { StemMixer } from "@/components/production/StemMixer";
import { ProductionStudio } from "@/components/production/ProductionStudio";
import { ModeBar } from "@/components/layout/ModeBar";
import { Disc3 } from "lucide-react";

export default function ProductionPage() {
  const { currentBeat, beats } = usePlatformStore();
  const showStemMixer = !!currentBeat || beats.length > 0;

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6">
      <div className="gradient-header rounded-2xl px-5 py-4 border border-sky-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm">
            <Disc3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1a2a3a]">Production Studio</h1>
            <p className="text-xs text-[#7a9abf]">Full DAW engine · Multi-track · AI mix · Plugins · Room correction · Acoustic environment</p>
          </div>
        </div>
        <ModeBar />
      </div>
      <div className="space-y-5">
        <WaveformPlayer />
        {showStemMixer && <StemMixer />}
        <ProductionStudio />
        <BeatLibrary />
      </div>
    </div>
  );
}
