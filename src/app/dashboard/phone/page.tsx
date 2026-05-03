'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link2, CheckCircle, Phone, Bot, Shield, Wifi, WifiOff, Copy, ExternalLink, Trash2, Plus, Settings, Eye, EyeOff } from 'lucide-react'

const S = { bg: '#F0F4F8', card: '#FFFFFF', card2: '#F8FAFC', border: '#E2E8F0', teal: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8', green: '#059669', red: '#DC2626', yellow: '#D97706' }

interface Agent { id: string; name: string; system_prompt?: string }
interface VobizNumber {
  id: string; phone_number: string; agent_id: string; is_active: boolean;
  vobiz_auth_id?: string; vobiz_auth_token?: string; connected_at: string
}

export default function PhonePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [numbers, setNumbers] = useState<VobizNumber[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [authId, setAuthId] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Settings panel
  const [showSettings, setShowSettings] = useState(false)
  const [globalAuthId, setGlobalAuthId] = useState('')
  const [globalAuthToken, setGlobalAuthToken] = useState('')
  const [showGlobalToken, setShowGlobalToken] = useState(false)

  const load = useCallback(async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: agentData } = await supabase.from('agents').select('id, name, system_prompt').eq('user_id', session.user.id)
    if (agentData) setAgents(agentData)

    const { data: numData } = await supabase.from('vobiz_numbers').select('*').eq('user_id', session.user.id)
    if (numData) setNumbers(numData)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function connectNumber() {
    if (!phoneNumber.trim() || !selectedAgent) return
    setConnecting(true)

    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase.from('vobiz_numbers').insert({
        user_id: session.user.id,
        agent_id: selectedAgent,
        phone_number: phoneNumber.trim(),
        vobiz_auth_id: authId.trim() || null,
        vobiz_auth_token: authToken.trim() || null,
        is_active: true,
      })

      if (error) {
        if (error.code === '23505') {
          alert('This phone number is already connected.')
        } else {
          alert('Error: ' + error.message)
        }
      } else {
        setPhoneNumber('')
        setAuthId('')
        setAuthToken('')
        await load()
      }
    } catch (err) {
      console.error(err)
    }

    setConnecting(false)
  }

  async function disconnectNumber(id: string) {
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('vobiz_numbers').delete().eq('id', id)
    await load()
  }

  async function toggleActive(id: string, currentState: boolean) {
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('vobiz_numbers').update({ is_active: !currentState }).eq('id', id)
    await load()
  }

  function getAgentName(agentId: string) {
    return agents.find(a => a.id === agentId)?.name || 'Unknown Agent'
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 9,
    padding: '11px 16px', fontSize: 14, color: S.text, outline: 'none', transition: 'border-color 0.2s'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 6
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: S.text, marginBottom: 4 }}>Phone Numbers</h1>
        <p style={{ color: S.text2, fontSize: 14 }}>Connect Vobiz virtual numbers to your AI agents for real phone calls</p>
      </div>

      {/* Connected Numbers */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 13, padding: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text, margin: 0 }}>Connected Numbers</h2>
          <span style={{ fontSize: 12, color: S.text3, fontWeight: 500 }}>{numbers.length} number{numbers.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: S.text3 }}>Loading...</div>
        ) : numbers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', border: `1px dashed ${S.border}`, borderRadius: 11 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: S.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Phone size={22} color={S.text3} />
            </div>
            <p style={{ color: S.text2, fontWeight: 600, marginBottom: 6 }}>No numbers connected yet</p>
            <p style={{ color: S.text3, fontSize: 13 }}>Connect a Vobiz number below to make your AI agent answer real phone calls</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {numbers.map(num => (
              <div key={num.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: num.is_active ? 'rgba(5,150,105,0.04)' : S.card2,
                border: `1px solid ${num.is_active ? 'rgba(5,150,105,0.2)' : S.border}`,
                borderRadius: 11, padding: '16px 18px', transition: 'all 0.2s'
              }}>
                {/* Status icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: num.is_active ? 'rgba(5,150,105,0.12)' : 'rgba(148,163,184,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {num.is_active ? <Wifi size={18} color={S.green} /> : <WifiOff size={18} color={S.text3} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{num.phone_number}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: num.is_active ? S.green : S.text3, fontWeight: 600 }}>
                      ● {num.is_active ? 'Active' : 'Paused'}
                    </span>
                    <span style={{ color: S.border }}>•</span>
                    <span style={{ fontSize: 12, color: S.text3 }}>
                      <Bot size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                      {getAgentName(num.agent_id)}
                    </span>
                    <span style={{ color: S.border }}>•</span>
                    <span style={{ fontSize: 11, color: S.text3 }}>
                      Connected {new Date(num.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => toggleActive(num.id, num.is_active)}
                    style={{
                      background: num.is_active ? 'rgba(217,119,6,0.08)' : 'rgba(5,150,105,0.08)',
                      border: `1px solid ${num.is_active ? 'rgba(217,119,6,0.3)' : 'rgba(5,150,105,0.3)'}`,
                      color: num.is_active ? S.yellow : S.green,
                      borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600
                    }}>
                    {num.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => disconnectNumber(num.id)}
                    style={{
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600
                    }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook Info Card */}
      <div style={{ background: 'rgba(8,145,178,0.04)', border: `1px solid rgba(8,145,178,0.15)`, borderRadius: 13, padding: '20px 22px', marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 10 }}>🔗 Voice Server Setup</h3>
        <p style={{ color: S.text2, fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
          Your Voice Server must be running and publicly accessible. In your <strong>Vobiz Console</strong>, set the Application's
          <strong> Answer URL</strong> to your server's <code>/answer</code> endpoint.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Answer URL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 13, color: S.teal, fontWeight: 600, flex: 1 }}>https://&lt;your-ngrok&gt;/answer</code>
              <button onClick={() => copyToClipboard('https://<your-ngrok>/answer')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.text3, padding: 2 }}>
                <Copy size={14} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Hangup URL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: 13, color: S.teal, fontWeight: 600, flex: 1 }}>https://&lt;your-ngrok&gt;/hangup</code>
              <button onClick={() => copyToClipboard('https://<your-ngrok>/hangup')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.text3, padding: 2 }}>
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>
        <p style={{ color: S.text3, fontSize: 12, marginTop: 10 }}>
          Run <code style={{ background: S.bg, padding: '2px 6px', borderRadius: 4, color: S.teal }}>npm run dev:voice</code> then{' '}
          <code style={{ background: S.bg, padding: '2px 6px', borderRadius: 4, color: S.teal }}>ngrok http 5050</code> to expose your server.
        </p>
      </div>

      {/* Connect New Number Form */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 13, padding: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> Connect a New Number
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Phone Number */}
          <div>
            <label style={labelStyle}>Vobiz Phone Number *</label>
            <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+91 40 1234 5678" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = S.teal)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
          </div>

          {/* Agent Selector */}
          <div>
            <label style={labelStyle}>Assign to AI Receptionist *</label>
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32 }}>
              <option value="">Select an agent...</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Vobiz Credentials (collapsible) */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: S.text2, fontSize: 13, fontWeight: 600, padding: 0 }}>
            <Settings size={14} />
            Vobiz API Credentials (optional — for per-number config)
            <span style={{ fontSize: 11, marginLeft: 4 }}>{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div style={{ marginTop: 12, padding: 16, background: S.bg, borderRadius: 10, border: `1px solid ${S.border}` }}>
              <p style={{ fontSize: 12, color: S.text3, marginBottom: 12, lineHeight: 1.6 }}>
                If this number uses a different Vobiz account than your default, enter the credentials here. Otherwise, leave blank to use the account-level defaults.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>
                    <Shield size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Auth ID
                  </label>
                  <input value={authId} onChange={e => setAuthId(e.target.value)} placeholder="MA_XXXXXXXX" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = S.teal)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
                </div>
                <div>
                  <label style={labelStyle}>
                    <Shield size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Auth Token
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input value={authToken} onChange={e => setAuthToken(e.target.value)} placeholder="Your auth token"
                      type={showToken ? 'text' : 'password'}
                      style={{ ...inputStyle, paddingRight: 40 }}
                      onFocus={e => (e.currentTarget.style.borderColor = S.teal)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
                    <button onClick={() => setShowToken(!showToken)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: S.text3, padding: 4 }}>
                      {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Connect Button */}
        <button onClick={connectNumber} disabled={connecting || !phoneNumber.trim() || !selectedAgent}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: connecting || !phoneNumber.trim() || !selectedAgent ? S.border : S.teal,
            color: '#fff', border: 'none', borderRadius: 9, padding: '12px 28px',
            fontWeight: 700, fontSize: 14, cursor: connecting || !phoneNumber.trim() || !selectedAgent ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}>
          {connecting ? '⏳ Connecting...' : <><Link2 size={15} /> Connect Number</>}
        </button>
      </div>

      {/* Quick Start Guide */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 13, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text, marginBottom: 14 }}>⚡ Quick Start Guide</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { step: '1', title: 'Start the Voice Server', desc: 'Run npm run dev:voice in a new terminal', code: 'npm run dev:voice' },
            { step: '2', title: 'Expose with ngrok', desc: 'Run ngrok to get a public URL', code: 'ngrok http 5050' },
            { step: '3', title: 'Configure Vobiz', desc: 'Go to console.vobiz.ai → Applications → Set Answer URL to your ngrok URL + /answer' },
            { step: '4', title: 'Connect Number Above', desc: 'Enter your Vobiz phone number, pick an agent, and click Connect' },
            { step: '5', title: 'Test It!', desc: 'Call your Vobiz number — your AI receptionist will answer! 🎉' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(8,145,178,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: S.teal, flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: S.text2 }}>{s.desc}</div>
                {s.code && (
                  <code style={{ display: 'inline-block', marginTop: 4, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: S.teal, fontWeight: 600 }}>{s.code}</code>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
