'use client'

import { useState } from 'react'
import useSWR from 'swr'
import type { Channel, Language, Message } from '@/lib/store-legacy'
import { FeaturePhone } from './feature-phone'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const featuredSamples: { label: string; text: string }[] = [
  { label: 'Wet soil', text: 'My soil is very wet right now — what should I do?' },
  { label: 'Soil temp', text: 'What soil temperature do I need to plant corn?' },
]

const moreSamples: { label: string; text: string }[] = [
  { label: 'Yellow corn', text: 'My corn is yellow after all this rain. Is it nitrogen deficiency or just wet feet?' },
  { label: 'Should I replant?', text: 'My stand is about 24–28 plants per 17-foot row. Should I replant?' },
  { label: 'Southern rust', text: 'Is it too late to apply a fungicide for southern rust?' },
  { label: 'Waterhemp', text: 'How do I control waterhemp that keeps escaping my herbicide program?' },
  { label: 'Corn aphids', text: 'Are corn aphids worth spraying for this late in the season?' },
  { label: 'Harvest moisture', text: 'Should I pick 30% moisture corn or wait for it to dry down?' },
  { label: 'Cover crops', text: 'How early do I need to terminate my cover crop before planting corn?' },
  { label: 'Compaction', text: 'My no-till fields are compacted — will spring tillage fix it?' },
  { label: 'Rootworm', text: 'Why is my corn lodging? Did rootworm cause it?' },
]

interface Profile {
  name: string
  phone: string
  state: string
  acres: string
}

function makePhone(name: string) {
  // generate a stable pseudo-phone from the name so each profile gets its own conversation
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return `+1${Math.abs(h).toString().slice(0, 10).padEnd(10, '0')}`
}

export function FarmerConsole() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ name: '', state: 'Iowa', acres: '' })
  const [formError, setFormError] = useState('')

  const phone = profile ? makePhone(profile.name + profile.state) : ''
  const language: Language = 'en'

  const [pending, setPending] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)

  const { data, mutate } = useSWR<{ messages: Message[] }>(
    profile ? `/api/conversations?phone=${encodeURIComponent(phone)}` : null,
    fetcher,
    { refreshInterval: 4000 },
  )
  const messages = data?.messages ?? []

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Please enter your name.'); return }
    setFormError('')
    setProfile({ name: form.name.trim(), phone, state: form.state, acres: form.acres })
  }

  async function send(channel: Channel, init: RequestInit & { path: string }) {
    setPending(channel)
    setError(null)
    try {
      const res = await fetch(init.path, init)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Request failed')
      await mutate()
      return json as { reply: string }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      return null
    } finally {
      setPending(null)
    }
  }

  const sendSms = (text: string) => {
    // Pass last Q&A pair so server can handle follow-up questions correctly
    const outMsgs = messages.filter((m) => m.direction === 'out' && m.text)
    const inMsgs = messages.filter((m) => m.direction === 'in' && m.text)
    const prevAnswer = outMsgs[outMsgs.length - 1]?.text ?? ''
    const prevQuestion = inMsgs[inMsgs.length - 1]?.text ?? ''
    return send('sms', {
      path: '/api/channels/sms',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, text, language, prevQuestion, prevAnswer }),
    })
  }

  const sendVoice = (transcript: string) => {
    const outMsgs = messages.filter((m) => m.direction === 'out' && m.text)
    const inMsgs = messages.filter((m) => m.direction === 'in' && m.text)
    const prevAnswer = outMsgs[outMsgs.length - 1]?.text ?? ''
    const prevQuestion = inMsgs[inMsgs.length - 1]?.text ?? ''
    return send('voice', {
      path: '/api/channels/voice',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, transcript, language, prevQuestion, prevAnswer }),
    })
  }

  const sendPhoto = (file: File, caption: string) => {
    const form = new FormData()
    form.set('phone', phone)
    form.set('image', file)
    form.set('caption', caption)
    form.set('language', language)
    return send('photo', { path: '/api/channels/photo', method: 'POST', body: form })
  }

  const sendUssd = async (text: string): Promise<{ reply: string } | null> => {
    setPending('sms')
    setError(null)
    try {
      const f = new URLSearchParams()
      f.set('phoneNumber', phone)
      f.set('text', text)
      f.set('language', language)
      f.set('sessionId', `web_${phone}_${Date.now()}`)
      const res = await fetch('/api/channels/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: f.toString(),
      })
      const reply = await res.text()
      await mutate()
      return { reply: reply.replace(/^(CON|END)\s*/, '') }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      return null
    } finally {
      setPending(null)
    }
  }

  // ── Profile creation screen ──────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="mx-auto max-w-md mt-12 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Welcome to Harvest IQ</h1>
          <p className="text-muted-foreground text-sm">
            Your free corn advisory assistant. Ask any question about your crop and get a plain-English answer backed by research.
          </p>
        </div>
        <form onSubmit={handleCreate} className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <h2 className="font-medium text-base">Create your profile</h2>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="name">Your name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. John Smith"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="state">State</label>
            <select
              id="state"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {['Iowa','Illinois','Indiana','Minnesota','Nebraska','Ohio','South Dakota','Wisconsin'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="acres">Acres farmed <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              id="acres"
              type="number"
              placeholder="e.g. 500"
              value={form.acres}
              onChange={(e) => setForm((f) => ({ ...f, acres: e.target.value }))}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start asking questions →
          </button>
        </form>
      </div>
    )
  }

  // ── Main advisory screen ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {/* Left panel */}
      <section className="flex flex-col gap-5">
        {/* Profile card */}
        <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium">{profile.name}</span>
            <span className="text-xs text-muted-foreground">
              {profile.state}{profile.acres ? ` · ${profile.acres} acres` : ''}
            </span>
          </div>
          <button
            onClick={() => setProfile(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Switch profile
          </button>
        </div>

        {/* Sample questions */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Try a question
          </span>
          <div className="flex flex-wrap gap-2">
            {featuredSamples.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={pending !== null}
                onClick={() => sendSms(s.text)}
                className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
                title={s.text}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="rounded-full border border-dashed bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-primary"
            >
              {showMore ? 'Less ▲' : 'More options ▼'}
            </button>
          </div>
          {showMore && (
            <div className="flex flex-wrap gap-2 pt-1">
              {moreSamples.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => { sendSms(s.text); setShowMore(false) }}
                  className="rounded-full border bg-muted px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
                  title={s.text}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Channel legend */}
        <div className="rounded-lg border bg-card p-3">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
            How it works
          </p>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            <li><strong>Voice</strong> — speak your question, get an answer read back</li>
            <li><strong>Photo</strong> — send a photo of your crop for visual help</li>
            <li>Works on any basic phone, no data needed</li>
          </ul>
        </div>

      </section>

      {/* Phone — always below How it works */}
      <FeaturePhone
        messages={messages}
        pending={pending}
        error={error}
        language={language}
        selectedId={null}
        onSelect={() => {}}
        onSms={sendSms}
        onVoice={sendVoice}
        onPhoto={sendPhoto}
        onUssd={sendUssd}
      />

    </div>
  )
}
