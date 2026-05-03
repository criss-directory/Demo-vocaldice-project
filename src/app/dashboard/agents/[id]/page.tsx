'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AgentDetailTabs from './AgentDetailTabs'

import LiveWebCallModal from './LiveWebCallModal'

const S = { card: '#FFFFFF', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', green: '#059669' }

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [webCallOpen, setWebCallOpen] = useState(false)

  useEffect(() => {
    // Next.js App Router can return params as string | string[], always coerce to string
    const agentId = Array.isArray(params.id) ? params.id[0] : String(params.id)
    if (!agentId || agentId === 'undefined') {
      setFetchError('No agent ID found in URL')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }
        const { data, error } = await supabase.from('agents').select('*').eq('id', agentId).single()
        if (error) {
          setFetchError(error.message)
        } else if (data) {
          setAgent(data)
        }
      } catch (e: any) {
        setFetchError(String(e))
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={32} color={S.accent} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (fetchError || !agent) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: S.text2 }}>
        <h3 style={{ color: S.text }}>Agent not found</h3>
        {fetchError && (
          <p style={{ fontSize: 13, color: '#f87171', marginTop: 8, background: 'rgba(239,68,68,0.1)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            Error: {fetchError}
          </p>
        )}
        <button onClick={() => router.push('/dashboard/agents')} style={{ marginTop: 20, padding: '10px 20px', background: S.accent, border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Back to Agents
        </button>
      </div>
    )
  }

  return (
    <div style={{ color: S.text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard/agents')} style={{ background: '#F1F5F9', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, cursor: 'pointer', display: 'flex', padding: 6 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{agent.agent_name}</h1>
            <span style={{ fontSize: 12, color: S.text2 }}>{agent.clinic_name}</span>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'rgba(5,150,105,0.08)', color: S.green, border: '1px solid rgba(5,150,105,0.2)', marginLeft: 4 }}>
            {(agent.status || 'READY').toUpperCase()}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: S.text2, marginRight: 4 }}>Test with</span>
          <button style={{ padding: '8px 14px', background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 8, color: S.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Chat</button>
          <button onClick={() => setWebCallOpen(true)} style={{ padding: '8px 14px', background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 8, color: S.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Web Call</button>
          <button style={{ padding: '8px 14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8, color: S.green, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Phone Call</button>
          <button style={{ padding: '8px 18px', background: S.accent, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 4, boxShadow: '0 2px 8px rgba(8,145,178,0.3)' }}>Deploy</button>
        </div>
      </div>
      <AgentDetailTabs agent={agent} onAgentUpdate={(updates) => setAgent((prev: any) => ({ ...prev, ...updates }))} />
      {webCallOpen && <LiveWebCallModal agent={agent} onClose={() => setWebCallOpen(false)} />}
    </div>
  )
}
