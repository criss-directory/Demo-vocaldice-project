'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, Trash2, Loader2 } from 'lucide-react'

const S = { bg: '#0B1120', card: '#111D35', card2: '#162040', border: '#1E2D4E', accent: '#2F80ED', text: '#F0F4FF', text2: '#8A9BC0', text3: '#4A6080', success: '#22C55E' }
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const LANGS = ['Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Hindi', 'English']
const VOICES = ['Warm & Friendly', 'Professional & Clear', 'Calm & Reassuring']

const inp: React.CSSProperties = { width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '9px', padding: '10px 14px', fontSize: '14px', color: S.text, outline: 'none' }

export default function AgentPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [config, setConfig] = useState({
    clinicName: '', address: '', phone: '', specialties: [] as string[],
    doctors: [{ name: '', spec: '' }],
    hours: Object.fromEntries(DAYS.map(d => [d, { active: d !== 'Sunday', open: '09:00', close: '18:00' }])),
    agentName: 'Priya', gender: 'Female', voiceStyle: 'Warm & Friendly',
    languages: ['Telugu', 'English'], faqs: [{ q: '', a: '' }],
    systemPrompt: '',
  })

  const loadConfig = useCallback(async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('agents').select('*').eq('user_id', session.user.id).single()
      if (data) {
        setConfig({
          clinicName: data.clinic_name || session.user.user_metadata?.clinic_name || '',
          address: data.address || '', phone: data.phone || '',
          specialties: data.specialties || [],
          doctors: data.doctors || [{ name: '', spec: '' }],
          hours: data.working_hours || Object.fromEntries(DAYS.map(d => [d, { active: d !== 'Sunday', open: '09:00', close: '18:00' }])),
          agentName: data.agent_name || 'Priya', gender: data.gender || 'Female',
          voiceStyle: data.voice_style || 'Warm & Friendly',
          languages: data.languages || ['Telugu', 'English'],
          faqs: data.faqs || [{ q: '', a: '' }],
          systemPrompt: data.system_prompt || '',
        })
      } else {
        setConfig(c => ({ ...c, clinicName: session.user.user_metadata?.clinic_name || '' }))
      }
    } catch (_) {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  async function handleSave() {
    setSaving(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await supabase.from('agents').upsert({
        user_id: session.user.id, agent_name: config.agentName, gender: config.gender,
        voice_style: config.voiceStyle, languages: config.languages, specialties: config.specialties,
        doctors: config.doctors, working_hours: config.hours, faqs: config.faqs,
        system_prompt: config.systemPrompt, status: 'active',
      }, { onConflict: 'user_id' })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (_) {} finally { setSaving(false) }
  }

  const set = (k: string, v: unknown) => setConfig(c => ({ ...c, [k]: v }))
  const toggleLang = (l: string) => set('languages', config.languages.includes(l) ? config.languages.filter(x => x !== l) : [...config.languages, l])
  const toggleSpec = (s: string) => set('specialties', config.specialties.includes(s) ? config.specialties.filter(x => x !== s) : [...config.specialties, s])

  const Tag = ({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} style={{ padding: '5px 13px', borderRadius: '100px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: active ? 'rgba(47,128,237,0.12)' : 'transparent', border: `1px solid ${active ? 'rgba(47,128,237,0.4)' : S.border}`, color: active ? S.accent : S.text2, transition: 'all 0.15s' }}>{label}</button>
  )

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '13px', padding: '24px', marginBottom: '18px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: S.text, marginBottom: '18px', paddingBottom: '14px', borderBottom: `1px solid ${S.border}` }}>{title}</h3>
      {children}
    </div>
  )

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}><Loader2 size={28} color={S.accent} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: S.text, marginBottom: '4px' }}>My Agent</h1>
          <p style={{ color: S.text2, fontSize: '14px' }}>Configure your AI receptionist</p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: saved ? 'rgba(34,197,94,0.15)' : S.accent, color: saved ? '#4ade80' : '#fff', border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none', borderRadius: '10px', padding: '11px 24px', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 0 18px rgba(47,128,237,0.25)', transition: 'all 0.2s' }}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Agent card */}
      <div style={{ background: 'linear-gradient(135deg, rgba(47,128,237,0.1), rgba(47,128,237,0.03))', border: '1px solid rgba(47,128,237,0.2)', borderRadius: '13px', padding: '22px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🤖</div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: S.text, marginBottom: '3px' }}>{config.agentName || 'Your Agent'}</div>
          <div style={{ fontSize: '13px', color: S.text2 }}>{config.voiceStyle} · {config.languages.join(', ')} · <span style={{ color: S.success, fontWeight: 600 }}>Active</span></div>
        </div>
      </div>

      <Section title="Clinic Details">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          {[['Clinic Name', 'clinicName', 'Sunshine Medical'], ['Clinic Address', 'address', '12 MG Road, Hyderabad'], ['Phone', 'phone', '+91 98765 43210']].map(([label, key, ph]) => (
            <div key={key}>
              <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
              <input value={config[key as keyof typeof config] as string} onChange={e => set(key, e.target.value)} placeholder={ph} style={inp}
                onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            </div>
          ))}
        </div>
        <div>
          <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Specialties</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {['General', 'Dental', 'Ortho', 'Cardiology', 'Pediatrics', 'Gynecology', 'ENT', 'Skin', 'Eye'].map(s => <Tag key={s} label={s} active={config.specialties.includes(s)} onToggle={() => toggleSpec(s)} />)}
          </div>
        </div>
      </Section>

      <Section title="Doctors">
        {config.doctors.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '9px', alignItems: 'center' }}>
            <input value={d.name} onChange={e => { const docs = [...config.doctors]; docs[i] = { ...docs[i], name: e.target.value }; set('doctors', docs) }} placeholder="Dr. Ramesh Kumar" style={{ ...inp, flex: 1 }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            <input value={d.spec} onChange={e => { const docs = [...config.doctors]; docs[i] = { ...docs[i], spec: e.target.value }; set('doctors', docs) }} placeholder="Specialization" style={{ ...inp, flex: 1 }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            {config.doctors.length > 1 && <button onClick={() => set('doctors', config.doctors.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer' }}><Trash2 size={15} /></button>}
          </div>
        ))}
        {config.doctors.length < 10 && <button onClick={() => set('doctors', [...config.doctors, { name: '', spec: '' }])} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px dashed ${S.border}`, color: S.text2, borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', fontSize: '13px', marginTop: '6px' }}><Plus size={14} /> Add Doctor</button>}
      </Section>

      <Section title="Working Hours">
        {DAYS.map(day => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${S.card2}` }}>
            <button onClick={() => set('hours', { ...config.hours, [day]: { ...config.hours[day], active: !config.hours[day]?.active } })} style={{ width: '36px', height: '20px', borderRadius: '100px', background: config.hours[day]?.active ? S.accent : S.border, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: config.hours[day]?.active ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
            <span style={{ width: '90px', fontSize: '13px', color: config.hours[day]?.active ? S.text : S.text3, fontWeight: 500 }}>{day.substring(0, 3)}</span>
            {config.hours[day]?.active ? (
              <>
                <input type="time" value={config.hours[day]?.open || '09:00'} onChange={e => set('hours', { ...config.hours, [day]: { ...config.hours[day], open: e.target.value } })} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '7px', padding: '5px 9px', fontSize: '13px', color: S.text, outline: 'none' }} />
                <span style={{ color: S.text3, fontSize: '12px' }}>to</span>
                <input type="time" value={config.hours[day]?.close || '18:00'} onChange={e => set('hours', { ...config.hours, [day]: { ...config.hours[day], close: e.target.value } })} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: '7px', padding: '5px 9px', fontSize: '13px', color: S.text, outline: 'none' }} />
              </>
            ) : <span style={{ fontSize: '12px', color: S.text3 }}>Closed</span>}
          </div>
        ))}
      </Section>

      <Section title="Agent Personality">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Name</label>
            <input value={config.agentName} onChange={e => set('agentName', e.target.value)} style={inp} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
          </div>
          <div>
            <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Voice Style</label>
            <select value={config.voiceStyle} onChange={e => set('voiceStyle', e.target.value)} style={{ ...inp }}>
              {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Languages</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>{LANGS.map(l => <Tag key={l} label={l} active={config.languages.includes(l)} onToggle={() => toggleLang(l)} />)}</div>
        </div>
      </Section>

      <Section title="FAQs">
        {config.faqs.map((f, i) => (
          <div key={i} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: '9px', padding: '13px', marginBottom: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {config.faqs.length > 1 && <button onClick={() => set('faqs', config.faqs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer' }}><Trash2 size={13} /></button>}
            </div>
            <input value={f.q} onChange={e => { const faqs = [...config.faqs]; faqs[i] = { ...faqs[i], q: e.target.value }; set('faqs', faqs) }} placeholder="Question..." style={{ ...inp, marginBottom: '8px' }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            <textarea value={f.a} onChange={e => { const faqs = [...config.faqs]; faqs[i] = { ...faqs[i], a: e.target.value }; set('faqs', faqs) }} placeholder="Answer..." rows={2} style={{ ...inp, resize: 'vertical', display: 'block' }} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
          </div>
        ))}
        {config.faqs.length < 10 && <button onClick={() => set('faqs', [...config.faqs, { q: '', a: '' }])} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: `1px dashed ${S.border}`, color: S.text2, borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', fontSize: '13px', width: '100%', justifyContent: 'center' }}><Plus size={14} /> Add FAQ</button>}
      </Section>

      {/* System prompt */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '13px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: S.text, marginBottom: '6px' }}>Generated Agent Prompt</h3>
        <p style={{ color: S.text3, fontSize: '12px', marginBottom: '14px' }}>This is what powers your agent — read only.</p>
        <textarea readOnly value={config.systemPrompt || 'Complete your agent setup to see the generated prompt.'} rows={6} style={{ ...inp, resize: 'none', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6, color: S.text2 }} />
      </div>
    </div>
  )
}
