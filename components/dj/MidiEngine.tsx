"use client";
/**
 * MidiEngine — Perpetual Flow Web MIDI Bridge
 *
 * Bidirectional MIDI I/O via the Web MIDI API (Chrome/Edge/Opera).
 * - Enumerates all connected MIDI inputs and outputs
 * - Receives CC/Note messages and dispatches them as custom DOM events
 * - Sends CC messages to hardware (motorised faders, RGB pads, LEDs)
 * - Supports preset CC maps for Pioneer, Technics adapters, Reloop, Numark
 *
 * Usage:
 *   const midi = useMidiEngine();
 *   midi.sendCC(channel, cc, value);
 *   useMidiEvent("cc", (e) => { ... e.detail.cc, e.detail.value ... });
 */

import {
  createContext, useContext, useEffect, useState, useRef,
  useCallback, type ReactNode
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MidiDevice { id: string; name: string; manufacturer: string; type: "input" | "output"; state: "connected" | "disconnected"; }
export interface MidiMessage { device: string; type: "cc" | "note_on" | "note_off" | "pitchbend" | "sysex" | "clock"; channel: number; cc?: number; note?: number; value: number; raw: Uint8Array; timestamp: number; }
export interface CCMapping { action: string; channel: number; cc: number; min?: number; max?: number; invert?: boolean; }
export interface MidiPreset { id: string; name: string; manufacturer: string; models: string[]; mappings: CCMapping[]; }

// ── Preset maps ───────────────────────────────────────────────────────────────
// CC actions map to named Perpetual Flow controls
// Any hardware that sends these CCs will control PF automatically
export const MIDI_PRESETS: MidiPreset[] = [
  {
    id: "pioneer_plx",
    name: "Pioneer PLX / DDJ Series",
    manufacturer: "Pioneer DJ",
    models: ["PLX-1000", "DDJ-200", "DDJ-400", "DDJ-800", "DDJ-1000", "DDJ-RR", "DDJ-SR2"],
    mappings: [
      { action: "deck_a_play",       channel: 1, cc: 11  },
      { action: "deck_a_cue",        channel: 1, cc: 12  },
      { action: "deck_a_tempo",      channel: 1, cc: 20, min: 0, max: 127 },
      { action: "deck_a_volume",     channel: 1, cc: 7   },
      { action: "deck_a_eq_hi",      channel: 1, cc: 8   },
      { action: "deck_a_eq_mid",     channel: 1, cc: 9   },
      { action: "deck_a_eq_lo",      channel: 1, cc: 10  },
      { action: "deck_a_scratch",    channel: 1, cc: 25  },
      { action: "deck_a_hotcue_1",   channel: 1, cc: 30  },
      { action: "deck_a_hotcue_2",   channel: 1, cc: 31  },
      { action: "deck_a_hotcue_3",   channel: 1, cc: 32  },
      { action: "deck_a_hotcue_4",   channel: 1, cc: 33  },
      { action: "deck_a_loop_in",    channel: 1, cc: 40  },
      { action: "deck_a_loop_out",   channel: 1, cc: 41  },
      { action: "deck_b_play",       channel: 2, cc: 11  },
      { action: "deck_b_cue",        channel: 2, cc: 12  },
      { action: "deck_b_tempo",      channel: 2, cc: 20  },
      { action: "deck_b_volume",     channel: 2, cc: 7   },
      { action: "deck_b_eq_hi",      channel: 2, cc: 8   },
      { action: "deck_b_eq_mid",     channel: 2, cc: 9   },
      { action: "deck_b_eq_lo",      channel: 2, cc: 10  },
      { action: "deck_b_hotcue_1",   channel: 2, cc: 30  },
      { action: "deck_b_hotcue_2",   channel: 2, cc: 31  },
      { action: "deck_b_hotcue_3",   channel: 2, cc: 32  },
      { action: "deck_b_hotcue_4",   channel: 2, cc: 33  },
      { action: "deck_b_loop_in",    channel: 2, cc: 40  },
      { action: "deck_b_loop_out",   channel: 2, cc: 41  },
      { action: "crossfader",        channel: 1, cc: 1   },
      { action: "master_volume",     channel: 1, cc: 2   },
    ],
  },
  {
    id: "technics_sl1200",
    name: "Technics SL-1200 / SL-1210 (via USB audio adapter)",
    manufacturer: "Technics / Panasonic",
    models: ["SL-1200MK7", "SL-1210MK7", "SL-1200GR", "SL-1200GAE"],
    mappings: [
      // SL-1200 is analogue — MIDI adapter (e.g. Rane TTM) maps pitch slider to CC
      { action: "deck_a_tempo",      channel: 1, cc: 20 },
      { action: "deck_b_tempo",      channel: 2, cc: 20 },
      { action: "deck_a_play",       channel: 1, cc: 11 },
      { action: "deck_b_play",       channel: 2, cc: 11 },
      { action: "crossfader",        channel: 1, cc: 1  },
    ],
  },
  {
    id: "reloop_rp7000",
    name: "Reloop RP-7000 / RP-8000 MK2",
    manufacturer: "Reloop",
    models: ["RP-7000 MK2", "RP-8000 MK2", "Terminal Mix 4", "Mixon 8 Pro"],
    mappings: [
      { action: "deck_a_play",       channel: 1, cc: 11  },
      { action: "deck_a_cue",        channel: 1, cc: 12  },
      { action: "deck_a_tempo",      channel: 1, cc: 20  },
      { action: "deck_a_volume",     channel: 1, cc: 7   },
      { action: "deck_a_eq_hi",      channel: 1, cc: 8   },
      { action: "deck_a_eq_mid",     channel: 1, cc: 9   },
      { action: "deck_a_eq_lo",      channel: 1, cc: 10  },
      { action: "deck_a_hotcue_1",   channel: 1, cc: 30  },
      { action: "deck_a_hotcue_2",   channel: 1, cc: 31  },
      { action: "deck_a_hotcue_3",   channel: 1, cc: 32  },
      { action: "deck_a_hotcue_4",   channel: 1, cc: 33  },
      { action: "deck_a_loop_in",    channel: 1, cc: 40  },
      { action: "deck_a_loop_out",   channel: 1, cc: 41  },
      { action: "deck_b_play",       channel: 2, cc: 11  },
      { action: "deck_b_cue",        channel: 2, cc: 12  },
      { action: "deck_b_tempo",      channel: 2, cc: 20  },
      { action: "deck_b_volume",     channel: 2, cc: 7   },
      { action: "deck_b_eq_hi",      channel: 2, cc: 8   },
      { action: "deck_b_eq_mid",     channel: 2, cc: 9   },
      { action: "deck_b_eq_lo",      channel: 2, cc: 10  },
      { action: "deck_b_hotcue_1",   channel: 2, cc: 30  },
      { action: "deck_b_hotcue_2",   channel: 2, cc: 31  },
      { action: "deck_b_hotcue_3",   channel: 2, cc: 32  },
      { action: "deck_b_hotcue_4",   channel: 2, cc: 33  },
      { action: "crossfader",        channel: 1, cc: 1   },
      { action: "master_volume",     channel: 1, cc: 2   },
    ],
  },
  {
    id: "numark_pt01",
    name: "Numark PT01 Scratch / NS7",
    manufacturer: "Numark",
    models: ["PT01 Scratch", "NS7III", "V7", "Mixtrack Pro FX"],
    mappings: [
      { action: "deck_a_play",       channel: 1, cc: 11 },
      { action: "deck_a_tempo",      channel: 1, cc: 20 },
      { action: "deck_a_volume",     channel: 1, cc: 7  },
      { action: "deck_a_eq_hi",      channel: 1, cc: 8  },
      { action: "deck_a_eq_mid",     channel: 1, cc: 9  },
      { action: "deck_a_eq_lo",      channel: 1, cc: 10 },
      { action: "deck_b_play",       channel: 2, cc: 11 },
      { action: "deck_b_tempo",      channel: 2, cc: 20 },
      { action: "deck_b_volume",     channel: 2, cc: 7  },
      { action: "deck_b_eq_hi",      channel: 2, cc: 8  },
      { action: "deck_b_eq_mid",     channel: 2, cc: 9  },
      { action: "deck_b_eq_lo",      channel: 2, cc: 10 },
      { action: "crossfader",        channel: 1, cc: 1  },
    ],
  },
  {
    id: "akai_apc",
    name: "Akai APC / MPC (pads to hot cues)",
    manufacturer: "Akai Professional",
    models: ["APC40 Mk2", "APC Key 25", "MPC Live", "MPC One"],
    mappings: [
      { action: "deck_a_hotcue_1",   channel: 1, cc: 30 },
      { action: "deck_a_hotcue_2",   channel: 1, cc: 31 },
      { action: "deck_a_hotcue_3",   channel: 1, cc: 32 },
      { action: "deck_a_hotcue_4",   channel: 1, cc: 33 },
      { action: "deck_a_hotcue_5",   channel: 1, cc: 34 },
      { action: "deck_a_hotcue_6",   channel: 1, cc: 35 },
      { action: "deck_a_hotcue_7",   channel: 1, cc: 36 },
      { action: "deck_a_hotcue_8",   channel: 1, cc: 37 },
      { action: "deck_b_hotcue_1",   channel: 2, cc: 30 },
      { action: "deck_b_hotcue_2",   channel: 2, cc: 31 },
      { action: "deck_b_hotcue_3",   channel: 2, cc: 32 },
      { action: "deck_b_hotcue_4",   channel: 2, cc: 33 },
      { action: "deck_a_loop_in",    channel: 1, cc: 40 },
      { action: "deck_a_loop_out",   channel: 1, cc: 41 },
      { action: "deck_b_loop_in",    channel: 2, cc: 40 },
      { action: "deck_b_loop_out",   channel: 2, cc: 41 },
    ],
  },
  {
    id: "generic",
    name: "Generic MIDI Controller",
    manufacturer: "Any",
    models: ["Any USB MIDI device"],
    mappings: [
      { action: "crossfader",    channel: 1, cc: 1  },
      { action: "deck_a_volume", channel: 1, cc: 7  },
      { action: "deck_b_volume", channel: 2, cc: 7  },
      { action: "deck_a_play",   channel: 1, cc: 11 },
      { action: "deck_b_play",   channel: 2, cc: 11 },
      { action: "deck_a_tempo",  channel: 1, cc: 20 },
      { action: "deck_b_tempo",  channel: 2, cc: 20 },
    ],
  },
];

// ── Custom DOM event for MIDI messages ────────────────────────────────────────
export function dispatchMidiAction(action: string, value: number, raw: MidiMessage) {
  window.dispatchEvent(new CustomEvent("pf_midi_action", { detail: { action, value, raw } }));
}
export function useMidiAction(cb: (action: string, value: number, raw: MidiMessage) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const { action, value, raw } = (e as CustomEvent).detail;
      cb(action, value, raw);
    };
    window.addEventListener("pf_midi_action", handler);
    return () => window.removeEventListener("pf_midi_action", handler);
  }, [cb]);
}

