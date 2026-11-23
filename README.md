# 🎵 Perpetual Flow — Wayvue Music Industry Intelligent Agent

**Perpetual Flow** is an AI-powered music industry platform built for DJs, producers, A&R professionals, and artists. It combines professional DJ tooling, video mixing, beat production, streaming, artist discovery, and an intelligent AI agent — all in one unified platform.

---

## 🚀 Live Demo

> Public prototype available at the Cloudflare tunnel URL shared with judges.

---

## 🎛️ Features

### DJ Mode
- Dual audio deck controllers with vinyl platter simulation
- Professional scratch engine (Web Audio API — sawtooth → bandpass filter)
- 3-band EQ + Trim per deck
- Hot Cues (8 per deck), Loop controls (IN/OUT/÷2/×2), Auto-loop by beat count
- Pitch/Tempo fader with ±4/8/16/50% range, Key Lock, TAP BPM, BPM Match
- Crossfader with equal-power curve (no bleed at extremes)
- CUE monitor routing with headphone volume control
- MIDI hardware controller support (Web MIDI API)
- Sample Pads (8 pads, custom audio upload)
- Sound Browser with categorised FX
- Set Builder with flow score and BPM arc
- Autopilot mode — AI manages Deck B and mix timing

### Video Mixer
- Dual YouTube deck controller with live iframe embeds
- Scratch simulation, Hot Cues, Loop, EQ per deck
- Crossfader with transition FX (Echo Out, Low-Pass, Riser, Rewind)
- System audio capture via `getDisplayMedia`
- Sample pads (8 synth sounds)

### Production Studio
- Beat library with BPM/key filtering
- AI beat generation suggestions

### Streaming
- Multi-platform stream player (YouTube, SoundCloud, Deezer)

### A&R Console
- Artist discovery and scouting tools
- AI-powered talent analysis

### Marketplace
- Beat and sample licensing

### AI Agent (IntentBar)
- Floating assistant drawer available across all modes
- Context-aware suggestions per mode (DJ, Production, A&R, etc.)
- Powered by IBM watsonx (Llama 4 Scout)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Audio Engine | Web Audio API (no external libraries) |
| MIDI | Web MIDI API |
| AI | IBM watsonx — Llama 4 Scout 17B |
| State | Zustand + React Context |
| Deployment | Railway / Cloudflare Tunnel |

---

## 🏃 Running Locally

```bash
# Install dependencies
pnpm install

# Add environment variables
cp .env.example .env.local
# Set AI_GATEWAY_API_KEY and AI_BASE_URL in .env.local

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

```env
AI_GATEWAY_API_KEY=your_ibm_watsonx_api_key
AI_BASE_URL=https://us-south.ml.cloud.ibm.com/ml/v1/text/chat
AI_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

---

## 📁 Project Structure

```
app/
  dj/              — DJ Mode page
  video-mixer/     — Video Mixer page
  production/      — Production Studio page
  streaming/       — Streaming page
  anr/             — A&R Console page
  marketplace/     — Marketplace page
  api/             — API routes (AI agent, channels)

components/
  dj/              — DeckController, CrossfaderModule, SamplePad, SoundBrowser,
                     SetBuilder, YouTubeMixPanel, HardwareConnectPanel, MidiEngine
  layout/          — AppShell, ModeBar, IntentBar
  production/      — ProductionStudio, BeatLibrary
  streaming/       — StreamPlayer
  advisor/         — A&R desk

lib/
  store.tsx        — Global state (Zustand)
  types.ts         — Shared TypeScript types
  agent.ts         — AI agent logic
```

---

## 🏆 IBM BeMyApp North America Competition Entry

**Project:** Perpetual Flow — Wayvue Music Industry Intelligent Agent  
**Category:** AI-powered creative tools  
**Built with:** IBM watsonx, Next.js, Web Audio API, Web MIDI API
