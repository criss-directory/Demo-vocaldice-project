"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Mic, Check, Loader2, Play, Square } from "lucide-react";

const S = { bg: '#F8FAFC', card: '#FFFFFF', card2: '#F1F5F9', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8', success: '#059669', warning: '#D97706', error: '#DC2626', teal: '#0891B2' }

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (agentId?: string) => void;
}

const PRESET_LANGS = [
  { code: 'te', name: 'Telugu',    preset: 'telugu_v1' },
  { code: 'kn', name: 'Kannada',   preset: 'kannada_v1' },
  { code: 'ta', name: 'Tamil',     preset: 'tamil_v1' },
  { code: 'ml', name: 'Malayalam', preset: 'malayalam_v1' },
  { code: 'hi', name: 'Hindi',     preset: 'hindi_v1' },
  { code: 'en', name: 'English',   preset: 'english_in_v1' },
]

const USE_CASES = [
  { id: "appointment", label: "Appointment Booking", icon: "📅", desc: "Book, reschedule, and cancel appointments" },
  { id: "enquiry",    label: "Enquiry Handling",    icon: "💬", desc: "Answer common questions about your clinic" },
]

const inpStyle: React.CSSProperties = {
  width: '100%', background: S.bg, border: `1px solid ${S.border}`,
  borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: S.text, outline: 'none', boxSizing: 'border-box'
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600,
  marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px'
}

const STEP_LABELS = ['Clinic Info', 'Services & Contact', 'Voice & Language', 'Working Hours', 'Use Cases & FAQs']
const TOTAL_STEPS = 5