// ── Context ───────────────────────────────────────────────────────────────────
interface MidiEngineCtx {
  supported: boolean;
  granted: boolean;
  requesting: boolean;
  error: string | null;
  inputs: MidiDevice[];
  outputs: MidiDevice[];
  activeInputId: string | null;
  activeOutputId: string | null;
  activePreset: string;
  recentMessages: MidiMessage[];
  setActiveInputId: (id: string | null) => void;
  setActiveOutputId: (id: string | null) => void;
  setActivePreset: (id: string) => void;
  requestAccess: () => Promise<void>;
  sendCC: (channel: number, cc: number, value: number) => void;
  sendNote: (channel: number, note: number, velocity: number, on: boolean) => void;
  sendLED: (channel: number, cc: number, on: boolean) => void;
  customMappings: CCMapping[];
  addCustomMapping: (m: CCMapping) => void;
  removeCustomMapping: (action: string) => void;
}

const MidiEngineContext = createContext<MidiEngineCtx | null>(null);

export function MidiEngineProvider({ children }: { children: ReactNode }) {
  const supported  = typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
  const [granted, setGranted]       = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [inputs, setInputs]         = useState<MidiDevice[]>([]);
  const [outputs, setOutputs]       = useState<MidiDevice[]>([]);
  const [activeInputId,  setActiveInputId]  = useState<string | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [activePreset,   setActivePreset]   = useState("generic");
  const [recentMessages, setRecentMessages] = useState<MidiMessage[]>([]);
  const [customMappings, setCustomMappings] = useState<CCMapping[]>([]);
  const midiAccessRef = useRef<MIDIAccess | null>(null);

  // Build lookup: {channel}:{cc} → action from active preset + custom overrides
  const buildLookup = useCallback((presetId: string, custom: CCMapping[]) => {
    const preset = MIDI_PRESETS.find(p => p.id === presetId) ?? MIDI_PRESETS[MIDI_PRESETS.length - 1];
    const all = [...preset.mappings, ...custom];
    const map: Record<string, CCMapping> = {};
    for (const m of all) map[`${m.channel}:${m.cc}`] = m;
    return map;
  }, []);

  const lookupRef = useRef(buildLookup(activePreset, customMappings));
  useEffect(() => { lookupRef.current = buildLookup(activePreset, customMappings); }, [activePreset, customMappings, buildLookup]);

  // ── Handle incoming MIDI message ────────────────────────────────────────────
  const handleMessage = useCallback((e: MIDIMessageEvent, deviceName: string) => {
    const data = e.data;
    if (!data || data.length < 2) return;
    const status  = data[0];
    const data1   = data[1];
    const data2   = data.length > 2 ? data[2] : 0;
    const channel = (status & 0x0f) + 1;
    const type    = status >> 4;

    let msgType: MidiMessage["type"] = "cc";
    let cc: number | undefined;
    let note: number | undefined;
    let value = data2;

    if (type === 0xb) { msgType = "cc"; cc = data1; }
    else if (type === 0x9) { msgType = "note_on"; note = data1; }
    else if (type === 0x8) { msgType = "note_off"; note = data1; }
    else if (type === 0xe) { msgType = "pitchbend"; value = ((data2 << 7) | data1) - 8192; }
    else if (type === 0xf && data1 === 0xf8) { msgType = "clock"; return; } // ignore clock
    else return;

    const msg: MidiMessage = {
      device: deviceName, type: msgType, channel, cc, note, value,
      raw: new Uint8Array(data), timestamp: e.timeStamp,
    };

    setRecentMessages(prev => [msg, ...prev].slice(0, 24));

    // Map to action
    if (msgType === "cc" && cc !== undefined) {
      const key = `${channel}:${cc}`;
      const mapping = lookupRef.current[key];
      if (mapping) {
        let normalised = value;
        const min = mapping.min ?? 0;
        const max = mapping.max ?? 127;
        normalised = ((value - min) / (max - min)) * 127;
        if (mapping.invert) normalised = 127 - normalised;
        dispatchMidiAction(mapping.action, Math.round(normalised), msg);
      }
    } else if (msgType === "note_on" && note !== undefined) {
      // Map pad notes to hot cue actions
      const padActions: Record<number, string> = {
        36: "deck_a_hotcue_1", 37: "deck_a_hotcue_2", 38: "deck_a_hotcue_3", 39: "deck_a_hotcue_4",
        40: "deck_a_hotcue_5", 41: "deck_a_hotcue_6", 42: "deck_a_hotcue_7", 43: "deck_a_hotcue_8",
        44: "deck_b_hotcue_1", 45: "deck_b_hotcue_2", 46: "deck_b_hotcue_3", 47: "deck_b_hotcue_4",
      };
      const action = padActions[note];
      if (action) dispatchMidiAction(action, value, msg);
    }
  }, []);

  // ── Wire listeners when access granted ─────────────────────────────────────
  const wireListeners = useCallback((access: MIDIAccess) => {
    const ins: MidiDevice[] = [];
    const outs: MidiDevice[] = [];

    access.inputs.forEach(input => {
      ins.push({ id: input.id, name: input.name ?? "Unknown", manufacturer: input.manufacturer ?? "", type: "input", state: input.state as "connected" | "disconnected" });
      input.onmidimessage = (e) => handleMessage(e as MIDIMessageEvent, input.name ?? "Unknown");
    });
    access.outputs.forEach(output => {
      outs.push({ id: output.id, name: output.name ?? "Unknown", manufacturer: output.manufacturer ?? "", type: "output", state: output.state as "connected" | "disconnected" });
    });

    setInputs(ins);
    setOutputs(outs);
    if (ins.length > 0 && !activeInputId)  setActiveInputId(ins[0].id);
    if (outs.length > 0 && !activeOutputId) setActiveOutputId(outs[0].id);

    // Auto-detect preset from device name
    const firstName = ins[0]?.name?.toLowerCase() ?? "";
    for (const preset of MIDI_PRESETS) {
      if (preset.models.some(m => firstName.includes(m.toLowerCase().split(" ")[0]))) {
        setActivePreset(preset.id);
        break;
      }
    }

    access.onstatechange = () => wireListeners(access);
  }, [handleMessage, activeInputId, activeOutputId]);

  // ── Request MIDI access ─────────────────────────────────────────────────────
  const requestAccess = useCallback(async () => {
    if (!supported) { setError("Web MIDI API not supported in this browser. Use Chrome or Edge."); return; }
    setRequesting(true);
    setError(null);
    try {
      const access = await (navigator as Navigator & { requestMIDIAccess: (opts?: { sysex?: boolean }) => Promise<MIDIAccess> })
        .requestMIDIAccess({ sysex: false });
      midiAccessRef.current = access;
      setGranted(true);
      wireListeners(access);
    } catch (err) {
      setError("MIDI access denied. Click 'Allow' in the browser permission prompt.");
    } finally {
      setRequesting(false);
    }
  }, [supported, wireListeners]);

  // ── Send CC ─────────────────────────────────────────────────────────────────
  const sendCC = useCallback((channel: number, cc: number, value: number) => {
    if (!midiAccessRef.current || !activeOutputId) return;
    const output = midiAccessRef.current.outputs.get(activeOutputId);
    if (!output) return;
    output.send([0xb0 | (channel - 1), cc, Math.max(0, Math.min(127, value))]);
  }, [activeOutputId]);

  // ── Send Note ───────────────────────────────────────────────────────────────
  const sendNote = useCallback((channel: number, note: number, velocity: number, on: boolean) => {
    if (!midiAccessRef.current || !activeOutputId) return;
    const output = midiAccessRef.current.outputs.get(activeOutputId);
    if (!output) return;
    output.send([(on ? 0x90 : 0x80) | (channel - 1), note, velocity]);
  }, [activeOutputId]);

  // ── Send LED (CC value 127 = on, 0 = off — standard for most controllers) ──
  const sendLED = useCallback((channel: number, cc: number, on: boolean) => {
    sendCC(channel, cc, on ? 127 : 0);
  }, [sendCC]);

  // ── Custom mapping management ───────────────────────────────────────────────
  const addCustomMapping = useCallback((m: CCMapping) => {
    setCustomMappings(prev => [...prev.filter(x => x.action !== m.action), m]);
  }, []);
  const removeCustomMapping = useCallback((action: string) => {
    setCustomMappings(prev => prev.filter(x => x.action !== action));
  }, []);

  return (
    <MidiEngineContext.Provider value={{
      supported, granted, requesting, error, inputs, outputs,
      activeInputId, activeOutputId, activePreset, recentMessages,
      setActiveInputId, setActiveOutputId, setActivePreset,
      requestAccess, sendCC, sendNote, sendLED,
      customMappings, addCustomMapping, removeCustomMapping,
    }}>
      {children}
    </MidiEngineContext.Provider>
  );
}

export function useMidiEngine(): MidiEngineCtx {
  const ctx = useContext(MidiEngineContext);
  if (!ctx) throw new Error("useMidiEngine must be used within MidiEngineProvider");
  return ctx;
}
