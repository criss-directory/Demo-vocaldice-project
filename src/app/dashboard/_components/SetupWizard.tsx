'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Plus, Trash2, Check, Loader2, Play } from 'lucide-react'

const S = { bg: '#F8FAFC', card: '#FFFFFF', card2: '#F1F5F9', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8', success: '#059669' }

type Doctor = { name: string; spec: string }
type WorkingDay = { active: boolean; open: string; close: string }
type FAQ = { q: string; a: string }

interface WizardData {
  // Step 1
  clinicName: string; address: string; phone: string; specialties: string[]
  // Step 2
  doctors: Doctor[]
  hours: Record<string, WorkingDay>
  slotDuration: number // in minutes
  // Step 3
  agentName: string
  primaryLanguage: string      // 'te' | 'kn' | 'ta' | 'ml' | 'hi' | 'en'
  primaryVoiceId: string       // Cartesia UUID
  primaryVoiceName: string
  secondaryLanguage: string    // '' if none
  secondaryVoiceId: string
  secondaryVoiceName: string
  ambientNoise: boolean; useCases: string[]
  // Step 4
  faqs: FAQ[]
}

// ── AM/PM Time Picker ────────────────────────────────────────────────────────
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // value is 'HH:MM' 24h format
  const toAmPm = (h: number) => h === 0 ? 12 : h > 12 ? h - 12 : h
  const parts = value.split(':').map(Number)
  const hour24 = parts[0] || 9
  const minute = parts[1] || 0
  const ampm = hour24 < 12 ? 'AM' : 'PM'
  const displayHour = toAmPm(hour24)

  const hours = [12,1,2,3,4,5,6,7,8,9,10,11]
  const minutes = [0,15,30,45]

  const commit = (h12: number, m: number, ap: string) => {
    let h24 = h12 % 12
    if (ap === 'PM') h24 += 12
    onChange(`${String(h24).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Hour scroll */}
      <select
        value={displayHour}
        onChange={e => commit(Number(e.target.value), minute, ampm)}
        style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: '5px 6px', fontSize: 13, color: S.text, outline: 'none', cursor: 'pointer' }}
      >
        {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}</option>)}
      </select>
      <span style={{ color: S.text3, fontWeight: 700 }}>:</span>
      {/* Minute scroll */}
      <select
        value={minute}
        onChange={e => commit(displayHour, Number(e.target.value), ampm)}
        style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 7, padding: '5px 6px', fontSize: 13, color: S.text, outline: 'none', cursor: 'pointer' }}
      >
        {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
      </select>
      {/* AM/PM toggle */}
      <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: `1px solid ${S.border}` }}>
        {(['AM','PM'] as const).map(ap => (
          <button key={ap} type="button" onClick={() => commit(displayHour, minute, ap)}
            style={{ padding: '5px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: ampm === ap ? S.accent : S.bg,
              color: ampm === ap ? '#fff' : S.text2 }}>
            {ap}
          </button>
        ))}
      </div>
    </div>
  )
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const USE_CASES = ['Appointment Booking', 'Enquiry Handling']

const PRESET_LANGS = [
  { code: 'te', name: 'Telugu',    preset: 'telugu_v1' },
  { code: 'kn', name: 'Kannada',   preset: 'kannada_v1' },
  { code: 'ta', name: 'Tamil',     preset: 'tamil_v1' },
  { code: 'ml', name: 'Malayalam', preset: 'malayalam_v1' },
  { code: 'hi', name: 'Hindi',     preset: 'hindi_v1' },
  { code: 'en', name: 'English',   preset: 'english_in_v1' },
]

interface CartesiaVoice {
  id: string
  name: string
  description: string
  language: string
  gender: string            // 'feminine' | 'masculine' | 'gender_neutral'
  preview_file_url: string | null
  provider: string
}

const inputStyle: React.CSSProperties = { width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: S.text, outline: 'none' }

function buildSystemPrompt(d: WizardData): string {
  const drs = d.doctors.map(dr => `${dr.name} (${dr.spec})`).join(', ') || 'our doctors'
  const hrs = DAYS.filter(day => d.hours[day]?.active).map(day => `${day}: ${d.hours[day].open}–${d.hours[day].close}`).join(', ') || 'standard hours'
  const faqBlock = d.faqs.map((f, i) => `${i + 1}. Q: ${f.q} A: ${f.a}`).join('\n')
  const primaryName = PRESET_LANGS.find(l => l.code === d.primaryLanguage)?.name || 'Telugu'
  const secondaryName = d.secondaryLanguage ? PRESET_LANGS.find(l => l.code === d.secondaryLanguage)?.name : null
  const langs = secondaryName ? `${primaryName}, ${secondaryName}, and English` : `${primaryName} and English`

  return `You are ${d.agentName}, an AI receptionist for ${d.clinicName} located at ${d.address}. You speak fluently in ${langs} — always respond in the same language the patient uses. Your clinic specializes in ${d.specialties.join(', ')}. The doctors available are ${drs}. Working hours are ${hrs}. You help patients with: ${d.useCases.join(', ')}. When booking appointments, collect the patient's name, preferred doctor, and preferred time slot, then confirm the booking. Common FAQs:\n${faqBlock}\nKeep responses short and conversational. If the clinic is closed, capture the patient's name and phone number and assure them someone will call back first thing in the morning.`
}

export default function SetupWizard({ onClose, clinicName = '', userEmail = '' }: { onClose: () => void; clinicName?: string; userEmail?: string }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [progress, setProgress] = useState(0)

  const defaultHours = Object.fromEntries(DAYS.map(d => [d, { active: d !== 'Sunday', open: '09:00', close: '18:00' }]))

  const [customSlot, setCustomSlot] = useState('')

  const [data, setData] = useState<WizardData>({
    clinicName: clinicName,
    address: '', phone: '', specialties: [],
    doctors: [{ name: '', spec: '' }],
    hours: defaultHours,
    slotDuration: 30,
    agentName: 'Priya',
    primaryLanguage: '', primaryVoiceId: '', primaryVoiceName: '',
    secondaryLanguage: '', secondaryVoiceId: '', secondaryVoiceName: '',
    ambientNoise: false,
    useCases: ['Appointment Booking', 'Enquiry Handling'],
    faqs: [
      { q: 'What are your working hours?', a: '' },
      { q: 'Where are you located?', a: '' },
      { q: 'How do I book an appointment?', a: 'You can call us or speak to our AI receptionist Priya.' },
    ],
  })

  // Voice picker state
  const [primaryVoices, setPrimaryVoices] = useState<CartesiaVoice[]>([])
  const [loadingPrimary, setLoadingPrimary] = useState(false)
  const [secondaryVoices, setSecondaryVoices] = useState<CartesiaVoice[]>([])
  const [loadingSecondary, setLoadingSecondary] = useState(false)
  const [step3Error, setStep3Error] = useState('')
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch Cartesia voices when entering step 3 or changing primary language
  useEffect(() => {
    if (step !== 3 || !data.primaryLanguage) return
    setLoadingPrimary(true)
    setPrimaryVoices([])
    fetch(`/api/voices?language=${data.primaryLanguage}`)
      .then(r => r.json())
      .then(d => setPrimaryVoices((d.voices || []).filter((v: CartesiaVoice) => v.provider === 'cartesia')))
      .catch(() => {})
      .finally(() => setLoadingPrimary(false))
  }, [step, data.primaryLanguage])

  useEffect(() => {
    if (step !== 3 || !data.secondaryLanguage) return
    setLoadingSecondary(true)
    setSecondaryVoices([])
    fetch(`/api/voices?language=${data.secondaryLanguage}`)
      .then(r => r.json())
      .then(d => setSecondaryVoices((d.voices || []).filter((v: CartesiaVoice) => v.provider === 'cartesia')))
      .catch(() => {})
      .finally(() => setLoadingSecondary(false))
  }, [step, data.secondaryLanguage])

  // Auto-fill FAQ answers from earlier steps
  useEffect(() => {
    setData(prev => ({
      ...prev,
      faqs: prev.faqs.map(f => {
        if (f.q === 'What are your working hours?') {
          const hrs = DAYS.filter(d => prev.hours[d]?.active).map(d => `${d}: ${prev.hours[d].open}–${prev.hours[d].close}`).join(', ')
          return { ...f, a: hrs || f.a }
        }
        if (f.q === 'Where are you located?') return { ...f, a: prev.address || f.a }
        return f
      })
    }))
  }, [data.hours, data.address])

  const sys = buildSystemPrompt(data)

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) { setData(prev => ({ ...prev, [k]: v })) }

  function toggleList(key: 'specialties' | 'useCases', val: string) {
    const arr = data[key] as string[]
    set(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function setDoctor(i: number, field: keyof Doctor, val: string) {
    const docs = [...data.doctors]; docs[i] = { ...docs[i], [field]: val }; set('doctors', docs)
  }
  function addDoctor() { if (data.doctors.length < 10) set('doctors', [...data.doctors, { name: '', spec: '' }]) }
  function removeDoctor(i: number) { set('doctors', data.doctors.filter((_, idx) => idx !== i)) }

  function setHour(day: string, field: keyof WorkingDay, val: string | boolean) {
    set('hours', { ...data.hours, [day]: { ...data.hours[day], [field]: val } })
  }

  function setFaq(i: number, field: keyof FAQ, val: string) {
    const faqs = [...data.faqs]; faqs[i] = { ...faqs[i], [field]: val }; set('faqs', faqs)
  }
  function addFaq() { if (data.faqs.length < 10) set('faqs', [...data.faqs, { q: '', a: '' }]) }
  function removeFaq(i: number) { set('faqs', data.faqs.filter((_, idx) => idx !== i)) }

  async function finishWizard() {
    setSaving(true)
    // Animate progress bar
    let p = 0
    const interval = setInterval(() => { p += 3; setProgress(Math.min(p, 100)); if (p >= 100) clearInterval(interval) }, 45)

    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const languages = [data.primaryLanguage, data.secondaryLanguage].filter(Boolean)
        await supabase.from('agents').upsert({
          user_id: session.user.id,
          agent_name: data.agentName,
          // Voice — saved to legacy columns for backward compat; preset columns populated after migration
          voice_id: data.primaryVoiceId || null,
          voice_name: data.primaryVoiceName || null,
          languages,
          primary_language: data.primaryLanguage,
          specialties: data.specialties,
          doctors: data.doctors, working_hours: data.hours,
          faqs: data.faqs, system_prompt: sys, status: 'active',
          slot_duration_minutes: data.slotDuration,
        }, { onConflict: 'user_id' })
      }
    } catch (_) { /* non-fatal */ }

    setTimeout(() => { setSaving(false); setDone(true) }, 3200)
  }

  const Tag = ({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: active ? 'rgba(47,128,237,0.15)' : 'transparent', border: `1px solid ${active ? 'rgba(47,128,237,0.5)' : S.border}`, color: active ? S.accent : S.text2, transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  const TOTAL = 4

  // ── STEP RENDERS ──────────────────────────────────────────────────────────────
  const renderStep = () => {
    if (done) return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Check size={30} color={S.success} />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: S.text, marginBottom: '6px' }}>✅ Your AI Receptionist {data.agentName} is Ready!</h2>
        <p style={{ color: S.text2, fontSize: '14px', marginBottom: '24px' }}>Here&apos;s the exact prompt powering your agent:</p>
        <textarea readOnly value={sys} rows={8} style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px', fontSize: '12px', color: S.text2, resize: 'none', fontFamily: 'monospace', lineHeight: 1.6, marginBottom: '20px' }} />
        <div style={{ background: 'rgba(47,128,237,0.08)', border: '1px solid rgba(47,128,237,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '22px', textAlign: 'left', fontSize: '13px', color: S.text2 }}>
          💡 To go live, attach a virtual phone number in the <strong style={{ color: S.text }}>Phone Numbers</strong> section. Need help? Contact us — we respond within 30 minutes.
        </div>
        <button onClick={onClose} style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '13px 30px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 0 20px rgba(47,128,237,0.3)' }}>Go to Dashboard</button>
      </div>
    )

    if (saving) return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Loader2 size={40} color={S.accent} style={{ animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: S.text, marginBottom: '10px' }}>Creating Your AI Receptionist...</h2>
        <p style={{ color: S.text2, fontSize: '14px', marginBottom: '24px' }}>Building a custom AI receptionist just for {data.clinicName}</p>
        <div style={{ background: S.card2, borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: S.accent, borderRadius: '100px', transition: 'width 0.1s' }} />
        </div>
        <p style={{ color: S.text3, fontSize: '12px', marginTop: '10px' }}>{progress}%</p>
      </div>
    )

    if (step === 1) return (
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: S.text, marginBottom: '6px' }}>Clinic Details</h2>
        <p style={{ color: S.text2, fontSize: '13px', marginBottom: '22px' }}>Tell us about your clinic so your agent can answer accurately.</p>
        {[
          { label: 'Clinic Name', key: 'clinicName', placeholder: 'Sunshine Medical Centre' },
          { label: 'Clinic Address', key: 'address', placeholder: '12 MG Road, Banjara Hills, Hyderabad' },
          { label: 'Clinic Phone', key: 'phone', placeholder: '+91 98765 43210' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</label>
            <input value={data[f.key as 'clinicName' | 'address' | 'phone']} onChange={e => set(f.key as 'clinicName', e.target.value)} placeholder={f.placeholder}
              style={inputStyle} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Specialties</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {['General', 'Dental', 'Ortho', 'Cardiology', 'Pediatrics', 'Gynecology', 'ENT', 'Skin', 'Eye'].map(s => (
              <Tag key={s} label={s} active={data.specialties.includes(s)} onToggle={() => toggleList('specialties', s)} />
            ))}
          </div>
        </div>
      </div>
    )

    if (step === 2) return (
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: S.text, marginBottom: '6px' }}>Doctors & Hours</h2>
        <p style={{ color: S.text2, fontSize: '13px', marginBottom: '20px' }}>Add your doctors and set working hours for each day.</p>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ color: S.text2, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Doctors (up to 10)</label>
            <button onClick={addDoctor} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(47,128,237,0.1)', border: '1px solid rgba(47,128,237,0.3)', color: S.accent, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}><Plus size={13} /> Add</button>
          </div>
          {data.doctors.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <input value={d.name} onChange={e => setDoctor(i, 'name', e.target.value)} placeholder="Dr. Ramesh Kumar"
                style={{ ...inputStyle, flex: 1 }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
              <input value={d.spec} onChange={e => setDoctor(i, 'spec', e.target.value)} placeholder="Specialization"
                style={{ ...inputStyle, flex: 1 }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
              {data.doctors.length > 1 && <button onClick={() => removeDoctor(i)} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer' }}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>

        <div>
          <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Working Hours</label>
          {DAYS.map(day => (
            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '8px 0', borderBottom: `1px solid ${S.card2}` }}>
              <button onClick={() => setHour(day, 'active', !data.hours[day].active)} style={{ width: '36px', height: '20px', borderRadius: '100px', background: data.hours[day].active ? S.accent : S.border, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: '2px', left: data.hours[day].active ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
              <span style={{ width: '50px', fontSize: '13px', color: data.hours[day].active ? S.text : S.text3, fontWeight: 500 }}>{day.substring(0, 3)}</span>
              {data.hours[day].active ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <TimePicker value={data.hours[day].open} onChange={v => setHour(day, 'open', v)} />
                  <span style={{ color: S.text3, fontSize: '12px' }}>to</span>
                  <TimePicker value={data.hours[day].close} onChange={v => setHour(day, 'close', v)} />
                </div>
              ) : <span style={{ fontSize: '12px', color: S.text3 }}>Closed</span>}
            </div>
          ))}
        </div>

        {/* Slot Duration */}
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Appointment Slot Duration</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[{ label: '15 min', val: 15 }, { label: '30 min', val: 30 }, { label: '1 hr', val: 60 }].map(opt => (
              <button key={opt.val} type="button"
                onClick={() => { set('slotDuration', opt.val); setCustomSlot('') }}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${data.slotDuration === opt.val && !customSlot ? S.accent : S.border}`,
                  background: data.slotDuration === opt.val && !customSlot ? 'rgba(8,145,178,0.1)' : 'transparent',
                  color: data.slotDuration === opt.val && !customSlot ? S.accent : S.text2,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {opt.label}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button"
                onClick={() => { setCustomSlot(customSlot || String(data.slotDuration)) }}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${customSlot ? S.accent : S.border}`,
                  background: customSlot ? 'rgba(8,145,178,0.1)' : 'transparent',
                  color: customSlot ? S.accent : S.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Custom
              </button>
              {customSlot && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min={5} max={240} value={customSlot}
                    onChange={e => { setCustomSlot(e.target.value); if (Number(e.target.value) > 0) set('slotDuration', Number(e.target.value)) }}
                    style={{ width: 60, background: S.bg, border: `1px solid ${S.accent}`, borderRadius: 7, padding: '6px 8px', fontSize: 13, color: S.text, outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: 12, color: S.text2 }}>min</span>
                </div>
              )}
            </div>
          </div>
          <p style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>The AI will block this duration for each booked appointment slot.</p>
        </div>
      </div>
    )

    // ── Voice Card sub-component (inline) ────────────────────────────────────
    const VoiceCard = ({ voice, selected, onSelect, onPreview }: {
      voice: CartesiaVoice; selected: boolean; onSelect: () => void; onPreview: () => void
    }) => {
      const gBadge = voice.gender === 'feminine' ? 'F' : voice.gender === 'masculine' ? 'M' : 'N'
      const gColor = voice.gender === 'feminine' ? '#EC4899' : voice.gender === 'masculine' ? '#3B82F6' : '#6B7280'
      return (
        <div onClick={onSelect} style={{ border: `2px solid ${selected ? S.accent : S.border}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selected ? 'rgba(8,145,178,0.06)' : S.bg, transition: 'all 0.15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: S.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎙 {voice.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: gColor, background: `${gColor}20`, borderRadius: 4, padding: '1px 5px', marginLeft: 4, flexShrink: 0 }}>{gBadge}</span>
          </div>
          <div style={{ fontSize: 11, color: S.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>{voice.description || '—'}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {voice.preview_file_url
              ? <button type="button" onClick={e => { e.stopPropagation(); onPreview() }} style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: 6, padding: '3px 7px', fontSize: 11, color: S.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}><Play size={10} /> Preview</button>
              : <span />}
            {selected && <Check size={14} color={S.accent} />}
          </div>
        </div>
      )
    }

    const playPreview = (voice: CartesiaVoice) => {
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null }
      const audio = new Audio(`/api/voices/${voice.id}/preview`)
      previewAudioRef.current = audio
      audio.play().catch(() => {})
    }

    const labelStyle: React.CSSProperties = { display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }

    const VoiceGrid = ({ voices, loading, selectedId, onSelect, onPreview }: {
      voices: CartesiaVoice[]; loading: boolean; selectedId: string
      onSelect: (v: CartesiaVoice) => void; onPreview: (v: CartesiaVoice) => void
    }) => (
      loading
        ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: S.text3, padding: '10px 0', fontSize: 13 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading voices...</div>
        : voices.length === 0
          ? <div style={{ color: S.text3, fontSize: 13, padding: '10px 0' }}>No voices found</div>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
              {voices.map(v => (
                <VoiceCard key={v.id} voice={v} selected={selectedId === v.id}
                  onSelect={() => onSelect(v)} onPreview={() => onPreview(v)} />
              ))}
            </div>
    )

    if (step === 3) return (
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: S.text, marginBottom: '6px' }}>Voice & Language</h2>
        <p style={{ color: S.text2, fontSize: '13px', marginBottom: '20px' }}>Choose how your agent speaks and in which language.</p>

        {/* Agent Name */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>AGENT NAME *</label>
          <input value={data.agentName} onChange={e => set('agentName', e.target.value)} placeholder="Priya"
            style={inputStyle} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
        </div>

        {/* Primary Language */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>PRIMARY LANGUAGE *</label>
          <select value={data.primaryLanguage}
            onChange={e => { set('primaryLanguage', e.target.value); set('primaryVoiceId', ''); set('primaryVoiceName', '') }}
            style={{ ...inputStyle, cursor: 'pointer', color: data.primaryLanguage ? S.text : S.text3 }}>
            <option value="" disabled>Choose language</option>
            {PRESET_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          {data.primaryLanguage && (
            <div style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>🔒 Sarvam STT · Gemini 2.5 Flash</div>
          )}
          {data.primaryLanguage && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>CHOOSE VOICE</label>
              <VoiceGrid voices={primaryVoices} loading={loadingPrimary} selectedId={data.primaryVoiceId}
                onSelect={v => { set('primaryVoiceId', v.id); set('primaryVoiceName', v.name); setStep3Error('') }}
                onPreview={playPreview} />
            </div>
          )}
        </div>

        {/* Secondary Language */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>SECONDARY LANGUAGE <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
          <select value={data.secondaryLanguage}
            onChange={e => { set('secondaryLanguage', e.target.value); set('secondaryVoiceId', ''); set('secondaryVoiceName', '') }}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">None</option>
            {PRESET_LANGS.filter(l => l.code !== data.primaryLanguage && l.code !== 'en').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          {data.secondaryLanguage && (
            <>
              <div style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>🔒 Sarvam STT · Gemini 2.5 Flash</div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>CHOOSE VOICE</label>
                <VoiceGrid voices={secondaryVoices} loading={loadingSecondary} selectedId={data.secondaryVoiceId}
                  onSelect={v => { set('secondaryVoiceId', v.id); set('secondaryVoiceName', v.name) }}
                  onPreview={playPreview} />
              </div>
            </>
          )}
        </div>

        {/* English Fallback — always fixed */}
        <div style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>English Fallback</span>
            <span style={{ fontSize: 10, background: 'rgba(8,145,178,0.12)', color: S.accent, borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Fixed</span>
          </div>
          <p style={{ fontSize: 12, color: S.text3, margin: 0, lineHeight: 1.5 }}>
            🔒 English is always available as a fallback. When a caller speaks English your agent automatically switches to an English voice — no setup needed.
          </p>
        </div>

        {/* Use Cases */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>USE CASES</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {USE_CASES.map(u => <Tag key={u} label={u} active={data.useCases.includes(u)} onToggle={() => toggleList('useCases', u)} />)}
          </div>
        </div>

        {step3Error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{step3Error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={() => set('ambientNoise', !data.ambientNoise)} style={{ width: '40px', height: '22px', borderRadius: '100px', background: data.ambientNoise ? S.accent : S.border, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: '2px', left: data.ambientNoise ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: '13px', color: S.text2 }}>Background clinic ambient noise</span>
        </div>
      </div>
    )

    if (step === 4) return (
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: S.text, marginBottom: '6px' }}>Frequently Asked Questions</h2>
        <p style={{ color: S.text2, fontSize: '13px', marginBottom: '20px' }}>Add up to 10 FAQ pairs your agent will use to answer patient questions.</p>
        {data.faqs.map((faq, i) => (
          <div key={i} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: S.text3, fontWeight: 600, textTransform: 'uppercase' }}>FAQ {i + 1}</span>
              {data.faqs.length > 1 && <button onClick={() => removeFaq(i)} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer' }}><Trash2 size={13} /></button>}
            </div>
            <input value={faq.q} onChange={e => setFaq(i, 'q', e.target.value)} placeholder="Question..." style={{ ...inputStyle, marginBottom: '8px' }}
              onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            <textarea value={faq.a} onChange={e => setFaq(i, 'a', e.target.value)} placeholder="Answer..." rows={2}
              style={{ ...inputStyle, resize: 'vertical', display: 'block' }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
          </div>
        ))}
        {data.faqs.length < 10 && (
          <button onClick={addFaq} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', border: `1px dashed ${S.border}`, color: S.text2, borderRadius: '10px', padding: '11px 16px', cursor: 'pointer', fontSize: '13px', width: '100%', justifyContent: 'center', transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = S.accent)} onMouseLeave={e => (e.currentTarget.style.borderColor = S.border)}>
            <Plus size={14} /> Add FAQ
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '18px', width: '100%', maxWidth: '600px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        {/* Header */}
        {!saving && !done && (
          <div style={{ padding: '22px 26px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <p style={{ fontSize: '11px', color: S.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>AI Receptionist Setup</p>
                <p style={{ fontSize: '13px', color: S.text3 }}>Step {step} of {TOTAL}</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.text2, cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>
            {/* Progress bar */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '22px' }}>
              {Array.from({ length: TOTAL }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i < step ? S.accent : S.card2, transition: 'background 0.3s' }} />
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: saving || done ? '30px 26px' : '0 26px' }}>
          {renderStep()}
        </div>

        {/* Footer buttons */}
        {!saving && !done && (
          <div style={{ padding: '18px 26px', borderTop: `1px solid ${S.border}`, flexShrink: 0, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: '9px', color: S.text2, cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
              <ChevronLeft size={15} /> {step === 1 ? 'Skip' : 'Back'}
            </button>
            <button onClick={() => {
              if (step === 3 && !data.primaryVoiceId) { setStep3Error('Please select a voice for the primary language'); return }
              setStep3Error('')
              step < TOTAL ? setStep(s => s + 1) : finishWizard()
            }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', background: S.accent, border: 'none', borderRadius: '9px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 700, boxShadow: '0 0 18px rgba(47,128,237,0.3)' }}>
              {step === TOTAL ? 'Create your AI receptionist' : 'Next'} <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