export default function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1: Clinic Info
    clinicName: "",
    clinicAddress: "",
    specialization: "",
    doctorNames: [] as string[],
    newDoctorName: "",
    // Step 2: Services & Contact
    services: "",
    appointmentInfo: "",
    emergencyContact: "",
    optionalInfo: "",
    // Step 3: Voice & Languages
    agentName: "",
    primaryLanguage: "",
    primaryVoiceId: "",
    primaryVoiceName: "",
    secondaryLanguage: "",
    secondaryVoiceId: "",
    secondaryVoiceName: "",
    // Step 4: Working Hours
    workingHoursStart: "09:00 AM",
    workingHoursEnd: "06:00 PM",
    // Step 5: Use Cases + FAQs
    selectedUseCases: ["appointment"] as string[],
    faqs: [] as string[],
    customFaq: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [createdAgentId, setCreatedAgentId] = useState<string | undefined>(undefined)
  const [primaryVoices, setPrimaryVoices] = useState<any[]>([])
  const [loadingPrimary, setLoadingPrimary] = useState(false)
  const [secondaryVoices, setSecondaryVoices] = useState<any[]>([])
  const [loadingSecondary, setLoadingSecondary] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Reset everything when the wizard opens so users can create multiple agents
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setFormData({
        clinicName: '', clinicAddress: '', specialization: '',
        doctorNames: [], newDoctorName: '',
        services: '', appointmentInfo: '', emergencyContact: '', optionalInfo: '',
        agentName: '',
        primaryLanguage: 'te', primaryVoiceId: '', primaryVoiceName: '',
        secondaryLanguage: '', secondaryVoiceId: '', secondaryVoiceName: '',
        workingHoursStart: '09:00 AM', workingHoursEnd: '06:00 PM',
        selectedUseCases: ['appointment'], faqs: [], customFaq: '',
      })
      setDone(false)
      setError('')
      setCreatedAgentId(undefined)
      setPrimaryVoices([])
      setSecondaryVoices([])
      setPlayingId(null)
      stopCurrentAudio()

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Fetch Cartesia voices for primary language
  useEffect(() => {
    if (step !== 3 || !formData.primaryLanguage) return
    setLoadingPrimary(true)
    setPrimaryVoices([])
    fetch(`/api/voices?language=${formData.primaryLanguage}`)
      .then(r => r.json())
      .then(d => setPrimaryVoices((d.voices || []).filter((v: any) => v.provider === 'cartesia')))
      .catch(() => {})
      .finally(() => setLoadingPrimary(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formData.primaryLanguage])

  // Fetch Cartesia voices for secondary language
  useEffect(() => {
    if (step !== 3 || !formData.secondaryLanguage) return
    setLoadingSecondary(true)
    setSecondaryVoices([])
    fetch(`/api/voices?language=${formData.secondaryLanguage}`)
      .then(r => r.json())
      .then(d => setSecondaryVoices((d.voices || []).filter((v: any) => v.provider === 'cartesia')))
      .catch(() => {})
      .finally(() => setLoadingSecondary(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formData.secondaryLanguage])

  const stopCurrentAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingId(null)
  }

  const playVoice = (voiceId: string) => {
    stopCurrentAudio()
    if (playingId === voiceId) return  // toggle off
    // All previews go through the proxy — Cartesia preview URLs need auth headers
    const audio = new Audio(`/api/voices/${voiceId}/preview`)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(voiceId)
    audio.play().catch(() => setPlayingId(null))
  }

  const handleAddDoctor = () => {
    if (formData.newDoctorName.trim()) {
      setFormData(prev => ({ ...prev, doctorNames: [...prev.doctorNames, prev.newDoctorName.trim()], newDoctorName: "" }))
    }
  }

  const handleRemoveDoctor = (i: number) => {
    setFormData(prev => ({ ...prev, doctorNames: prev.doctorNames.filter((_, idx) => idx !== i) }))
  }

  const handleAddFaq = () => {
    if (formData.customFaq.trim()) {
      setFormData(prev => ({ ...prev, faqs: [...prev.faqs, prev.customFaq.trim()], customFaq: "" }))
    }
  }

  const handleRemoveFaq = (i: number) => {
    setFormData(prev => ({ ...prev, faqs: prev.faqs.filter((_, idx) => idx !== i) }))
  }

  const canProceed = () => {
    switch (step) {
      case 1: return !!(formData.clinicName.trim() && formData.clinicAddress.trim() && formData.specialization.trim() && formData.doctorNames.length > 0)
      case 2: return !!(formData.services.trim() && formData.appointmentInfo.trim() && formData.emergencyContact.trim())
      case 3: return !!(formData.agentName.trim() && formData.primaryLanguage && formData.primaryVoiceId)
      case 4: return true
      case 5: return true
      default: return false
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const { supabase } = await import("@/lib/supabase")
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Please log in again to continue')
        setIsSubmitting(false)
        return
      }

      const workingHours = `${formData.workingHoursStart} – ${formData.workingHoursEnd}`
      const selectedLanguages = [formData.primaryLanguage, formData.secondaryLanguage].filter(Boolean)

      const apiPayload = {
        clinicName: formData.clinicName,
        agentName: formData.agentName,
        clinicAddress: formData.clinicAddress,
        specialization: formData.specialization,
        doctorNames: formData.doctorNames.join(", "),
        services: formData.services,
        appointmentInfo: formData.appointmentInfo,
        emergencyContact: formData.emergencyContact,
        optionalInfo: formData.optionalInfo,
        workingHours,
        selectedLanguages,
        selectedVoiceId: formData.primaryVoiceId,
        selectedVoiceName: formData.primaryVoiceName,
        selectedUseCases: formData.selectedUseCases,
        faqs: formData.faqs,
      }

      const response = await fetch("/api/agent/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify(apiPayload),
      })

      const data = await response.json()

      if (response.ok) {
        setCreatedAgentId(data.agentId)
        setDone(true)
        setTimeout(() => onComplete(data.agentId), 1000)
      } else {
        setError(data.error || 'Failed to create agent. Please try again.')
      }
    } catch (err) {
      console.error("Failed to create agent:", err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Check size={36} color={S.success} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: S.text, marginBottom: 8 }}>Your AI Agent is Ready!</h2>
        <p style={{ color: S.text2, fontSize: 14, marginBottom: 24 }}>{formData.clinicName} AI Receptionist has been created successfully.</p>
        <button
          onClick={() => onComplete(createdAgentId)}
          style={{
            padding: '12px 28px', background: 'linear-gradient(135deg, #2F80ED, #06b6d4)',
            border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(47,128,237,0.4)', marginBottom: 12,
            display: 'inline-flex', alignItems: 'center', gap: 8
          }}
        >
          🚀 Go to Agent Dashboard
        </button>
        <p style={{ color: S.text3, fontSize: 12, marginTop: 8 }}>Redirecting automatically...</p>
      </div>
    )
    }

    if (isSubmitting) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Loader2 size={48} color={S.accent} style={{ animation: 'spin 1s linear infinite', marginBottom: 20 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 8 }}>Building Your Agent...</h2>
          <p style={{ color: S.text2, fontSize: 14 }}>Generating AI system prompt for {formData.clinicName}</p>
        </div>
      )
    }

    return (
      <>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Clinic Info ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Clinic Information</h3>
              <p style={{ color: S.text2, fontSize: 13 }}>Tell us the basics about your clinic</p>
            </div>

            <div>
              <label style={labelStyle}>Clinic Name *</label>
              <input value={formData.clinicName} onChange={e => setFormData(p => ({ ...p, clinicName: e.target.value }))}
                placeholder="e.g., Sunshine Dental Clinic" style={inpStyle}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>

            <div>
              <label style={labelStyle}>Clinic Address *</label>
              <textarea value={formData.clinicAddress} onChange={e => setFormData(p => ({ ...p, clinicAddress: e.target.value }))}
                placeholder="e.g., 123 MG Road, Near City Hospital, Hyderabad" rows={2}
                style={{ ...inpStyle, resize: 'none' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>

            <div>
              <label style={labelStyle}>Specialization *</label>
              <input value={formData.specialization} onChange={e => setFormData(p => ({ ...p, specialization: e.target.value }))}
                placeholder="e.g., General Medicine, Dental, Orthopedics, Multi-specialty" style={inpStyle}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>

            <div>
              <label style={labelStyle}>Doctors *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: formData.doctorNames.length > 0 ? 10 : 0 }}>
                {formData.doctorNames.map((doc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: S.card2, borderRadius: 8, padding: '8px 12px' }}>
                    <span style={{ color: S.text, fontSize: 14, flex: 1 }}>{doc}</span>
                    <button onClick={() => handleRemoveDoctor(i)} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer', padding: 4, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={formData.newDoctorName} onChange={e => setFormData(p => ({ ...p, newDoctorName: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDoctor() } }}
                  placeholder="e.g., Dr. Priya Sharma" style={{ ...inpStyle, flex: 1 }}
                  onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
                <button onClick={handleAddDoctor} style={{ padding: '0 18px', background: S.accent, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Add</button>
              </div>
              <p style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>Press Enter or click Add to save.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Services & Contact ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Services & Contact</h3>
              <p style={{ color: S.text2, fontSize: 13 }}>What your clinic offers and how patients can reach you</p>
            </div>

            <div>
              <label style={labelStyle}>Services Offered *</label>
              <textarea value={formData.services} onChange={e => setFormData(p => ({ ...p, services: e.target.value }))}
                placeholder="e.g., General consultations, Blood tests, X-rays, Vaccinations, Minor surgeries" rows={3}
                style={{ ...inpStyle, resize: 'none' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>

            <div>
              <label style={labelStyle}>Appointment Process *</label>
              <textarea value={formData.appointmentInfo} onChange={e => setFormData(p => ({ ...p, appointmentInfo: e.target.value }))}
                placeholder="e.g., Appointments can be booked by calling us or walking in. Bring your ID and previous prescriptions. Consultation fee: ₹500." rows={3}
                style={{ ...inpStyle, resize: 'none' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>

            <div>
              <label style={labelStyle}>Emergency Contact *</label>
              <input value={formData.emergencyContact} onChange={e => setFormData(p => ({ ...p, emergencyContact: e.target.value }))}
                placeholder="e.g., +91 98765 43210 (24/7 emergency line)" style={inpStyle}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>

            <div>
              <label style={labelStyle}>Additional Information <span style={{ color: S.text3, fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span></label>
              <textarea value={formData.optionalInfo} onChange={e => setFormData(p => ({ ...p, optionalInfo: e.target.value }))}
                placeholder="e.g., Parking available, Wheelchair accessible, Accepts walk-ins on weekdays..." rows={2}
                style={{ ...inpStyle, resize: 'none' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
            </div>
          </div>
        )}

        {/* ── Step 3: Voice & Languages ── */}
        {step === 3 && (() => {
          const VoiceCard = ({ voice, selected, onSelect }: { voice: any; selected: boolean; onSelect: () => void }) => {
            const gBadge = voice.gender === 'feminine' ? 'F' : voice.gender === 'masculine' ? 'M' : 'N'
            const gColor = voice.gender === 'feminine' ? '#EC4899' : voice.gender === 'masculine' ? '#3B82F6' : '#6B7280'
            const isPlaying = playingId === voice.id
            return (
              <div onClick={onSelect} style={{ border: `2px solid ${selected ? S.accent : S.border}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', background: selected ? 'rgba(8,145,178,0.06)' : S.bg, transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: S.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Mic size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />{voice.name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: gColor, background: `${gColor}20`, borderRadius: 4, padding: '1px 5px', marginLeft: 4, flexShrink: 0 }}>{gBadge}</span>
                </div>
                <div style={{ fontSize: 11, color: S.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>{voice.description || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div onClick={e => { e.stopPropagation(); playVoice(voice.id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: S.text2, cursor: 'pointer', background: S.card2, borderRadius: 6, padding: '3px 7px', border: `1px solid ${S.border}` }}>
                    {isPlaying ? <Square size={9} fill={S.text2} /> : <Play size={9} />} Preview
                  </div>
                  {selected && <Check size={14} color={S.accent} />}
                </div>
              </div>
            )
          }

          const VoiceGrid = ({ voices, loading, selectedId, onSelect }: { voices: any[]; loading: boolean; selectedId: string; onSelect: (v: any) => void }) => (
            loading
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: S.text3, fontSize: 13, padding: '8px 0' }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading voices...</div>
              : voices.length === 0
                ? <div style={{ color: S.text3, fontSize: 13, padding: '8px 0' }}>No voices available</div>
                : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
                    {voices.map(v => <VoiceCard key={v.id} voice={v} selected={selectedId === v.id} onSelect={() => onSelect(v)} />)}
                  </div>
          )

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Voice & Language</h3>
                <p style={{ color: S.text2, fontSize: 13 }}>Choose how your agent speaks and in which language</p>
              </div>

              {/* Agent Name */}
              <div>
                <label style={labelStyle}>Agent Name *</label>
                <input value={formData.agentName} onChange={e => setFormData(p => ({ ...p, agentName: e.target.value }))}
                  placeholder="e.g., Priya or Vikram" style={inpStyle}
                  onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
              </div>

              {/* Primary Language */}
              <div>
                <label style={labelStyle}>PRIMARY LANGUAGE *</label>
                <select value={formData.primaryLanguage}
                  onChange={e => setFormData(p => ({ ...p, primaryLanguage: e.target.value, primaryVoiceId: '', primaryVoiceName: '' }))}
                  style={{ ...inpStyle, cursor: 'pointer', color: formData.primaryLanguage ? S.text : S.text3 }}>
                  <option value="" disabled>Choose language</option>
                  {PRESET_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                {formData.primaryLanguage && (
                  <div style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>🔒 Sarvam STT · Gemini 2.5 Flash</div>
                )}
                {/* Voice grid appears below once language is chosen */}
                {formData.primaryLanguage && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Choose Voice</div>
                    <VoiceGrid voices={primaryVoices} loading={loadingPrimary} selectedId={formData.primaryVoiceId}
                      onSelect={v => setFormData(p => ({ ...p, primaryVoiceId: v.id, primaryVoiceName: v.name }))} />
                  </div>
                )}
              </div>

              {/* Secondary Language */}
              <div>
                <label style={labelStyle}>SECONDARY LANGUAGE <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <select value={formData.secondaryLanguage}
                  onChange={e => setFormData(p => ({ ...p, secondaryLanguage: e.target.value, secondaryVoiceId: '', secondaryVoiceName: '' }))}
                  style={{ ...inpStyle, cursor: 'pointer' }}>
                  <option value="">None</option>
                  {PRESET_LANGS.filter(l => l.code !== formData.primaryLanguage && l.code !== 'en').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                {formData.secondaryLanguage && (
                  <>
                    <div style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>🔒 Sarvam STT · Gemini 2.5 Flash</div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Choose Voice</div>
                      <VoiceGrid voices={secondaryVoices} loading={loadingSecondary} selectedId={formData.secondaryVoiceId}
                        onSelect={v => setFormData(p => ({ ...p, secondaryVoiceId: v.id, secondaryVoiceName: v.name }))} />
                    </div>
                  </>
                )}
              </div>

              {/* English Fallback — always fixed */}
              <div style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>English Fallback</span>
                  <span style={{ fontSize: 10, background: 'rgba(8,145,178,0.12)', color: S.accent, borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Fixed</span>
                </div>
                <p style={{ fontSize: 12, color: S.text3, margin: 0, lineHeight: 1.5 }}>
                  🔒 English is always available as a fallback. When a caller speaks English your agent automatically switches to an English voice — no setup needed.
                </p>
              </div>
            </div>
          )
        })()}

        {/* ── Step 4: Working Hours ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Working Hours</h3>
              <p style={{ color: S.text2, fontSize: 13 }}>Set when your clinic accepts calls</p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Opens at</label>
                <select value={formData.workingHoursStart} onChange={e => setFormData(p => ({ ...p, workingHoursStart: e.target.value }))} style={inpStyle}>
                  {['06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM','07:00 PM','08:00 PM','09:00 PM','10:00 PM','11:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Closes at</label>
                <select value={formData.workingHoursEnd} onChange={e => setFormData(p => ({ ...p, workingHoursEnd: e.target.value }))} style={inpStyle}>
                  {['06:00 AM','07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM','07:00 PM','08:00 PM','09:00 PM','10:00 PM','11:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: S.card2, borderRadius: 10, padding: 16 }}>
              <label style={labelStyle}>Quick Presets</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {[
                  { label: "9 AM – 6 PM", start: "09:00 AM", end: "06:00 PM" },
                  { label: "8 AM – 8 PM", start: "08:00 AM", end: "08:00 PM" },
                  { label: "10 AM – 7 PM", start: "10:00 AM", end: "07:00 PM" },
                  { label: "24 Hours",     start: "12:00 AM", end: "11:00 PM" },
                ].map(preset => (
                  <button key={preset.label} onClick={() => setFormData(p => ({ ...p, workingHoursStart: preset.start, workingHoursEnd: preset.end }))} style={{
                    padding: '8px 14px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, fontSize: 13, cursor: 'pointer'
                  }}>{preset.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Use Cases + FAQs ── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Use Cases & FAQs</h3>
              <p style={{ color: S.text2, fontSize: 13 }}>What your agent handles and common questions it will answer</p>
            </div>

            <div>
              <label style={labelStyle}>What should your agent handle?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {USE_CASES.map(useCase => (
                  <button key={useCase.id} onClick={() => setFormData(p => ({
                    ...p,
                    selectedUseCases: p.selectedUseCases.includes(useCase.id)
                      ? p.selectedUseCases.filter(u => u !== useCase.id)
                      : [...p.selectedUseCases, useCase.id]
                  }))} style={{
                    padding: 14, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    background: formData.selectedUseCases.includes(useCase.id) ? 'rgba(47,128,237,0.12)' : S.card2,
                    border: `1px solid ${formData.selectedUseCases.includes(useCase.id) ? S.accent : S.border}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{useCase.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: formData.selectedUseCases.includes(useCase.id) ? S.text : S.text2, fontSize: 14, marginBottom: 2 }}>{useCase.label}</div>
                        <div style={{ fontSize: 12, color: S.text3 }}>{useCase.desc}</div>
                      </div>
                      {formData.selectedUseCases.includes(useCase.id) && <Check size={18} color={S.accent} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>FAQs <span style={{ color: S.text3, fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {formData.faqs.map((faq, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: S.card2, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ color: S.text3, fontSize: 13, minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ color: S.text, fontSize: 13, flex: 1 }}>{faq}</span>
                    <button onClick={() => handleRemoveFaq(i)} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={formData.customFaq} onChange={e => setFormData(p => ({ ...p, customFaq: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddFaq()}
                  placeholder="Add a common question..." style={{ ...inpStyle, flex: 1 }}
                  onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
                <button onClick={handleAddFaq} style={{ padding: '12px 20px', background: S.accent, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Add</button>
              </div>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ color: '#86efac', fontSize: 13, margin: 0 }}>✓ Your AI system prompt will be generated automatically using all the information you've provided.</p>
            </div>
          </div>
        )}
      </>
    )
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' }}>
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        {!done && !isSubmitting && (
          <>
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 11, color: S.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Agent Setup</p>
                <p style={{ fontSize: 13, color: S.text3 }}>Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.text2, cursor: 'pointer', padding: 4 }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '14px 24px 0' }}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? S.accent : S.card2, transition: 'background 0.3s' }} />
              ))}
            </div>
          </>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {renderStep()}
        </div>

        {/* Footer */}
        {!done && !isSubmitting && (
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 9, color: S.text2, cursor: 'pointer', fontSize: 14, fontWeight: 500
            }}>
              <ChevronLeft size={16} /> {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < TOTAL_STEPS ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px',
                background: canProceed() ? S.accent : S.card2, border: 'none', borderRadius: 9,
                color: '#fff', cursor: canProceed() ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, opacity: canProceed() ? 1 : 0.5
              }}>
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canProceed()} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 28px',
                background: canProceed() ? 'linear-gradient(135deg, #2F80ED, #06b6d4)' : S.card2,
                border: 'none', borderRadius: 9, color: '#fff', cursor: canProceed() ? 'pointer' : 'not-allowed',
                fontSize: 15, fontWeight: 700, opacity: canProceed() ? 1 : 0.5,
                boxShadow: canProceed() ? '0 4px 20px rgba(47,128,237,0.4)' : 'none'
              }}>
                🔨 Build My Agent
              </button>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
