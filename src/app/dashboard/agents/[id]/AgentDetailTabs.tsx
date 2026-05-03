'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { buildLangRuleBlock, stripLangRuleBlock } from '@/lib/promptTemplates'

const S = {
  bg: '#F8FAFC', card: '#FFFFFF', card2: '#F1F5F9', border: '#E2E8F0',
  accent: '#0891B2', accent2: '#2563EB', text: '#1E293B', text2: '#64748B', text3: '#94A3B8',
  green: '#059669', yellow: '#D97706', teal: '#0891B2', red: '#DC2626'
}

const TABS = ['Agent Edit', 'Call Configuration', 'Knowledge Base', 'Functions', 'Advanced', 'Post Call Analysis', 'Call Logs']

const LANG_LABELS: Record<string, string> = { te: 'Telugu', hi: 'Hindi', en: 'English', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', gu: 'Gujarati', bn: 'Bengali', es: 'Spanish' }
const ALL_LANGUAGES = ['en', 'hi', 'es', 'ta', 'mr', 'te', 'gu', 'bn', 'kn']

const GROQ_MODELS = [
  { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B Instant',    latency: '~150–200ms', badge: 'Fastest' },
  { id: 'gemma2-9b-it',            name: 'Gemma 2 9B',               latency: '~170–230ms', badge: '' },
  { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B',             latency: '~250–350ms', badge: '' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile',  latency: '~300–450ms', badge: 'Most Capable' },
]

const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', latency: '~200–400ms', badge: 'Fastest' },
  { id: 'gemini-2.0-flash',      name: 'Gemini 2.0 Flash',      latency: '~300–600ms', badge: 'Recommended' },
  { id: 'gemini-1.5-flash',      name: 'Gemini 1.5 Flash',      latency: '~400–700ms', badge: '' },
  { id: 'gemini-1.5-pro',        name: 'Gemini 1.5 Pro',        latency: '~800–1500ms', badge: '' },
  { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro',        latency: '~1000–2000ms', badge: 'Most Capable' },
]

const PRESET_VARIABLES = [
  { key: 'caller_name', label: 'Name' },
  { key: 'doctor', label: 'Doctor' },
  { key: 'department', label: 'Department' },
  { key: 'appointment_date', label: 'Date' },
  { key: 'appointment_time', label: 'Time' },
  { key: 'phone_number', label: 'Number' },
]

// ── Reusable UI primitives ─────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
      background: on ? S.teal : S.border, transition: 'background 0.2s', flexShrink: 0
    }}>
      <div style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', left: on ? 23 : 3, transition: 'left 0.2s' }} />
    </div>
  )
}

