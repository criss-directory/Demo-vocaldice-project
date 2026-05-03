'use client'
import { useState, useEffect } from 'react'
import { Bot, Plus, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const S = { card: '#FFFFFF', card2: '#F8FAFC', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8', green: '#059669', yellow: '#D97706', red: '#DC2626' }

const statusColor: Record<string, string> = { ready: S.yellow, live: S.green, paused: S.text2 }
const statusLabel: Record<string, string> = { ready: '● Ready', live: '● Live', paused: '● Paused' }

interface Agent { id: string; agent_name: string; clinic_name: string; voice_name: string; languages: string[]; use_cases: string[]; status: string; updated_at: string }

export default function AgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAgents = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setAgents([]); setLoading(false); return }
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setAgents(error ? [] : (data ?? []))
    } catch { setAgents([]) }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await supabase.from('agents').delete().eq('id', deleteTarget.id)
      setAgents(prev => prev.filter(a => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) { console.error(err) }
    setDeleting(false)
  }

  useEffect(() => {
    loadAgents()
    const handleRefresh = () => loadAgents()
    window.addEventListener('agent-created', handleRefresh)
    return () => window.removeEventListener('agent-created', handleRefresh)
  }, [])

  return (
    <div style={{ color: S.text }}>
      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#FFFFFF', border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 18, width: '100%', maxWidth: 420, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={24} color={S.red} />
              </div>
              <button onClick={() => setDeleteTarget(null)} style={{ background: 'none', border: 'none', color: S.text2, cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: S.text, marginBottom: 8 }}>Delete Agent?</h2>
            <p style={{ color: S.text2, fontSize: 14, marginBottom: 6, lineHeight: 1.6 }}>
              You are about to permanently delete <strong style={{ color: S.text }}>{deleteTarget.agent_name}</strong> from <strong style={{ color: S.text }}>{deleteTarget.clinic_name}</strong>.
            </p>
            <p style={{ color: S.red, fontSize: 13, marginBottom: 28 }}>⚠ This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 10, color: S.text2, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '11px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: S.red, fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {deleting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>My Agents</h1>
          <p style={{ color: S.text2, fontSize: 14, marginTop: 4 }}>{agents.length} configured AI receptionist{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding'))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: S.accent, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          <Plus size={16} /> New AI Receptionist
        </button>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[1,2].map(i => <div key={i} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, height: 220, opacity: 0.5 }} />)}
        </div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: S.card, borderRadius: 16, border: `1px dashed ${S.border}` }}>
          <Bot size={48} color={S.text2} style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px', color: S.text }}>No AI receptionists yet</h3>
          <p style={{ color: S.text2, marginBottom: 20, fontSize: 14 }}>Create your first AI receptionist to get started</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding'))} style={{ padding: '10px 24px', background: S.accent, border: 'none', cursor: 'pointer', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14 }}>Create your AI receptionist</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${S.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={22} color={S.accent} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{agent.agent_name}</div>
                    <div style={{ fontSize: 13, color: S.text2 }}>{agent.clinic_name}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[agent.status] ?? S.text2 }}>
                  {statusLabel[agent.status] ?? agent.status}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 18 }}>
                <Row label="Voice" value={agent.voice_name || 'Not set'} />
                <Row label="Languages" value={(agent.languages || []).join(', ').toUpperCase() || 'EN'} />
                <Row label="Use Cases" value={(agent.use_cases || []).map((u: string) => u.replace('_', ' ')).join(', ')} />
                <Row label="Updated" value={new Date(agent.updated_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => router.push(`/dashboard/agents/${agent.id}`)} style={{ flex: 1, padding: '9px', background: 'rgba(47,128,237,0.1)', border: `1px solid ${S.accent}44`, borderRadius: 8, color: S.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Edit Agent
                </button>
                <button style={{ flex: 1, padding: '9px', background: agent.status === 'live' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${agent.status === 'live' ? '#ef444444' : '#10b98144'}`, borderRadius: 8, color: agent.status === 'live' ? S.red : S.green, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {agent.status === 'live' ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => setDeleteTarget(agent)} title="Delete Agent" style={{ width: '38px', flexShrink: 0, padding: 0, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: S.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.2)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#8A9BC0' }}>{label}</span>
      <span style={{ fontWeight: 600, textTransform: 'capitalize', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
