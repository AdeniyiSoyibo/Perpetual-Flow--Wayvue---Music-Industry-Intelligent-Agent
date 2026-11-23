"use client";
/**
 * HardwareConnectPanel — Full MIDI hardware management UI
 *
 * - Request MIDI access / permission
 * - Device input / output selectors
 * - Preset selector (auto-detected from device name)
 * - CC mapping table (preset + custom overrides)
 * - Add / remove custom mappings
 * - Live message log (last 24 messages)
 * - Send test CC / Note / LED feedback
 */

import { useState, useCallback, useEffect } from "react";
import {
  useMidiEngine,
  MIDI_PRESETS,
  type CCMapping,
} from "./MidiEngine";
import {
  Usb, Radio, Zap, List, Terminal, Plus, Trash2,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Small helpers ─────────────────────────────────────────────────────────────
function hex2(n: number) { return n.toString(16).padStart(2, "0").toUpperCase(); }
function statusBadge(state: string) {
  return state === "connected"
    ? <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5" />
    : <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1.5" />;
}

// ── Section toggle ─────────────────────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#e8eef5] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[#f7fafd] hover:bg-[#edf3fa] transition-colors text-left"
      >
        <span className="text-sky-500">{icon}</span>
        <span className="text-xs font-bold text-[#1a2a3a] flex-1">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[#7a9abf]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#7a9abf]" />}
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function HardwareConnectPanel() {
  const midi = useMidiEngine();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Test CC state
  const [testCh,  setTestCh]  = useState(1);
  const [testCC,  setTestCC]  = useState(1);
  const [testVal, setTestVal] = useState(64);

  // Add custom mapping form
  const [mapAction,  setMapAction]  = useState("");
  const [mapChannel, setMapChannel] = useState(1);
  const [mapCC,      setMapCC]      = useState(0);
  const [mapInvert,  setMapInvert]  = useState(false);

  const addMapping = useCallback(() => {
    if (!mapAction.trim()) return;
    midi.addCustomMapping({ action: mapAction.trim(), channel: mapChannel, cc: mapCC, invert: mapInvert });
    setMapAction(""); setMapCC(0); setMapInvert(false);
  }, [midi, mapAction, mapChannel, mapCC, mapInvert]);

  const activePresetData = MIDI_PRESETS.find(p => p.id === midi.activePreset) ?? MIDI_PRESETS[MIDI_PRESETS.length - 1];
  const allMappings: CCMapping[] = [
    ...activePresetData.mappings.map(m => ({ ...m, _isCustom: false })),
    ...midi.customMappings.map(m => ({ ...m, _isCustom: true })),
  ] as (CCMapping & { _isCustom: boolean })[];

  if (!mounted) return null;

  // ── Not supported ────────────────────────────────────────────────────────────
  if (!midi.supported) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center space-y-2">
        <Usb className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-sm font-bold text-amber-700">Web MIDI Not Supported</p>
        <p className="text-xs text-amber-600">Use Chrome or Edge to connect hardware turntables and controllers.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dce8f5] bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 flex items-center gap-2">
        <Usb className="w-5 h-5 text-white" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Hardware Connect</p>
          <p className="text-[10px] text-sky-100">Web MIDI · Pioneer · Technics · Reloop · Numark · Akai</p>
        </div>
        {/* Permission button */}
        {!midi.granted ? (
          <button
            onClick={midi.requestAccess}
            disabled={midi.requesting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-60"
          >
            {midi.requesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {midi.requesting ? "Connecting…" : "Connect MIDI"}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold text-green-200">
            <span className="w-2 h-2 rounded-full bg-green-300 inline-block" /> MIDI Active
          </span>
        )}
      </div>

      {/* Error */}
      {midi.error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-600">{midi.error}</div>
      )}

      <div className="p-3 space-y-3">

        {/* ── Devices ─────────────────────────────────────────────────────────── */}
        <Section title="Devices" icon={<Radio className="w-3.5 h-3.5" />}>
          {midi.inputs.length === 0 && midi.outputs.length === 0 ? (
            <p className="text-xs text-[#7a9abf] text-center py-3">
              {midi.granted ? "No MIDI devices detected. Connect a controller and click Refresh." : "Click Connect MIDI to scan for devices."}
            </p>
          ) : (
            <div className="space-y-2">
              {/* Input select */}
              {midi.inputs.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#7a9abf] uppercase block mb-1">Input Device</label>
                  <select
                    value={midi.activeInputId ?? ""}
                    onChange={e => midi.setActiveInputId(e.target.value || null)}
                    className="w-full text-xs rounded-lg border border-[#cdd8e8] px-2 py-1.5 bg-[#f7fafd] text-[#1a2a3a] focus:outline-none focus:border-sky-400"
                  >
                    {midi.inputs.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.manufacturer ? `(${d.manufacturer})` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {midi.inputs.map(d => (
                      <span key={d.id} className="text-[10px] text-[#7a9abf] flex items-center">
                        {statusBadge(d.state)}{d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Output select */}
              {midi.outputs.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#7a9abf] uppercase block mb-1">Output Device (LEDs / motorised faders)</label>
                  <select
                    value={midi.activeOutputId ?? ""}
                    onChange={e => midi.setActiveOutputId(e.target.value || null)}
                    className="w-full text-xs rounded-lg border border-[#cdd8e8] px-2 py-1.5 bg-[#f7fafd] text-[#1a2a3a] focus:outline-none focus:border-sky-400"
                  >
                    {midi.outputs.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.manufacturer ? `(${d.manufacturer})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Preset ──────────────────────────────────────────────────────────── */}
        <Section title="Controller Preset" icon={<List className="w-3.5 h-3.5" />}>
          <div className="space-y-2">
            <select
              value={midi.activePreset}
              onChange={e => midi.setActivePreset(e.target.value)}
              className="w-full text-xs rounded-lg border border-[#cdd8e8] px-2 py-1.5 bg-[#f7fafd] text-[#1a2a3a] focus:outline-none focus:border-sky-400"
            >
              {MIDI_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="text-[10px] text-[#7a9abf]">
              Supported: {activePresetData.models.join(" · ")}
            </div>
          </div>
        </Section>

        {/* ── CC Mapping table ─────────────────────────────────────────────────── */}
        <Section title={`CC Mappings (${allMappings.length})`} icon={<Zap className="w-3.5 h-3.5" />} defaultOpen={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-[#7a9abf] border-b border-[#e8eef5]">
                  <th className="text-left pb-1 pr-2">Action</th>
                  <th className="text-center pb-1 px-1">Ch</th>
                  <th className="text-center pb-1 px-1">CC</th>
                  <th className="text-center pb-1 px-1">Inv</th>
                  <th className="text-left pb-1 pl-1">Source</th>
                  <th className="pb-1" />
                </tr>
              </thead>
              <tbody>
                {allMappings.map((m, i) => {
                  const isCustom = (m as CCMapping & { _isCustom: boolean })._isCustom;
                  return (
                    <tr key={i} className={`border-b border-[#f0f4f8] ${isCustom ? "bg-sky-50" : ""}`}>
                      <td className="py-0.5 pr-2 font-mono text-[#1a2a3a]">{m.action}</td>
                      <td className="py-0.5 px-1 text-center text-[#4a6580]">{m.channel}</td>
                      <td className="py-0.5 px-1 text-center text-[#4a6580]">{m.cc}</td>
                      <td className="py-0.5 px-1 text-center">{m.invert ? "✓" : ""}</td>
                      <td className="py-0.5 pl-1">
                        {isCustom
                          ? <span className="bg-sky-100 text-sky-600 rounded px-1 font-semibold">custom</span>
                          : <span className="text-[#7a9abf]">preset</span>}
                      </td>
                      <td className="py-0.5">
                        {isCustom && (
                          <button onClick={() => midi.removeCustomMapping(m.action)} className="text-red-400 hover:text-red-600 p-0.5">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add custom mapping */}
          <div className="mt-3 border-t border-[#e8eef5] pt-3 space-y-2">
            <p className="text-[10px] font-semibold text-[#7a9abf] uppercase">Add Custom Mapping</p>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                placeholder="action (e.g. deck_a_play)"
                value={mapAction}
                onChange={e => setMapAction(e.target.value)}
                className="col-span-2 text-[11px] rounded-lg border border-[#cdd8e8] px-2 py-1 bg-[#f7fafd] focus:outline-none focus:border-sky-400"
              />
              <div className="flex gap-1">
                <input type="number" min={1} max={16} value={mapChannel}
                  onChange={e => setMapChannel(Number(e.target.value))}
                  className="w-full text-[11px] rounded-lg border border-[#cdd8e8] px-2 py-1 bg-[#f7fafd] focus:outline-none focus:border-sky-400"
                  placeholder="Ch" />
                <input type="number" min={0} max={127} value={mapCC}
                  onChange={e => setMapCC(Number(e.target.value))}
                  className="w-full text-[11px] rounded-lg border border-[#cdd8e8] px-2 py-1 bg-[#f7fafd] focus:outline-none focus:border-sky-400"
                  placeholder="CC" />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[#4a6580] cursor-pointer">
                <input type="checkbox" checked={mapInvert} onChange={e => setMapInvert(e.target.checked)} className="rounded" />
                Invert value
              </label>
            </div>
            <button
              onClick={addMapping}
              disabled={!mapAction.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 rounded-lg text-[11px] font-bold text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Mapping
            </button>
          </div>
        </Section>

        {/* ── Test CC sender ───────────────────────────────────────────────────── */}
        <Section title="Send Test CC / LED" icon={<Zap className="w-3.5 h-3.5" />} defaultOpen={false}>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Ch", val: testCh, set: setTestCh, min: 1, max: 16 },
                { label: "CC", val: testCC, set: setTestCC, min: 0, max: 127 },
                { label: "Val", val: testVal, set: setTestVal, min: 0, max: 127 },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] text-[#7a9abf] block mb-0.5">{f.label}</label>
                  <input type="number" min={f.min} max={f.max} value={f.val}
                    onChange={e => f.set(Number(e.target.value))}
                    className="w-full text-[11px] rounded-lg border border-[#cdd8e8] px-2 py-1 bg-[#f7fafd] focus:outline-none focus:border-sky-400" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => midi.sendCC(testCh, testCC, testVal)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 rounded-lg text-[11px] font-bold text-white transition-colors"
              >
                <Zap className="w-3 h-3" /> Send CC
              </button>
              <button
                onClick={() => midi.sendLED(testCh, testCC, true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-[11px] font-bold text-white transition-colors"
              >
                LED On
              </button>
              <button
                onClick={() => midi.sendLED(testCh, testCC, false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-[11px] font-bold text-white transition-colors"
              >
                LED Off
              </button>
            </div>
          </div>
        </Section>

        {/* ── Live message log ─────────────────────────────────────────────────── */}
        <Section title={`Message Log (${midi.recentMessages.length})`} icon={<Terminal className="w-3.5 h-3.5" />} defaultOpen={false}>
          {midi.recentMessages.length === 0 ? (
            <p className="text-[11px] text-[#7a9abf] text-center py-3">
              {midi.granted ? "No messages received yet. Move a fader or press a pad." : "Connect MIDI to start logging."}
            </p>
          ) : (
            <div className="space-y-0.5 font-mono max-h-56 overflow-y-auto pr-1">
              {midi.recentMessages.map((m, i) => (
                <div key={i} className="text-[10px] flex gap-2 items-baseline py-0.5 border-b border-[#f0f4f8]">
                  <span className={`font-bold w-14 flex-shrink-0 ${
                    m.type === "cc" ? "text-sky-500" :
                    m.type === "note_on" ? "text-green-500" :
                    m.type === "note_off" ? "text-red-400" :
                    "text-purple-500"
                  }`}>{m.type.toUpperCase()}</span>
                  <span className="text-[#7a9abf]">CH{m.channel}</span>
                  {m.cc !== undefined && <span className="text-[#4a6580]">CC{m.cc}</span>}
                  {m.note !== undefined && <span className="text-[#4a6580]">N{m.note}</span>}
                  <span className="text-[#1a2a3a] font-bold">{m.value}</span>
                  <span className="text-[#cdd8e8] ml-auto">
                    {`B0: 0x${hex2(m.raw[0])} 0x${hex2(m.raw[1])} ${m.raw.length > 2 ? `0x${hex2(m.raw[2])}` : ""}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}