function Accordion({ icon, title, subtitle, children, defaultOpen = false }: {
  icon: string; title: string; subtitle: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <div onClick={() => setOpen(p => !p)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', cursor: 'pointer', background: S.card,
        userSelect: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
          <div>
            <div style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>{title}</div>
            <div style={{ color: S.text3, fontSize: 12, marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <span style={{ color: S.text2, fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌃</span>
      </div>
      {open && (
        <div style={{ padding: '20px', background: S.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function FieldRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${S.border}` }}>
      <div>
        <div style={{ fontSize: 14, color: S.text, fontWeight: 600 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: S.text3, marginTop: 3, maxWidth: 420 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 24 }}>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number" value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        style={{ width: 80, background: S.card, border: `1px solid ${S.border}`, borderRadius: 6, padding: '6px 10px', color: S.text, textAlign: 'right', outline: 'none', fontSize: 14 }}
      />
      <span style={{ color: S.text2, fontSize: 13 }}>{suffix}</span>
    </div>
  )
}

// ── Modal Components ───────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AgentDetailTabs({ agent: initialAgent, onAgentUpdate }: { agent: any; onAgentUpdate?: (updates: Partial<any>) => void }) {
  const [tab, setTab] = useState(0)
  const [agent, setAgent] = useState(initialAgent)

  // Modals
  const [langModal, setLangModal] = useState(false)
  const [voiceConfigModal, setVoiceConfigModal] = useState(false)
  const [voiceConfigPortal, setVoiceConfigPortal] = useState<'cartesia' | 'sarvam' | 'elevenlabs'>('cartesia')
  const [llmModal, setLlmModal] = useState(false)

  // Language
  const [selectedLangs, setSelectedLangs] = useState<string[]>(agent.languages || ['en'])

  // Voice / TTS
  const [voices, setVoices] = useState<any[]>([])
  const [selectedVoice, setSelectedVoice] = useState(agent.voice_name || 'Cartesia Voice')
  const [selectedVoiceId, setSelectedVoiceId] = useState(agent.voice_id || 'a0e99841-438c-4a64-b6a9-ae08223d6a2f')
  const [voiceFilterLang, setVoiceFilterLang] = useState('all')
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceSpeed, setVoiceSpeed] = useState<number>(agent.voice_speed ?? 1.0)

  // STT
  const [sttModel, setSttModel] = useState<string>(agent.stt_model || 'saarika:v2.5')
  const [sttLanguage, setSttLanguage] = useState<string>(agent.stt_language || 'unknown')
  const [sttSilenceTimeout, setSttSilenceTimeout] = useState<number>(agent.stt_silence_timeout ?? 1500)
  const [sttNoiseReducer, setSttNoiseReducer] = useState<boolean>(agent.stt_noise_reducer ?? false)
  const [sarvamSpeaker, setSarvamSpeaker] = useState<string>(agent.sarvam_speaker || 'meera')

  // LLM
  const [llmProvider, setLlmProvider] = useState<string>(agent.llm_provider || 'groq')
  const [llmModel, setLlmModel] = useState<string>(agent.llm_model || 'llama-3.1-8b-instant')
  const [llmTemp, setLlmTemp] = useState<number>(agent.llm_temperature ?? 0.3)
  const [llmStreaming, setLlmStreaming] = useState<boolean>(agent.llm_streaming ?? false)

  // Agent Edit
  const [systemPromptText, setSystemPromptText] = useState('')
  const [firstMessageMode, setFirstMessageMode] = useState(agent.first_message_mode || 'Assistant speaks first')
  const [firstMessageText, setFirstMessageText] = useState(
    agent.first_message || `Thank you for calling ${agent.clinic_name}. This is ${agent.agent_name}, how may I help you today?`
  )

  // ── Call Configuration ──────────────────────────────────────────────────────
  const defaultCallConfig = {
    silenceThreshold: 7,
    idleMsg1Mode: 'static', idleMsg1: 'Are you still there?',
    idleMsg2Mode: 'static', idleMsg2: 'Would you like to continue our conversation?',
    idleMsgLast: "I'll leave you for now. Have a nice day!",
    maxCallDuration: 600,
    autoEndEnabled: false,
    transferEnabled: false,
    customApiTransferEnabled: false,
    fillerPhrasesEnabled: false,
    personality: 'Friendly & Helpful',
    ambientSoundEnabled: false,
  }
  const [callConfig, setCallConfig] = useState<any>(() => {
    try {
      return agent.call_config ? { ...defaultCallConfig, ...JSON.parse(agent.call_config) } : defaultCallConfig
    } catch { return defaultCallConfig }
  })
  const callConfigTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Knowledge Base ──────────────────────────────────────────────────────────
  const [kbItems, setKbItems] = useState<any[]>([])
  const [kbDragOver, setKbDragOver] = useState(false)
  const [kbUrlInput, setKbUrlInput] = useState('')
  const [kbLoading, setKbLoading] = useState(false)
  const [kbError, setKbError] = useState('')

  // ── Post Call Analysis ──────────────────────────────────────────────────────
  const defaultPostCallConfig = {
    variables: PRESET_VARIABLES.map(v => ({ ...v, enabled: true })),
    options: {
      call_summary: true,
      full_conversation: false,
      sentiment_analysis: true,
      extracted_information: true,
    }
  }
  const [postCallConfig, setPostCallConfig] = useState<any>(() => {
    try {
      const saved = agent.post_call_config ? JSON.parse(agent.post_call_config) : null
      if (saved) return { ...defaultPostCallConfig, ...saved }
      return defaultPostCallConfig
    } catch { return defaultPostCallConfig }
  })
  const [newVarLabel, setNewVarLabel] = useState('')
  const postCallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (agent.system_prompt) {
      try {
        if (agent.system_prompt.startsWith('{')) {
          const parsed = JSON.parse(agent.system_prompt)
          setSystemPromptText(Object.values(parsed).join('\n\n'))
        } else {
          setSystemPromptText(agent.system_prompt)
        }
      } catch { setSystemPromptText(agent.system_prompt) }
    } else {
      setSystemPromptText('You are an AI assistant...')
    }

    fetch(`/api/voices${voiceFilterLang === 'all' ? '' : `?language=${voiceFilterLang}`}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (d.voices) setVoices(d.voices) })
      .catch(() => {})
  }, [agent, voiceFilterLang])

  // Load KB items when KB tab becomes active
  useEffect(() => {
    if (tab === 2) loadKbItems()
  }, [tab])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const saveUpdates = async (updates: Partial<any>) => {
    try {
      await supabase.from('agents').update(updates).eq('id', agent.id)
      setAgent((prev: any) => ({ ...prev, ...updates }))
      onAgentUpdate?.(updates)
    } catch(e) { console.error('Save fail:', e) }
  }

  const handleLangDone = async () => {
    const currentPrompt = agent.system_prompt || ''
    const updatedPrompt = stripLangRuleBlock(currentPrompt) + '\n\n' + buildLangRuleBlock(selectedLangs)
    await saveUpdates({ languages: selectedLangs, system_prompt: updatedPrompt })
    setSystemPromptText(stripLangRuleBlock(updatedPrompt))
    setLangModal(false)
  }

  const handleCartesiaSave = async () => {
    await saveUpdates({ voice_name: selectedVoice, voice_id: selectedVoiceId, voice_speed: voiceSpeed })
    setVoiceConfigModal(false)
  }

  const handleSarvamSave = async () => {
    await saveUpdates({ stt_model: sttModel, stt_language: sttLanguage, stt_silence_timeout: sttSilenceTimeout, stt_noise_reducer: sttNoiseReducer, sarvam_speaker: sarvamSpeaker })
    setVoiceConfigModal(false)
  }

  const handleLlmDone = async () => {
    await saveUpdates({ llm_provider: llmProvider, llm_model: llmModel, llm_temperature: llmTemp, llm_streaming: llmStreaming })
    setLlmModal(false)
  }

  // ── Call Config Autosave ─────────────────────────────────────────────────────

  const updateCallConfig = (patch: Partial<typeof callConfig>) => {
    const next = { ...callConfig, ...patch }
    setCallConfig(next)
    if (callConfigTimer.current) clearTimeout(callConfigTimer.current)
    callConfigTimer.current = setTimeout(() => {
      saveUpdates({ call_config: JSON.stringify(next) })
    }, 800)
  }

  // ── Post Call Config Autosave ────────────────────────────────────────────────

  const updatePostCallConfig = (patch: any) => {
    const next = { ...postCallConfig, ...patch }
    setPostCallConfig(next)
    if (postCallTimer.current) clearTimeout(postCallTimer.current)
    postCallTimer.current = setTimeout(() => {
      saveUpdates({ post_call_config: JSON.stringify(next) })
    }, 800)
  }

  // ── Knowledge Base helpers ───────────────────────────────────────────────────

  const loadKbItems = async () => {
    const token = await getAuthToken()
    if (!token) return
    const res = await fetch(`/api/knowledge-base/items?agent_id=${agent.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const d = await res.json()
      setKbItems(d.items || [])
    }
  }

  const handleKbUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const token = await getAuthToken()
    setKbLoading(true)
    setKbError('')
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('agent_id', agent.id)
        const res = await fetch('/api/knowledge-base/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const d = await res.json()
        if (!res.ok) { setKbError(d.error || 'Upload failed'); continue }
        setKbItems(prev => [d.item, ...prev])
      }
    } finally {
      setKbLoading(false)
    }
  }

  const handleKbScrape = async () => {
    if (!kbUrlInput.trim()) return
    const token = await getAuthToken()
    setKbLoading(true)
    setKbError('')
    try {
      const res = await fetch('/api/knowledge-base/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: kbUrlInput.trim(), agentId: agent.id }),
      })
      const d = await res.json()
      if (!res.ok) { setKbError(d.error || 'Scrape failed'); return }
      setKbItems(prev => [d.item, ...prev])
      setKbUrlInput('')
    } finally {
      setKbLoading(false)
    }
  }

  const handleKbToggleAttach = async (item: any) => {
    const token = await getAuthToken()
    const newAttached = !item.attached
    const res = await fetch('/api/knowledge-base/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: item.id, attached: newAttached, agentId: agent.id }),
    })
    if (res.ok) {
      setKbItems(prev => prev.map(i => i.id === item.id ? { ...i, attached: newAttached } : i))
    }
  }

  const handleKbDelete = async (item: any) => {
    const token = await getAuthToken()
    const res = await fetch('/api/knowledge-base/items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: item.id, filePath: item.file_path }),
    })
    if (res.ok) {
      setKbItems(prev => prev.filter(i => i.id !== item.id))
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {langModal && (
        <ModalOverlay onClose={() => setLangModal(false)}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, color: '#fff' }}>Language Configuration</h3>
            <span style={{ cursor: 'pointer', color: S.text3 }} onClick={() => setLangModal(false)}>✕</span>
          </div>
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            <div style={{ color: S.text2, fontSize: 13, marginBottom: 16 }}>Supported Languages ⓘ<br/>Choose multiple languages for your agent to support</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {ALL_LANGUAGES.map(code => (
                <div key={code} onClick={() => setSelectedLangs(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])}
                  style={{ border: `1px solid ${selectedLangs.includes(code) ? S.teal : S.border}`, borderRadius: 8, padding: '16px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', background: selectedLangs.includes(code) ? 'rgba(6,182,212,0.05)' : 'transparent' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${selectedLangs.includes(code) ? S.teal : S.text3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedLangs.includes(code) ? S.teal : 'transparent' }}>
                    {selectedLangs.includes(code) && <span style={{ color: '#000', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ color: '#fff', fontSize: 14 }}>{LANG_LABELS[code] || code}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '20px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleLangDone} style={{ padding: '8px 24px', background: S.teal, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>
        </ModalOverlay>
      )}

      {voiceConfigModal && (
        <ModalOverlay onClose={() => setVoiceConfigModal(false)}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: S.text, fontSize: 16 }}>Voice Configuration</h3>
            <span style={{ cursor: 'pointer', color: S.text3, fontSize: 20, lineHeight: 1 }} onClick={() => setVoiceConfigModal(false)}>✕</span>
          </div>
          <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, padding: '0 24px' }}>
            {(['cartesia', 'sarvam', 'elevenlabs'] as const).map(p => (
              <button key={p} onClick={() => setVoiceConfigPortal(p)} style={{
                padding: '12px 16px', background: 'none', border: 'none',
                borderBottom: `2px solid ${voiceConfigPortal === p ? S.teal : 'transparent'}`,
                color: voiceConfigPortal === p ? S.teal : S.text2,
                fontWeight: voiceConfigPortal === p ? 700 : 500, fontSize: 13, cursor: 'pointer', marginBottom: -1
              }}>
                {p === 'cartesia' ? 'Cartesia (TTS)' : p === 'sarvam' ? 'Sarvam (STT)' : 'ElevenLabs (TTS)'}
              </button>
            ))}
          </div>

          {voiceConfigPortal === 'cartesia' && (
            <>
              <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input placeholder="Search voices..." value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)}
                    style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none' }} />
                  <select value={voiceFilterLang} onChange={e => setVoiceFilterLang(e.target.value)}
                    style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, color: S.text, padding: '0 12px', minWidth: 140, outline: 'none' }}>
                    <option value="all">All Languages</option>
                    {ALL_LANGUAGES.map(l => <option key={l} value={l}>{LANG_LABELS[l] || l}</option>)}
                  </select>
                </div>
                {voices.length === 0 ? (
                  <div style={{ color: S.text3, textAlign: 'center', padding: 40 }}>Loading voices...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {voices.filter(v => !voiceSearch || v.name.toLowerCase().includes(voiceSearch.toLowerCase())).map(v => (
                      <div key={v.id || v.name} onClick={() => { setSelectedVoice(v.name); setSelectedVoiceId(v.id) }}
                        style={{ border: `1px solid ${selectedVoice === v.name ? S.teal : S.border}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', background: selectedVoice === v.name ? 'rgba(8,145,178,0.06)' : S.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${selectedVoice === v.name ? S.teal : S.text3}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedVoice === v.name && <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.teal }} />}
                          </div>
                          <span style={{ color: S.text, fontSize: 14, fontWeight: 600 }}>{v.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {v.tags ? v.tags.map((t: string) => <span key={t} style={{ background: S.bg, borderRadius: 4, padding: '2px 8px', fontSize: 11, color: S.text2, border: `1px solid ${S.border}` }}>{t}</span>)
                            : v.description && <span style={{ fontSize: 11, color: S.text2 }}>{v.description}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Speaking Speed</label>
                    <span style={{ fontSize: 13, color: S.teal, fontWeight: 700 }}>{voiceSpeed.toFixed(2)}x</span>
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.05" value={voiceSpeed} onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: S.teal, cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.text3, marginTop: 6 }}>
                    <span>0.5x — Slow</span><span>1.0x — Normal</span><span>2.0x — Fast</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setVoiceConfigModal(false)} style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCartesiaSave} style={{ padding: '9px 24px', background: S.teal, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save</button>
              </div>
            </>
          )}

          {voiceConfigPortal === 'sarvam' && (
            <>
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 12 }}>STT Model</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { id: 'saarika:v2.5', name: 'Saarika v2.5', desc: 'Stable · 12 languages', badge: '' },
                      { id: 'saaras:v3', name: 'Saaras v3', desc: 'Recommended · 23 languages · best accuracy', badge: 'Recommended' },
                      { id: 'saaras:v3-realtime', name: 'Saaras v3 Realtime', desc: 'Fastest · 23 languages · lowest latency', badge: '' },
                    ].map(m => (
                      <div key={m.id} onClick={() => setSttModel(m.id)} style={{
                        border: `1px solid ${sttModel === m.id ? S.teal : S.border}`, borderRadius: 10, padding: '12px 16px',
                        background: sttModel === m.id ? 'rgba(6,182,212,0.06)' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${sttModel === m.id ? S.teal : S.text3}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sttModel === m.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.teal }} />}
                          </div>
                          <div>
                            <div style={{ color: S.text, fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                            <div style={{ color: S.text3, fontSize: 11, marginTop: 2 }}>{m.desc}</div>
                          </div>
                        </div>
                        {m.badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(47,128,237,0.12)', color: S.accent2, border: '1px solid rgba(47,128,237,0.3)' }}>{m.badge}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 10 }}>Default Language</label>
                  <div style={{ fontSize: 12, color: S.text3, marginBottom: 10 }}>Used as fallback when auto-detection is uncertain. "Auto Detect" is recommended.</div>
                  <select value={sttLanguage} onChange={e => setSttLanguage(e.target.value)}
                    style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '11px 14px', color: S.text, outline: 'none' }}>
                    <option value="unknown">Auto Detect</option>
                    <option value="en-IN">English</option>
                    <option value="hi-IN">Hindi</option>
                    <option value="te-IN">Telugu</option>
                    <option value="ta-IN">Tamil</option>
                    <option value="kn-IN">Kannada</option>
                    <option value="ml-IN">Malayalam</option>
                    <option value="mr-IN">Marathi</option>
                    <option value="gu-IN">Gujarati</option>
                    <option value="pa-IN">Punjabi</option>
                    <option value="bn-IN">Bengali</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Silence Timeout</label>
                    <span style={{ fontSize: 13, color: S.teal, fontWeight: 700 }}>{sttSilenceTimeout}ms</span>
                  </div>
                  <div style={{ fontSize: 12, color: S.text3, marginBottom: 10 }}>How long to wait after the user stops speaking before processing.</div>
                  <input type="range" min="500" max="4000" step="100" value={sttSilenceTimeout} onChange={e => setSttSilenceTimeout(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: S.teal, cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.text3, marginTop: 6 }}>
                    <span>500ms — Fast</span><span>4000ms — Patient</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>Indian Language Voice (Sarvam TTS)</label>
                  <div style={{ fontSize: 12, color: S.text3, marginBottom: 10 }}>Used for Telugu, Hindi, Tamil and other Indian languages.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { id: 'meera', label: 'Meera', desc: 'Female · Warm' },
                      { id: 'pavithra', label: 'Pavithra', desc: 'Female · Clear' },
                      { id: 'maitreyi', label: 'Maitreyi', desc: 'Female · Natural' },
                      { id: 'arvind', label: 'Arvind', desc: 'Male · Professional' },
                      { id: 'amol', label: 'Amol', desc: 'Male · Warm' },
                      { id: 'amartya', label: 'Amartya', desc: 'Male · Deep' },
                    ].map(sp => (
                      <div key={sp.id} onClick={() => setSarvamSpeaker(sp.id)} style={{
                        border: `1px solid ${sarvamSpeaker === sp.id ? S.teal : S.border}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                        background: sarvamSpeaker === sp.id ? 'rgba(8,145,178,0.07)' : S.card,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${sarvamSpeaker === sp.id ? S.teal : S.text3}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {sarvamSpeaker === sp.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: S.teal }} />}
                          </div>
                          <span style={{ color: S.text, fontSize: 13, fontWeight: 600 }}>{sp.label}</span>
                        </div>
                        <div style={{ color: S.text3, fontSize: 11, paddingLeft: 18 }}>{sp.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, color: S.text, fontWeight: 600 }}>Noise Reducer</div>
                    <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>Filter filler words ("um", "ah", "uh") from transcription</div>
                  </div>
                  <Toggle on={sttNoiseReducer} onToggle={() => setSttNoiseReducer(p => !p)} />
                </div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setVoiceConfigModal(false)} style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSarvamSave} style={{ padding: '9px 24px', background: S.teal, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save</button>
              </div>
            </>
          )}

          {voiceConfigPortal === 'elevenlabs' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 16 }}>
              <div style={{ fontSize: 40 }}>🔜</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: S.text }}>ElevenLabs Coming Soon</div>
              <div style={{ fontSize: 14, color: S.text2, textAlign: 'center', maxWidth: 340 }}>ElevenLabs TTS integration is currently in development.</div>
              <span style={{ padding: '4px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: S.yellow, border: '1px solid rgba(245,158,11,0.3)' }}>Coming Soon</span>
            </div>
          )}
        </ModalOverlay>
      )}

      {llmModal && (
        <ModalOverlay onClose={() => setLlmModal(false)}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: S.text, fontSize: 16 }}>AI Model Configuration</h3>
            <span style={{ cursor: 'pointer', color: S.text3, fontSize: 20, lineHeight: 1 }} onClick={() => setLlmModal(false)}>✕</span>
          </div>
          <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 12 }}>Provider</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ id: 'groq', label: 'Groq', desc: 'Ultra-low latency' }, { id: 'gemini', label: 'Google Gemini', desc: 'Best multilingual' }].map(p => (
                  <button key={p.id} onClick={() => { setLlmProvider(p.id); setLlmModel(p.id === 'groq' ? 'llama-3.1-8b-instant' : 'gemini-2.0-flash') }} style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, border: `1px solid ${llmProvider === p.id ? S.teal : S.border}`,
                    background: llmProvider === p.id ? 'rgba(6,182,212,0.08)' : 'transparent', color: llmProvider === p.id ? S.teal : S.text2,
                    fontWeight: 600, cursor: 'pointer', fontSize: 14, textAlign: 'left'
                  }}>
                    <div>{p.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 12 }}>Model</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(llmProvider === 'groq' ? GROQ_MODELS : GEMINI_MODELS).map(m => (
                  <div key={m.id} onClick={() => setLlmModel(m.id)} style={{
                    border: `1px solid ${llmModel === m.id ? S.teal : S.border}`, borderRadius: 10, padding: '12px 16px',
                    background: llmModel === m.id ? 'rgba(6,182,212,0.06)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${llmModel === m.id ? S.teal : S.text3}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {llmModel === m.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.teal }} />}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ color: S.text3, fontSize: 11, marginTop: 2 }}>Latency: {m.latency}</div>
                      </div>
                    </div>
                    {m.badge && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100,
                        background: m.badge === 'Fastest' ? 'rgba(16,185,129,0.12)' : m.badge === 'Recommended' ? 'rgba(47,128,237,0.12)' : 'rgba(245,158,11,0.12)',
                        color: m.badge === 'Fastest' ? S.green : m.badge === 'Recommended' ? S.accent2 : S.yellow,
                        border: `1px solid ${m.badge === 'Fastest' ? 'rgba(16,185,129,0.3)' : m.badge === 'Recommended' ? 'rgba(47,128,237,0.3)' : 'rgba(245,158,11,0.3)'}`
                      }}>{m.badge}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Temperature</label>
                <span style={{ fontSize: 13, color: S.teal, fontWeight: 700 }}>{llmTemp.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={llmTemp} onChange={e => setLlmTemp(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: S.teal, cursor: 'pointer' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: S.text3, marginTop: 6 }}>
                <span>0 — Precise</span><span>1 — Creative</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>Enable Streaming</div>
                <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>Stream tokens as they are generated (lower perceived latency)</div>
              </div>
              <Toggle on={llmStreaming} onToggle={() => setLlmStreaming(p => !p)} />
            </div>
          </div>
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setLlmModal(false)} style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleLlmDone} style={{ padding: '9px 24px', background: S.teal, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save</button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Tab Bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${S.border}`, marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map((label, i) => (
          <button key={label} onClick={() => setTab(i)} style={{
            padding: '11px 16px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === i ? S.teal : 'transparent'}`,
            color: tab === i ? S.text : S.text2,
            fontWeight: tab === i ? 700 : 500, fontSize: 13,
            cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Agent Edit ─────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            <div onClick={() => setLangModal(true)} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>LANGUAGES</div>
              <div style={{ fontSize: 13, color: S.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(agent.languages || ['en']).map((l: string) => LANG_LABELS[l] || l).join(', ')}</div>
            </div>
            <div onClick={() => { setVoiceConfigPortal('cartesia'); setVoiceConfigModal(true) }} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>VOICE (TTS)</div>
              <div style={{ fontSize: 13, color: S.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.voice_name || 'Cartesia Voice'}</div>
            </div>
            <div style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'default', opacity: 0.85 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI MODEL (LLM)</div>
                <span style={{ fontSize: 10, color: S.text3 }}>🔒</span>
              </div>
              <div style={{ fontSize: 13, color: S.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Gemini · gemini-2.5-flash
              </div>
              <div style={{ fontSize: 10, color: S.text3, marginTop: 3 }}>Managed by Vocaldice</div>
            </div>
            <div style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'default', opacity: 0.85 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: S.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TRANSCRIPTION (STT)</div>
                <span style={{ fontSize: 10, color: S.text3 }}>🔒</span>
              </div>
              <div style={{ fontSize: 13, color: S.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sarvam · saarika:v2.5</div>
              <div style={{ fontSize: 10, color: S.text3, marginTop: 3 }}>Managed by Vocaldice</div>
            </div>
          </div>

          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: S.text, fontWeight: 600 }}>First Message Mode</label>
                <span style={{ color: S.text3, fontSize: 11 }}>ⓘ</span>
              </div>
              <select value={firstMessageMode} onChange={e => { setFirstMessageMode(e.target.value); saveUpdates({ first_message_mode: e.target.value }) }}
                style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px 14px', color: S.text, outline: 'none' }}>
                <option>Assistant speaks first</option>
                <option>User speaks first</option>
              </select>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: S.text, fontWeight: 600 }}>First Message</label>
                <span style={{ color: S.text3, fontSize: 11 }}>ⓘ</span>
              </div>
              <input value={firstMessageText} onChange={e => setFirstMessageText(e.target.value)} onBlur={e => saveUpdates({ first_message: e.target.value })}
                style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px 14px', color: S.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 13, color: S.text, fontWeight: 600 }}>How should your receptionist behave?</label>
                  <span style={{ color: S.text3, fontSize: 11 }}>ⓘ</span>
                </div>
                <button style={{ background: 'transparent', border: `1px solid ${S.teal}`, color: S.teal, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✨</span> Generate
                </button>
              </div>
              <textarea value={systemPromptText} onChange={e => setSystemPromptText(e.target.value)} onBlur={e => saveUpdates({ system_prompt: e.target.value })} spellCheck={false}
                style={{ width: '100%', minHeight: '400px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '16px', color: S.text, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 1: Call Configuration ─────────────────────────────────────────── */}
      {tab === 1 && (
        <div>
          {/* Silence Handling */}
          <Accordion icon="🔇" title="Silence Handling" subtitle="What happens when a caller goes quiet or stops responding" defaultOpen={true}>
            <div style={{ background: S.card, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ color: S.text3, fontSize: 16 }}>ⓘ</span>
              <span style={{ color: S.text2, fontSize: 13 }}>Configure how the agent behaves when the user is silent or idle.</span>
            </div>

            <div style={{ background: S.card, borderRadius: 10, padding: '20px' }}>
              <FieldRow label="User Idle Threshold (sec)" desc="The duration in seconds to wait before considering the user idle.">
                <NumInput value={callConfig.silenceThreshold} onChange={v => updateCallConfig({ silenceThreshold: v })} suffix="Second(s)" />
              </FieldRow>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: S.text, fontWeight: 600 }}>First Idle Message</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: callConfig.idleMsg1Mode === 'static' ? S.teal : S.text3 }}>Static</span>
                    <Toggle on={callConfig.idleMsg1Mode === 'dynamic'} onToggle={() => updateCallConfig({ idleMsg1Mode: callConfig.idleMsg1Mode === 'static' ? 'dynamic' : 'static' })} />
                    <span style={{ fontSize: 12, color: callConfig.idleMsg1Mode === 'dynamic' ? S.teal : S.text3 }}>Dynamic</span>
                  </div>
                </div>
                <input value={callConfig.idleMsg1} onChange={e => updateCallConfig({ idleMsg1: e.target.value })}
                  style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none', boxSizing: 'border-box', fontSize: 13 }} />
                <div style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>This message will be spoken if the user remains silent for <b style={{ color: S.text2 }}>{callConfig.silenceThreshold} seconds</b>.</div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: S.text, fontWeight: 600 }}>Second Idle Message</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: callConfig.idleMsg2Mode === 'static' ? S.teal : S.text3 }}>Static</span>
                    <Toggle on={callConfig.idleMsg2Mode === 'dynamic'} onToggle={() => updateCallConfig({ idleMsg2Mode: callConfig.idleMsg2Mode === 'static' ? 'dynamic' : 'static' })} />
                    <span style={{ fontSize: 12, color: callConfig.idleMsg2Mode === 'dynamic' ? S.teal : S.text3 }}>Dynamic</span>
                  </div>
                </div>
                <input value={callConfig.idleMsg2} onChange={e => updateCallConfig({ idleMsg2: e.target.value })}
                  style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none', boxSizing: 'border-box', fontSize: 13 }} />
                <div style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>This message will be spoken if the user remains silent for another <b style={{ color: S.text2 }}>{callConfig.silenceThreshold} seconds</b> after the first message.</div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, color: S.text, fontWeight: 600, marginBottom: 8 }}>Last Idle Message</div>
                <input value={callConfig.idleMsgLast} onChange={e => updateCallConfig({ idleMsgLast: e.target.value })}
                  style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none', boxSizing: 'border-box', fontSize: 13 }} />
                <div style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>This message will be spoken if the user remains silent for a final <b style={{ color: S.text2 }}>{callConfig.silenceThreshold} seconds</b>. The call will <b style={{ color: S.text2 }}>automatically hang up</b> after this message.</div>
              </div>
            </div>
          </Accordion>

          {/* End Call Rules */}
          <Accordion icon="📵" title="End Call Rules" subtitle="Set conditions for when the assistant should hang up">
            <div style={{ background: S.card, borderRadius: 10, padding: '20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <FieldRow label="Max Call Duration (sec)" desc="The maximum duration in seconds before the call is automatically ended.">
                <NumInput value={callConfig.maxCallDuration} onChange={v => updateCallConfig({ maxCallDuration: v })} suffix="Second(s)" />
              </FieldRow>
              <div style={{ marginTop: 16 }}>
                <FieldRow label="Enable Automatic Call Ending" desc="Allow your agent to automatically end calls based on specific conditions">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: callConfig.autoEndEnabled ? S.green : S.text3 }}>{callConfig.autoEndEnabled ? 'Enabled' : 'Disabled'}</span>
                    <Toggle on={callConfig.autoEndEnabled} onToggle={() => updateCallConfig({ autoEndEnabled: !callConfig.autoEndEnabled })} />
                  </div>
                </FieldRow>
              </div>
            </div>
          </Accordion>

          {/* Transfer & Routing */}
          <Accordion icon="📞" title="Transfer & Routing" subtitle="Route callers to phone numbers based on conditions">
            <div style={{ background: S.card, borderRadius: 10, padding: '20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <FieldRow label="Enable Call Transfer" desc="Allow your agent to transfer calls to human agents when needed">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: callConfig.transferEnabled ? S.green : S.text3 }}>{callConfig.transferEnabled ? 'Enabled' : 'Disabled'}</span>
                  <Toggle on={callConfig.transferEnabled} onToggle={() => updateCallConfig({ transferEnabled: !callConfig.transferEnabled })} />
                </div>
              </FieldRow>
              {callConfig.transferEnabled && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, color: S.text2, fontWeight: 600, display: 'block', marginBottom: 6 }}>Transfer Phone Number</label>
                  <input placeholder="+91 XXXXX XXXXX" value={callConfig.transferPhone || ''} onChange={e => updateCallConfig({ transferPhone: e.target.value })}
                    style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none', boxSizing: 'border-box', fontSize: 13 }} />
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <FieldRow label="Custom API Transfer" desc="Enable dynamic transfer routing based on API responses">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: callConfig.customApiTransferEnabled ? S.green : S.text3 }}>{callConfig.customApiTransferEnabled ? 'Enabled' : 'Disabled'}</span>
                    <Toggle on={callConfig.customApiTransferEnabled} onToggle={() => updateCallConfig({ customApiTransferEnabled: !callConfig.customApiTransferEnabled })} />
                  </div>
                </FieldRow>
              </div>
            </div>
          </Accordion>

          {/* Response Behavior */}
          <Accordion icon="💬" title="Response Behavior" subtitle="Filler phrases and personality style">
            <div style={{ background: S.card, borderRadius: 10, padding: '20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <FieldRow label="Filler Phrases" desc="Words or phrases spoken while your assistant is generating a response">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: callConfig.fillerPhrasesEnabled ? S.green : S.text3 }}>{callConfig.fillerPhrasesEnabled ? 'Enabled' : 'Disabled'}</span>
                  <Toggle on={callConfig.fillerPhrasesEnabled} onToggle={() => updateCallConfig({ fillerPhrasesEnabled: !callConfig.fillerPhrasesEnabled })} />
                </div>
              </FieldRow>
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: S.text2, fontWeight: 600, display: 'block', marginBottom: 6 }}>Personality</label>
                <select value={callConfig.personality} onChange={e => updateCallConfig({ personality: e.target.value })}
                  style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '11px 14px', color: S.text, outline: 'none' }}>
                  <option>Friendly &amp; Helpful</option>
                  <option>Professional &amp; Formal</option>
                  <option>Empathetic &amp; Caring</option>
                  <option>Concise &amp; Direct</option>
                  <option>Warm &amp; Conversational</option>
                </select>
              </div>
            </div>
          </Accordion>

          {/* Ambient Sound */}
          <Accordion icon="🔊" title="Ambient Sound" subtitle="Add background music or noise to calls">
            <div style={{ background: S.card, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ color: S.text3, fontSize: 16 }}>ⓘ</span>
              <span style={{ color: S.text2, fontSize: 13 }}>Enable background audio to play ambient sounds during calls. When enabled, you can select from various background audio options to enhance call quality and reduce silence.</span>
            </div>
            <div style={{ background: S.card, borderRadius: 10, padding: '20px' }}>
              <FieldRow label="Enable Background Audio" desc="Play background audio during calls to enhance the conversation experience">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: callConfig.ambientSoundEnabled ? S.green : S.text3 }}>{callConfig.ambientSoundEnabled ? 'Enabled' : 'Disabled'}</span>
                  <Toggle on={callConfig.ambientSoundEnabled} onToggle={() => updateCallConfig({ ambientSoundEnabled: !callConfig.ambientSoundEnabled })} />
                </div>
              </FieldRow>
              {callConfig.ambientSoundEnabled && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, color: S.text2, fontWeight: 600, display: 'block', marginBottom: 8 }}>Sound Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {['Office', 'Cafe', 'Nature', 'White Noise', 'Rain', 'None'].map(s => (
                      <div key={s} onClick={() => updateCallConfig({ ambientSoundType: s })}
                        style={{ border: `1px solid ${callConfig.ambientSoundType === s ? S.teal : S.border}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', textAlign: 'center', background: callConfig.ambientSoundType === s ? 'rgba(6,182,212,0.07)' : 'transparent' }}>
                        <span style={{ fontSize: 13, color: callConfig.ambientSoundType === s ? S.teal : S.text2, fontWeight: callConfig.ambientSoundType === s ? 700 : 400 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!callConfig.ambientSoundEnabled && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20, opacity: 0.3 }}>
                  <span style={{ fontSize: 32 }}>🔈</span>
                </div>
              )}
            </div>
          </Accordion>
        </div>
      )}

      {/* ── Tab 2: Knowledge Base ─────────────────────────────────────────────── */}
      {tab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Upload area */}
          <div
            onDragOver={e => { e.preventDefault(); setKbDragOver(true) }}
            onDragLeave={() => setKbDragOver(false)}
            onDrop={e => { e.preventDefault(); setKbDragOver(false); handleKbUpload(e.dataTransfer.files) }}
            style={{
              border: `2px dashed ${kbDragOver ? S.teal : S.border}`,
              borderRadius: 12, padding: '40px 24px', textAlign: 'center',
              background: kbDragOver ? 'rgba(6,182,212,0.04)' : S.card,
              transition: 'border-color 0.2s, background 0.2s', cursor: 'pointer',
            }}
            onClick={() => document.getElementById('kb-file-input')?.click()}
          >
            <input id="kb-file-input" type="file" accept=".pdf" multiple style={{ display: 'none' }}
              onChange={e => handleKbUpload(e.target.files)} />
            <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 15, color: S.text, fontWeight: 700, marginBottom: 6 }}>Drag & Drop PDF files here</div>
            <div style={{ fontSize: 13, color: S.text3, marginBottom: 16 }}>or click to browse — PDF files only</div>
            <button style={{ padding: '8px 20px', background: S.teal, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Browse Files</button>
          </div>

          {/* URL input */}
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 14, color: S.text, fontWeight: 700, marginBottom: 4 }}>Add Website URL</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 14 }}>We'll scrape the page content and use it as knowledge for your agent.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={kbUrlInput}
                onChange={e => setKbUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleKbScrape() }}
                placeholder="https://example.com/about"
                style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none', fontSize: 13 }}
              />
              <button onClick={handleKbScrape} disabled={kbLoading || !kbUrlInput.trim()}
                style={{ padding: '10px 20px', background: kbUrlInput.trim() ? S.teal : S.border, color: kbUrlInput.trim() ? '#000' : S.text3, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: kbUrlInput.trim() ? 'pointer' : 'not-allowed' }}>
                {kbLoading ? 'Loading...' : 'Scrape'}
              </button>
            </div>
          </div>

          {/* Error */}
          {kbError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 16px', color: S.red, fontSize: 13 }}>
              {kbError}
            </div>
          )}

          {/* Items list */}
          {kbLoading && kbItems.length === 0 && (
            <div style={{ color: S.text3, padding: 20, textAlign: 'center' }}>Loading knowledge base...</div>
          )}

          {kbItems.length === 0 && !kbLoading && (
            <div style={{ color: S.text3, padding: 20, textAlign: 'center', fontSize: 14 }}>
              No knowledge base items yet. Upload a PDF or add a website URL.
            </div>
          )}

          {kbItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: S.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Knowledge Base Items ({kbItems.length})</div>
              {kbItems.map(item => (
                <div key={item.id} style={{ background: S.card, border: `1px solid ${item.attached ? S.teal : S.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: item.type === 'pdf' ? 'rgba(239,68,68,0.1)' : 'rgba(47,128,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {item.type === 'pdf' ? '📄' : '🌐'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: S.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>
                      {item.type === 'pdf' ? 'PDF' : 'Website'} · {item.file_size ? `${Math.round(item.file_size / 1024)} KB` : 'N/A'} · {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {item.attached && (
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'rgba(6,182,212,0.12)', color: S.teal, border: '1px solid rgba(6,182,212,0.3)', flexShrink: 0 }}>Attached</span>
                  )}
                  <button onClick={() => handleKbToggleAttach(item)} style={{
                    padding: '7px 14px', borderRadius: 7, border: `1px solid ${item.attached ? S.border : S.teal}`,
                    background: item.attached ? 'transparent' : 'rgba(6,182,212,0.08)',
                    color: item.attached ? S.text2 : S.teal, fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0
                  }}>
                    {item.attached ? 'Detach' : 'Attach'}
                  </button>
                  <button onClick={() => handleKbDelete(item)} style={{ background: 'transparent', border: 'none', color: S.text3, cursor: 'pointer', fontSize: 16, padding: '4px', flexShrink: 0 }} title="Delete">
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Functions ──────────────────────────────────────────────────── */}
      {tab === 3 && (
        <div style={{ color: S.text3, padding: 40, textAlign: 'center', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontWeight: 700, color: S.text2, marginBottom: 6 }}>Functions Coming Soon</div>
          <div>Connect Cal.com, Google Sheets, Webhooks, and more.</div>
        </div>
      )}

      {/* ── Tab 4: Advanced ───────────────────────────────────────────────────── */}
      {tab === 4 && (
        <div style={{ color: S.text3, padding: 40, textAlign: 'center', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
          <div style={{ fontWeight: 700, color: S.text2, marginBottom: 6 }}>Advanced Settings</div>
          <div>Advanced configuration options coming soon.</div>
        </div>
      )}

      {/* ── Tab 5: Post Call Analysis ─────────────────────────────────────────── */}
      {tab === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Info banner */}
          <div style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: 13, color: S.text2, lineHeight: 1.6 }}>
              After every call, the AI automatically analyses the conversation and extracts the selected information. Results are saved to Call Logs and can be reviewed per call.
            </div>
          </div>

          {/* Extraction variables */}
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 14, color: S.text, fontWeight: 700, marginBottom: 4 }}>Information to Extract</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 16 }}>Select which caller details the AI should extract from each conversation. You can add custom fields too.</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {postCallConfig.variables.map((v: any, i: number) => (
                <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: S.bg, borderRadius: 8, border: `1px solid ${v.enabled ? S.teal + '40' : S.border}` }}>
                  <div onClick={() => {
                    const newVars = [...postCallConfig.variables]
                    newVars[i] = { ...v, enabled: !v.enabled }
                    updatePostCallConfig({ variables: newVars })
                  }} style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${v.enabled ? S.teal : S.text3}`, background: v.enabled ? S.teal : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {v.enabled && <span style={{ color: '#000', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: v.enabled ? S.text : S.text2, fontWeight: 600 }}>{v.label}</div>
                    <div style={{ fontSize: 11, color: S.text3, fontFamily: 'monospace' }}>{v.key}</div>
                  </div>
                  {!PRESET_VARIABLES.some(p => p.key === v.key) && (
                    <button onClick={() => {
                      const newVars = postCallConfig.variables.filter((_: any, idx: number) => idx !== i)
                      updatePostCallConfig({ variables: newVars })
                    }} style={{ background: 'transparent', border: 'none', color: S.text3, cursor: 'pointer', fontSize: 14, padding: '2px 6px' }} title="Remove">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add custom variable */}
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <input value={newVarLabel} onChange={e => setNewVarLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newVarLabel.trim()) {
                    const label = newVarLabel.trim()
                    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                    updatePostCallConfig({ variables: [...postCallConfig.variables, { key, label, enabled: true }] })
                    setNewVarLabel('')
                  }
                }}
                placeholder="Add custom field (e.g. Insurance Number)..."
                style={{ flex: 1, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px', color: S.text, outline: 'none', fontSize: 13 }} />
              <button onClick={() => {
                if (!newVarLabel.trim()) return
                const label = newVarLabel.trim()
                const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                updatePostCallConfig({ variables: [...postCallConfig.variables, { key, label, enabled: true }] })
                setNewVarLabel('')
              }} style={{ padding: '10px 18px', background: S.teal, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                + Add
              </button>
            </div>
          </div>

          {/* Analysis options */}
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 14, color: S.text, fontWeight: 700, marginBottom: 4 }}>Analysis Options</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 16 }}>Choose what type of analysis the AI should generate for each call.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'call_summary', label: 'Call Summary', desc: 'A brief summary of what was discussed during the call' },
                { key: 'full_conversation', label: 'Full Conversation', desc: 'Store the complete transcript of the call' },
                { key: 'sentiment_analysis', label: 'Sentiment Analysis', desc: "Analyse the caller's sentiment — Positive, Neutral, or Negative" },
                { key: 'extracted_information', label: 'Extracted Information', desc: 'Extract the selected fields above using AI' },
              ].map(opt => (
                <div key={opt.key} onClick={() => updatePostCallConfig({ options: { ...postCallConfig.options, [opt.key]: !postCallConfig.options[opt.key] } })}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: S.bg, borderRadius: 8, border: `1px solid ${postCallConfig.options[opt.key] ? S.teal + '40' : S.border}`, cursor: 'pointer' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${postCallConfig.options[opt.key] ? S.teal : S.text3}`, background: postCallConfig.options[opt.key] ? S.teal : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {postCallConfig.options[opt.key] && <span style={{ color: '#000', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: postCallConfig.options[opt.key] ? S.text : S.text2, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, color: S.text3, textAlign: 'center', padding: '4px 0' }}>
            Changes are saved automatically. Analysis runs after every call (web or phone).
          </div>
        </div>
      )}

      {/* ── Tab 6: Call Logs ──────────────────────────────────────────────────── */}
      {tab === 6 && <CallLogsTab agentId={agent.id} postCallConfig={postCallConfig} />}
    </div>
  )
}

// ── Call Logs Tab ─────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function shortId(uuid: string): string {
  // Generate a 7-digit display ID from UUID
  const hex = uuid.replace(/-/g, '').slice(-8)
  return String(parseInt(hex, 16) % 9000000 + 1000000)
}

interface CallLog {
  id: string
  agent_name: string
  call_date: string
  call_type: string
  from_number: string
  to_number: string
  duration_seconds: number
  status: string
  ended_by: string
  language: string
  transcript_json: any[]
  analysis: any
  summary: string
  recording_url?: string
}

function CallLogsTab({ agentId, postCallConfig }: { agentId: string; postCallConfig: any }) {
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CallLog | null>(null)
  const selectedRef = useRef<CallLog | null>(null)
  const [detailTab, setDetailTab] = useState<'chat' | 'analysis' | 'post_actions' | 'latency'>('chat')
  const [filterDir, setFilterDir] = useState('All directions')
  const [filterStatus, setFilterStatus] = useState('All statuses')
  const [filterDur, setFilterDur] = useState('All durations')
  const [refreshing, setRefreshing] = useState(false)

  const selectLog = (log: CallLog | null) => {
    setSelected(log)
    selectedRef.current = log
  }

  const load = async () => {
    setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('agent_id', agentId)
        .order('call_date', { ascending: false })
        .limit(100)
      if (!error && data) setLogs(data as CallLog[])
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  const refreshSelectedLog = async (callLogId: string) => {
    try {
      const { data } = await supabase.from('call_logs').select('*').eq('id', callLogId).single()
      if (data) {
        setLogs(prev => prev.map(l => l.id === callLogId ? data as CallLog : l))
        if (selectedRef.current?.id === callLogId) {
          setSelected(data as CallLog)
          selectedRef.current = data as CallLog
        }
      }
    } catch {}
  }

  useEffect(() => { load() }, [agentId])

  // Refresh list when call log is saved, update selected when analysis is ready
  useEffect(() => {
    const onLogSaved = () => load()
    const onAnalysisReady = (e: Event) => {
      const callLogId = (e as CustomEvent).detail?.callLogId
      if (callLogId) refreshSelectedLog(callLogId)
      load()
    }
    window.addEventListener('call-log-saved', onLogSaved)
    window.addEventListener('call-analysis-ready', onAnalysisReady)
    return () => {
      window.removeEventListener('call-log-saved', onLogSaved)
      window.removeEventListener('call-analysis-ready', onAnalysisReady)
    }
  }, [])

  const filtered = logs.filter(l => {
    if (filterStatus !== 'All statuses' && l.status !== filterStatus.toLowerCase()) return false
    if (filterDur !== 'All durations') {
      if (filterDur === 'Under 1 min' && l.duration_seconds >= 60) return false
      if (filterDur === '1–5 min' && (l.duration_seconds < 60 || l.duration_seconds > 300)) return false
      if (filterDur === 'Over 5 min' && l.duration_seconds <= 300) return false
    }
    return true
  })

  const selectStyle: React.CSSProperties = {
    background: '#FFFFFF', border: `1px solid ${S.border}`, borderRadius: 8,
    padding: '7px 12px', color: S.text, fontSize: 13, outline: 'none', cursor: 'pointer',
    appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: 28,
  }

  return (
    <div style={{ minHeight: 400 }}>

      {/* ── Floating detail card ── */}
      {selected && (
        <>
          {/* Backdrop */}
          <div onClick={() => selectLog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />

          {/* Card */}
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(800px, 95vw)', maxHeight: '88vh', background: S.card, borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)', border: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', zIndex: 1001, overflow: 'hidden' }}>

            {/* Card header */}
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: S.text }}>Call Details (ID: #{shortId(selected.id)})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: S.text2 }}>Mode:</span>
                  <div style={{ display: 'flex', background: S.bg, borderRadius: 8, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                    <span style={{ padding: '4px 14px', fontSize: 12, fontWeight: 700, background: S.teal, color: '#fff' }}>Simple</span>
                    <span style={{ padding: '4px 14px', fontSize: 12, fontWeight: 500, color: S.text2 }}>Advanced</span>
                  </div>
                </div>
                <button onClick={() => selectLog(null)} style={{ background: 'none', border: 'none', color: S.text2, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' }}>✕</button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

              {/* Audio player */}
              <div style={{ margin: '20px 24px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 20px' }}>
                {selected.recording_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <audio controls src={selected.recording_url} style={{ flex: 1, height: 36, accentColor: S.teal, minWidth: 0 }} />
                    <a href={selected.recording_url} download={`call-${shortId(selected.id)}.webm`} title="Download recording" style={{ color: S.text2, textDecoration: 'none', fontSize: 20, flexShrink: 0 }}>⬇</a>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: S.border, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, flexShrink: 0 }}>▶</div>
                    <div style={{ flex: 1, height: 4, background: S.border, borderRadius: 2, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: 12, height: 12, borderRadius: '50%', background: S.border }} />
                    </div>
                    <span style={{ fontSize: 12, color: S.text3, flexShrink: 0 }}>No recording available</span>
                  </div>
                )}
              </div>

              {/* Metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, padding: '0 24px 20px', borderBottom: `1px solid ${S.border}` }}>
                <div style={{ paddingRight: 20, paddingBottom: 16 }}>
                  <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Source</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{selected.agent_name}</div>
                </div>
                <div style={{ paddingRight: 20, paddingBottom: 16 }}>
                  <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Call Time</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{fmtDate(selected.call_date)}</div>
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Call Info</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(8,145,178,0.08)', color: S.teal, border: `1px solid rgba(8,145,178,0.2)` }}>{selected.call_type}</span>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: selected.status === 'completed' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', color: selected.status === 'completed' ? S.green : '#DC2626', border: `1px solid ${selected.status === 'completed' ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}` }}>{selected.status}</span>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: S.bg, color: S.text2, border: `1px solid ${S.border}` }}>⏱ {fmtDuration(selected.duration_seconds)}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Ended By</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{selected.ended_by}</div>
                </div>
              </div>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, padding: '0 24px' }}>
                {(['chat', 'analysis', 'post_actions', 'latency'] as const).map(t => (
                  <button key={t} onClick={() => setDetailTab(t)} style={{ padding: '12px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${detailTab === t ? S.teal : 'transparent'}`, color: detailTab === t ? S.teal : S.text2, fontWeight: detailTab === t ? 700 : 500, fontSize: 13, cursor: 'pointer', marginBottom: -1 }}>
                    {t === 'post_actions' ? 'Post Actions' : t === 'latency' ? 'Latency Profile' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ padding: '20px 24px', minHeight: 200 }}>

                {/* Chat */}
                {detailTab === 'chat' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(!selected.transcript_json || selected.transcript_json.length === 0) ? (
                      <div style={{ color: S.text3, textAlign: 'center', padding: 40 }}>No transcript available.</div>
                    ) : (
                      selected.transcript_json.map((msg: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: msg.role === 'assistant' ? 'rgba(8,145,178,0.12)' : 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: msg.role === 'assistant' ? S.teal : '#2563EB' }}>
                            {msg.role === 'assistant' ? 'A' : 'U'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{msg.role === 'assistant' ? 'Assistant' : 'Caller'}</span>
                              <span style={{ fontSize: 11, color: S.text3 }}>{fmtDate(selected.call_date)}</span>
                            </div>
                            <div style={{ padding: '12px 16px', borderRadius: 10, background: msg.role === 'assistant' ? 'rgba(8,145,178,0.05)' : S.bg, border: `1px solid ${msg.role === 'assistant' ? 'rgba(8,145,178,0.15)' : S.border}`, fontSize: 14, color: S.text, lineHeight: 1.7 }}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Analysis */}
                {detailTab === 'analysis' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(!selected.analysis || Object.keys(selected.analysis).length === 0) ? (
                      <div style={{ color: S.text3, textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>🔬</div>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: S.text2 }}>Analysis not yet available</div>
                        <div style={{ fontSize: 13 }}>Post-call analysis runs automatically after each call.</div>
                      </div>
                    ) : (
                      <>
                        {selected.analysis.call_summary && (
                          <div style={{ background: 'rgba(8,145,178,0.04)', border: `1px solid rgba(8,145,178,0.15)`, borderRadius: 10, padding: '14px 16px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: S.teal, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Call Summary</div>
                            <div style={{ fontSize: 14, color: S.text, lineHeight: 1.7 }}>{selected.analysis.call_summary}</div>
                          </div>
                        )}
                        {selected.analysis.sentiment && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sentiment</div>
                            <span style={{ padding: '4px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: selected.analysis.sentiment === 'Positive' ? 'rgba(5,150,105,0.08)' : selected.analysis.sentiment === 'Negative' ? 'rgba(220,38,38,0.08)' : 'rgba(100,116,139,0.08)', color: selected.analysis.sentiment === 'Positive' ? S.green : selected.analysis.sentiment === 'Negative' ? '#DC2626' : S.text2, border: `1px solid ${selected.analysis.sentiment === 'Positive' ? 'rgba(5,150,105,0.2)' : selected.analysis.sentiment === 'Negative' ? 'rgba(220,38,38,0.2)' : S.border}` }}>{selected.analysis.sentiment}</span>
                          </div>
                        )}
                        {postCallConfig?.variables?.filter((v: any) => v.enabled).length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Extracted Information</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {postCallConfig.variables.filter((v: any) => v.enabled).map((v: any) => {
                                const val = selected.analysis[v.key]
                                return (
                                  <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: S.bg, borderRadius: 8, border: `1px solid ${S.border}` }}>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{v.label}</div>
                                      <div style={{ fontSize: 11, color: S.text3, fontFamily: 'monospace' }}>{v.key}</div>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: val ? 700 : 400, color: val ? S.text : S.text3, maxWidth: '55%', textAlign: 'right' }}>{val ?? '—'}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {detailTab === 'post_actions' && (
                  <div style={{ color: S.text3, textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: S.text2 }}>Post Actions</div>
                    <div style={{ fontSize: 13 }}>Webhooks and triggers will appear here.</div>
                  </div>
                )}

                {detailTab === 'latency' && (
                  <div style={{ color: S.text3, textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>⏱</div>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: S.text2 }}>Latency Profile</div>
                    <div style={{ fontSize: 13 }}>Per-turn STT / LLM / TTS latency data will appear here.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Call list (always full width) ── */}
      <div style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>Recent Calls</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: S.text3, fontWeight: 500 }}>Filters</span>
            <select value={filterDir} onChange={e => setFilterDir(e.target.value)} style={selectStyle}>
              <option>All directions</option>
              <option>Outgoing</option>
              <option>Incoming</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
              <option>All statuses</option>
              <option>Completed</option>
              <option>Missed</option>
              <option>Failed</option>
            </select>
            <select value={filterDur} onChange={e => setFilterDur(e.target.value)} style={selectStyle}>
              <option>All durations</option>
              <option>Under 1 min</option>
              <option>1–5 min</option>
              <option>Over 5 min</option>
            </select>
            <button onClick={load} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FFFFFF', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span> Refresh
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: S.text3 }}>Loading call logs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, color: S.text2, marginBottom: 6 }}>No calls yet</div>
            <div style={{ fontSize: 13, color: S.text3 }}>Call logs will appear here after web or phone calls.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {filtered.map((log, idx) => (
              <div key={log.id} onClick={() => { selectLog(log); setDetailTab('chat') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderBottom: `1px solid ${S.border}`, cursor: 'pointer',
                  background: selected?.id === log.id ? 'rgba(8,145,178,0.04)' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'),
                  borderLeft: selected?.id === log.id ? `3px solid ${S.teal}` : '3px solid transparent',
                  transition: 'background 0.15s',
                }}>
                {/* Phone icon */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(8,145,178,0.08)', border: `1px solid rgba(8,145,178,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>📞</span>
                </div>

                {/* Middle info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: 'rgba(249,115,22,0.1)', color: '#ea580c', border: '1px solid rgba(249,115,22,0.2)' }}>↑ Outgoing</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{log.call_type} → {log.to_number}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: S.text3 }}>
                    <span>{fmtDate(log.call_date)}</span>
                    <span>•</span>
                    <span style={{ fontWeight: 600 }}>{fmtDuration(log.duration_seconds)}</span>
                    <span style={{ padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'rgba(8,145,178,0.08)', color: S.teal, border: `1px solid rgba(8,145,178,0.15)` }}>{log.call_type}</span>
                  </div>
                </div>

                {/* Right: ID + status */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 12, color: S.text3, fontFamily: 'monospace' }}>ID: #{shortId(log.id)}</span>
                    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(log.id) }}
                      style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer', fontSize: 12, padding: 2 }} title="Copy ID">⧉</button>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    background: log.status === 'completed' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                    color: log.status === 'completed' ? S.green : S.red,
                    border: `1px solid ${log.status === 'completed' ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  }}>{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
