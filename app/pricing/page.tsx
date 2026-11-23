"use client";
import { useState } from "react";
import { PRICING_PLANS } from "@/lib/data";
import {
  Check, Star, Tag, Zap, TrendingUp, Music2, Users, Radio, Film, Disc3,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";

// ── Pitch text sections ───────────────────────────────────────────────────────
const PROBLEM_LINES = [
  "Music is the only major creative industry that still validates compatibility by hand.",
  "Producers audition sound blind. DJs guess transitions by ear. Labels miss the artists they never hear.",
  "Every tool measures something different — and nothing compounds.",
];

const SOLUTION_LINES = [
  "Perpetual Flow is the measurement layer music has never had.",
  "Our engine reduces any track to a nine-dimension perceptual fingerprint — tempo, key, energy, timbre, rhythm — and returns a compatibility score in milliseconds.",
];

const USE_CASES = [
  {
    icon: Disc3,
    title: "Production",
    color: "from-sky-400 to-blue-600",
    text: "Producers rank sounds by measured fit. Every stem, sample and beat is scored against your project's fingerprint — no more auditioning blind.",
  },
  {
    icon: Radio,
    title: "Streaming",
    color: "from-purple-400 to-indigo-600",
    text: "Platforms sequence playlists that hold listeners. Streaming playlists on services and video are finally seamless — perceptual continuity, not random shuffle.",
  },
  {
    icon: Music2,
    title: "DJ Mode",
    color: "from-emerald-400 to-teal-600",
    text: "DJs receive real-time cue points and hardware control signals. Musical experience on dancefloors is enhanced with better apt transitions — better experience for every partygoer.",
  },
  {
    icon: Film,
    title: "Video",
    color: "from-orange-400 to-rose-500",
    text: "Video editors sync music to picture using perceptual beat markers — not manual scrubbing. Every drop lands.",
  },
  {
    icon: Users,
    title: "A&R Discovery",
    color: "from-rose-400 to-orange-500",
    text: "Scouts search ranked talent pipelines instead of listening marathons. Labels find the artists they never hear — scored by market fit, not luck.",
  },
];

const OPPORTUNITY_POINTS = [
  { label: "Producer Pro",        price: "$19.99 / mo",  detail: "Full DAW engine, unlimited beats, stem mixer, AI mix advisor, marketplace access." },
  { label: "Listener Premium",    price: "$9.99 / mo",   detail: "Unlimited streaming, flow-optimized playlists, offline mode, 320kbps hi-fi." },
  { label: "A&R Enterprise",      price: "$499 / mo",    detail: "Full artist discovery dashboard, market-fit scoring API, AI talent matching, white-label." },
  { label: "API Licensing",       price: "Per request",  detail: "Rate-limited REST & WebSocket API. OEM licensing for DJ controllers and DAWs." },
  { label: "Beat Marketplace",    price: "15% commission", detail: "Sellers keep 85%. Every transaction compounds the platform network." },
  { label: "OEM / White-label",   price: "Custom",       detail: "Embed the flow engine in third-party products under license." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(true);

  return (
    <div className="flex flex-col gap-6 p-5 lg:p-6 max-w-5xl mx-auto">

      {/* ── Page header ── */}
      <div className="gradient-header rounded-2xl px-6 py-6 border border-sky-100 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-sky-400 flex items-center justify-center shadow-lg mx-auto mb-3">
          <Tag className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#1a2a3a] mb-1">Plans & Vision</h1>
        <p className="text-sm text-[#4a6580] max-w-xl mx-auto">
          Why Perpetual Flow exists, what it solves, and how every tier compounds into a platform.
        </p>
      </div>

      {/* ── Pitch / Manifesto ── */}
      <div className="bg-white rounded-2xl border border-[#cdd8e8] shadow-sm overflow-hidden">
        <button
          onClick={() => setPitchOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#f8fafc] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-bold text-[#1a2a3a]">Why Perpetual Flow — The Case for a New Music Layer</span>
          </div>
          {pitchOpen
            ? <ChevronUp className="w-4 h-4 text-[#7a9abf]" />
            : <ChevronDown className="w-4 h-4 text-[#7a9abf]" />}
        </button>

        {pitchOpen && (
          <div className="px-6 pb-8 space-y-7">

            {/* Problem */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-purple-500 to-sky-400 flex-shrink-0" />
                <h2 className="text-xs font-bold text-[#7a9abf] uppercase tracking-widest">The Problem</h2>
              </div>
              <div className="space-y-2">
                {PROBLEM_LINES.map((line, i) => (
                  <p key={i} className={`text-sm leading-relaxed ${i === 0 ? "font-semibold text-[#1a2a3a]" : "text-[#4a6580]"}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-sky-400 to-emerald-400 flex-shrink-0" />
                <h2 className="text-xs font-bold text-[#7a9abf] uppercase tracking-widest">The Solution</h2>
              </div>
              <div className="space-y-2">
                {SOLUTION_LINES.map((line, i) => (
                  <p key={i} className={`text-sm leading-relaxed ${i === 0 ? "font-semibold text-[#1a2a3a]" : "text-[#4a6580]"}`}>
                    {line}
                  </p>
                ))}
              </div>
              {/* Nine dimensions visual */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["Tempo", "Key", "Energy", "Timbre", "Rhythm", "Brightness", "Danceability", "Spectral Centroid", "RMS Loudness"].map(d => (
                  <span key={d}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-700">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Four modes */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-purple-500 flex-shrink-0" />
                <h2 className="text-xs font-bold text-[#7a9abf] uppercase tracking-widest">Five Modes — One Platform</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {USE_CASES.map(({ icon: Icon, title, color, text }) => (
                  <div key={title}
                    className="rounded-xl border border-[#e8eef5] p-4 hover:border-sky-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-[#1a2a3a]">{title}</span>
                    </div>
                    <p className="text-xs text-[#4a6580] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Monetisation overview */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-rose-400 to-orange-400 flex-shrink-0" />
                <h2 className="text-xs font-bold text-[#7a9abf] uppercase tracking-widest">Monetisation — From Freemium to Enterprise</h2>
              </div>
              <p className="text-sm text-[#4a6580] leading-relaxed mb-4">
                There is real opportunity to monetise Perpetual Flow across every layer of the music industry.
                Subscription tiers compound with API, marketplace commission, and OEM licensing into a durable, multi-sided revenue model.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {OPPORTUNITY_POINTS.map(({ label, price, detail }) => (
                  <div key={label} className="rounded-xl border border-[#e8eef5] p-3 hover:border-purple-200 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-[#1a2a3a]">{label}</p>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        {price}
                      </span>
                    </div>
                    <p className="text-xs text-[#7a9abf] leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pull quote */}
            <div
              className="rounded-xl px-5 py-4 border-l-4 border-purple-400"
              style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f0f9ff 100%)" }}
            >
              <p className="text-sm font-semibold text-[#1a2a3a] italic leading-relaxed">
                "Imagine: Musical experience on dancefloors better enhanced with apt transitions. Streaming playlists that are truly seamless. Labels that find the artists they never hear. Every tool measuring the same thing — and everything compounding."
              </p>
              <p className="text-[10px] text-[#7a9abf] mt-2 font-semibold tracking-wide">— PERPETUAL FLOW THESIS</p>
            </div>

            {/* CTA into plans */}
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-600">
              <ArrowRight className="w-4 h-4" />
              <span>Select a plan below to get started</span>
            </div>

          </div>
        )}
      </div>

      {/* ── Pricing toggle ── */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm ${!annual ? "text-[#1a2a3a] font-semibold" : "text-[#7a9abf]"}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-11 h-6 rounded-full transition-colors ${annual ? "bg-sky-500" : "bg-[#cdd8e8]"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className={`text-sm ${annual ? "text-[#1a2a3a] font-semibold" : "text-[#7a9abf]"}`}>
          Annual <span className="ml-1 text-[10px] font-bold bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">Save 20%</span>
        </span>
      </div>

      {/* ── Plan cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PRICING_PLANS.map((plan) => {
          const price = annual ? plan.annualPrice : plan.price;
          const colors: Record<string, string> = {
            free:             "from-slate-400 to-slate-600",
            producer_pro:     "from-sky-400 to-blue-600",
            listener_premium: "from-purple-400 to-indigo-600",
            anr_enterprise:   "from-rose-400 to-orange-500",
          };
          const grad = colors[plan.id];
          return (
            <div key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white overflow-hidden shadow-sm ${
                plan.highlight ? "border-sky-300 ring-1 ring-sky-300/50" : "border-[#cdd8e8]"
              }`}>
              <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
              {"highlight" in plan && plan.highlight && (
                <div className="absolute top-3 right-3">
                  <span className="flex items-center gap-1 bg-sky-500 text-white text-[9px] font-bold px-2 py-1 rounded-full">
                    <Star className="w-2.5 h-2.5" fill="white" /> Popular
                  </span>
                </div>
              )}
              <div className="p-5 flex flex-col flex-1">
                <p className="text-xs font-bold text-[#7a9abf] uppercase tracking-wide mb-1">{plan.name}</p>
                <div className="mb-4">
                  {price === 0 ? (
                    <p className="text-3xl font-extrabold text-[#1a2a3a]">Free</p>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-extrabold text-[#1a2a3a]">${price}</span>
                      <span className="text-[#7a9abf] text-sm mb-1">/mo</span>
                    </div>
                  )}
                  {annual && price > 0 && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      Save {Math.round(((plan.price - plan.annualPrice) / plan.price) * 100)}% vs monthly
                    </p>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-[#4a6580]">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${grad} hover:opacity-90 transition-opacity shadow-sm`}>
                  {price === 0 ? "Get Started Free" : `Subscribe — ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Additional revenue streams ── */}
      <div className="bg-white rounded-2xl border border-[#cdd8e8] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e8eef5]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-[#1a2a3a]">Additional Revenue Streams</h2>
          </div>
          <p className="text-xs text-[#7a9abf] mt-0.5">Beyond subscriptions — the platform compounds</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: "Beat Marketplace Commission", detail: "15% on every beat sold. Sellers keep 85%." },
            { name: "Developer API Fees",           detail: "Rate-limited REST & WebSocket API from $0.001/request." },
            { name: "OEM Licensing",                detail: "White-label the flow engine for DJ controllers & DAWs." },
            { name: "Label Catalog Licensing",      detail: "Revenue-share for streaming catalog discovery." },
            { name: "Enterprise Service Agreements",detail: "Custom SLAs, dedicated infra, bespoke model fine-tuning." },
            { name: "Annual Plan Discount",         detail: "20% off all paid tiers on annual billing." },
          ].map(({ name, detail }) => (
            <div key={name} className="p-3 rounded-xl border border-[#e8eef5] hover:border-sky-200 transition-colors">
              <p className="text-xs font-semibold text-[#1a2a3a] mb-1">{name}</p>
              <p className="text-xs text-[#7a9abf]">{detail}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
