'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, Download, ChevronDown, ChevronUp, Phone, Clock, FileText, Filter, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const S = {
  bg: '#F0F4F8', card: '#FFFFFF', card2: '#F8FAFC', border: '#E2E8F0',
  accent: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8',
  green: '#059669', yellow: '#D97706', red: '#DC2626', purple: '#7C3AED'
}

// ─── Types ──────────────────────────────────────────
interface Agent { id: string; agent_name: string; clinic_name: string }

interface CallLog {
  id: string
  agent_id: string
  agent_name: string
  call_date: string
  call_type: 'Web Call' | 'Phone Call' | string
  from_number: string
  to_number: string
  duration_seconds: number
  status: 'completed' | 'missed' | 'failed' | 'in-progress' | string
  ended_by: string
  cost: number
  summary: string
  transcript: string
  language: string
  transcript_json?: any[]
  analysis?: any
  recording_url?: string
}

// ─── Helpers ────────────────────────────────────────
function formatDuration(sec: number): string {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function shortId(uuid: string): string {
  const hex = uuid.replace(/-/g, '').slice(-8)
  return String(parseInt(hex, 16) % 9000000 + 1000000)
}

// ─── Status Badge ───────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    completed:     { bg: 'rgba(5,150,105,0.08)',  color: S.green,  border: 'rgba(5,150,105,0.2)'  },
    missed:        { bg: 'rgba(220,38,38,0.06)',  color: S.red,    border: 'rgba(220,38,38,0.2)'   },
    failed:        { bg: 'rgba(220,38,38,0.06)',  color: S.red,    border: 'rgba(220,38,38,0.2)'   },
    'in-progress': { bg: 'rgba(217,119,6,0.08)',  color: S.yellow, border: 'rgba(217,119,6,0.2)'   },
  }
  const s = styles[status] || styles['completed']
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  )
}

// ─── CSV Export ──────────────────────────────────────
function exportCSV(calls: CallLog[]) {
  const header = 'Call Date,Agent,From,To,Duration,Call Type,Status,Ended By,Cost,Language,Summary'
  const rows = calls.map(c =>
    `"${c.call_date}","${c.agent_name}","${c.from_number}","${c.to_number}","${formatDuration(c.duration_seconds)}","${c.call_type}","${c.status}","${c.ended_by}","₹${(c.cost || 0).toFixed(3)}","${c.language}","${(c.summary || '').replace(/"/g, "''")}"`
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vocaldice-call-logs.csv'; a.click()
}

// ─── Floating Detail Card ────────────────────────────
function CallDetailCard({ log, onClose, agentConfig }: { log: CallLog; onClose: () => void; agentConfig: any }) {
  const [tab, setTab] = useState<'chat' | 'analysis' | 'post_actions' | 'latency'>('chat')

  const tabs = [
    { id: 'chat',         label: 'Chat'            },
    { id: 'analysis',     label: 'Analysis'        },
    { id: 'post_actions', label: 'Post Actions'    },
    { id: 'latency',      label: 'Latency Profile' },
  ] as const

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Floating card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(780px, 95vw)', maxHeight: '88vh',
        background: S.card, borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)',
        border: `1px solid ${S.border}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 1001, overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: S.text }}>
            Call Details (ID: #{shortId(log.id)})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: S.text2, fontWeight: 500 }}>Mode:</span>
              <div style={{ display: 'flex', background: S.bg, borderRadius: 8, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                <span style={{ padding: '4px 14px', fontSize: 12, fontWeight: 700, background: S.accent, color: '#fff' }}>Simple</span>
                <span style={{ padding: '4px 14px', fontSize: 12, fontWeight: 500, color: S.text2 }}>Advanced</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.text2, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}>✕</button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Audio player */}
          <div style={{ margin: '20px 24px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 20px' }}>
            {log.recording_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <audio
                  controls
                  src={log.recording_url}
                  style={{ flex: 1, height: 36, accentColor: S.accent, minWidth: 0 }}
                />
                <a
                  href={log.recording_url}
                  download={`call-${shortId(log.id)}.webm`}
                  title="Download recording"
                  style={{ color: S.text2, textDecoration: 'none', fontSize: 18, flexShrink: 0, padding: 4 }}
                >⬇</a>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: S.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.5 }}>▶</div>
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
              <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{log.agent_name}</div>
            </div>
            <div style={{ paddingRight: 20, paddingBottom: 16 }}>
              <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Call Time</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{fmtDate(log.call_date)}</div>
            </div>
            <div style={{ paddingBottom: 16 }}>
              <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Call Info</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(8,145,178,0.08)', color: S.accent, border: `1px solid rgba(8,145,178,0.2)` }}>{log.call_type}</span>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: log.status === 'completed' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', color: log.status === 'completed' ? S.green : S.red, border: `1px solid ${log.status === 'completed' ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}` }}>{log.status}</span>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: S.bg, color: S.text2, border: `1px solid ${S.border}` }}>⏱ {formatDuration(log.duration_seconds)}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: S.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Ended By</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{log.ended_by}</div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, padding: '0 24px' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '12px 18px', background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === t.id ? S.accent : 'transparent'}`,
                color: tab === t.id ? S.accent : S.text2,
                fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer', marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Tab bodies */}
          <div style={{ padding: '20px 24px', minHeight: 200 }}>

            {/* Chat */}
            {tab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(!log.transcript_json || log.transcript_json.length === 0) ? (
                  <div style={{ textAlign: 'center', color: S.text3, padding: 30 }}>No transcript available.</div>
                ) : (
                  log.transcript_json.map((m: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: m.role === 'assistant' ? 'rgba(8,145,178,0.12)' : 'rgba(37,99,235,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: m.role === 'assistant' ? S.accent : '#2563EB',
                      }}>
                        {m.role === 'assistant' ? 'A' : 'U'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>
                            {m.role === 'assistant' ? 'Assistant' : 'Caller'}
                          </span>
                          <span style={{ fontSize: 11, color: S.text3 }}>{fmtDate(log.call_date)}</span>
                        </div>
                        <div style={{
                          padding: '12px 16px', borderRadius: 10,
                          background: m.role === 'assistant' ? 'rgba(8,145,178,0.05)' : S.bg,
                          border: `1px solid ${m.role === 'assistant' ? 'rgba(8,145,178,0.15)' : S.border}`,
                          fontSize: 14, color: S.text, lineHeight: 1.7,
                        }}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Analysis */}
            {tab === 'analysis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(!log.analysis || Object.keys(log.analysis).length === 0) ? (
                  <div style={{ textAlign: 'center', color: S.text3, padding: 30 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🔬</div>
                    <div style={{ fontWeight: 600, color: S.text2, marginBottom: 4 }}>Analysis not yet available</div>
                    <div style={{ fontSize: 13 }}>Post-call analysis runs automatically after each call.</div>
                  </div>
                ) : (
                  <>
                    {log.analysis.call_summary && (
                      <div style={{ background: 'rgba(8,145,178,0.04)', border: `1px solid rgba(8,145,178,0.15)`, borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Call Summary</div>
                        <div style={{ fontSize: 14, color: S.text, lineHeight: 1.7 }}>{log.analysis.call_summary}</div>
                      </div>
                    )}
                    {log.analysis.sentiment && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sentiment</div>
                        <span style={{
                          padding: '4px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                          background: log.analysis.sentiment === 'Positive' ? 'rgba(5,150,105,0.08)' : log.analysis.sentiment === 'Negative' ? 'rgba(220,38,38,0.08)' : 'rgba(100,116,139,0.08)',
                          color: log.analysis.sentiment === 'Positive' ? S.green : log.analysis.sentiment === 'Negative' ? S.red : S.text2,
                          border: `1px solid ${log.analysis.sentiment === 'Positive' ? 'rgba(5,150,105,0.2)' : log.analysis.sentiment === 'Negative' ? 'rgba(220,38,38,0.2)' : S.border}`,
                        }}>{log.analysis.sentiment}</span>
                      </div>
                    )}
                    {agentConfig?.variables?.filter((v: any) => v.enabled).length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Extracted Information</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {agentConfig.variables.filter((v: any) => v.enabled).map((v: any) => {
                            const val = log.analysis[v.key]
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
                    {!agentConfig && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(log.analysis)
                          .filter(([k]) => !['call_summary', 'sentiment', 'error'].includes(k))
                          .map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: S.bg, borderRadius: 8, border: `1px solid ${S.border}` }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{k}</div>
                              <div style={{ fontSize: 13, color: v ? S.text : S.text3 }}>{String(v ?? '—')}</div>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Post Actions */}
            {tab === 'post_actions' && (
              <div style={{ textAlign: 'center', color: S.text3, padding: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
                <div style={{ fontWeight: 600, color: S.text2, marginBottom: 4 }}>Post Actions</div>
                <div style={{ fontSize: 13 }}>Webhooks and triggers will appear here.</div>
              </div>
            )}

            {/* Latency Profile */}
            {tab === 'latency' && (
              <div style={{ textAlign: 'center', color: S.text3, padding: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>⏱</div>
                <div style={{ fontWeight: 600, color: S.text2, marginBottom: 4 }}>Latency Profile</div>
                <div style={{ fontSize: 13 }}>Per-turn STT / LLM / TTS latency data will appear here.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function CallLogsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CallLog | null>(null)
  const selectedRef = useRef<CallLog | null>(null)
  const [agentConfig, setAgentConfig] = useState<any>(null)
  const [selectedAgent, setSelectedAgent] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<'date' | 'duration' | 'cost'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const loadAgentConfig = async (agentId: string) => {
    setAgentConfig(null)
    try {
      const { data } = await supabase.from('agents').select('post_call_config').eq('id', agentId).single()
      if (data?.post_call_config) {
        const cfg = typeof data.post_call_config === 'string'
          ? JSON.parse(data.post_call_config)
          : data.post_call_config
        setAgentConfig(cfg)
      }
    } catch {}
  }

  const selectLog = (log: CallLog | null) => {
    setSelected(log)
    selectedRef.current = log
    if (log) loadAgentConfig(log.agent_id)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: agentData } = await supabase
        .from('agents')
        .select('id, agent_name, clinic_name')
        .eq('user_id', session.user.id)

      if (agentData) setAgents(agentData)

      const { data: callData, error } = await supabase
        .from('call_logs')
        .select('*')
        .order('call_date', { ascending: false })
        .limit(200)

      if (!error && callData) setCalls(callData as CallLog[])
    } catch {}
    setLoading(false)
  }, [])

  const refreshSelectedLog = async (callLogId: string) => {
    try {
      const { data } = await supabase.from('call_logs').select('*').eq('id', callLogId).single()
      if (data) {
        setCalls(prev => prev.map(l => l.id === callLogId ? data as CallLog : l))
        if (selectedRef.current?.id === callLogId) {
          setSelected(data as CallLog)
          selectedRef.current = data as CallLog
        }
      }
    } catch {}
  }

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const onLogSaved = () => loadData()
    const onAnalysisReady = (e: Event) => {
      const callLogId = (e as CustomEvent).detail?.callLogId
      if (callLogId) refreshSelectedLog(callLogId)
      loadData()
    }
    window.addEventListener('call-log-saved', onLogSaved)
    window.addEventListener('call-analysis-ready', onAnalysisReady)
    return () => {
      window.removeEventListener('call-log-saved', onLogSaved)
      window.removeEventListener('call-analysis-ready', onAnalysisReady)
    }
  }, [loadData])

  // ─── Filtering & Sorting ─────────────────────────
  const filtered = useMemo(() => {
    let result = calls.filter(c => {
      if (selectedAgent !== 'All' && c.agent_id !== selectedAgent) return false
      if (statusFilter !== 'All' && c.status !== statusFilter) return false
      if (typeFilter !== 'All' && c.call_type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(c.agent_name || '').toLowerCase().includes(q) &&
            !(c.from_number || '').toLowerCase().includes(q) &&
            !(c.summary || '').toLowerCase().includes(q) &&
            !(c.language || '').toLowerCase().includes(q)) return false
      }
      return true
    })

    result.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'date') cmp = new Date(a.call_date).getTime() - new Date(b.call_date).getTime()
      else if (sortCol === 'duration') cmp = (a.duration_seconds || 0) - (b.duration_seconds || 0)
      else if (sortCol === 'cost') cmp = (a.cost || 0) - (b.cost || 0)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [calls, selectedAgent, statusFilter, typeFilter, search, sortCol, sortDir])

  // ─── Summary stats ───────────────────────────────
  const totalCalls = calls.length
  const completedCalls = calls.filter(c => c.status === 'completed').length
  const missedCalls = calls.filter(c => c.status === 'missed' || c.status === 'failed').length
  const totalCost = calls.reduce((sum, c) => sum + (c.cost || 0), 0)
  const avgDuration = calls.length > 0 ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length) : 0

  const toggleSort = (col: 'date' | 'duration' | 'cost') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: 'date' | 'duration' | 'cost' }) => (
    <span style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'middle', marginLeft: 3, gap: 0, lineHeight: 0 }}>
      <ChevronUp size={9} style={{ color: sortCol === col && sortDir === 'asc' ? S.accent : S.text3 }} />
      <ChevronDown size={9} style={{ color: sortCol === col && sortDir === 'desc' ? S.accent : S.text3, marginTop: -2 }} />
    </span>
  )

  const filterBtn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(8,145,178,0.08)' : 'transparent',
    border: `1px solid ${active ? 'rgba(8,145,178,0.3)' : S.border}`,
    color: active ? S.accent : S.text2,
    borderRadius: 100, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
    fontWeight: active ? 600 : 400, transition: 'all 0.15s'
  })

  return (
    <div style={{ color: S.text }}>
      {/* Floating detail card */}
      {selected && (
        <CallDetailCard
          log={selected}
          onClose={() => selectLog(null)}
          agentConfig={agentConfig}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Call Logs</h1>
          <p style={{ color: S.text2, fontSize: 14, marginTop: 4 }}>Complete history of all calls handled across your agents</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadData} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: S.card, border: `1px solid ${S.border}`,
            color: S.text2, borderRadius: 9, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500
          }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => exportCSV(filtered)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: S.card, border: `1px solid ${S.border}`,
            color: S.text2, borderRadius: 9, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500
          }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Calls',    value: totalCalls.toString(),       icon: <Phone size={16} />,    color: S.accent  },
          { label: 'Completed',      value: completedCalls.toString(),    icon: <FileText size={16} />, color: S.green   },
          { label: 'Missed / Failed',value: missedCalls.toString(),       icon: <Phone size={16} />,    color: S.red     },
          { label: 'Avg Duration',   value: formatDuration(avgDuration),  icon: <Clock size={16} />,    color: S.yellow  },
          { label: 'Total Cost',     value: `₹${totalCost.toFixed(2)}`,   icon: <FileText size={16} />, color: S.purple  },
        ].map(k => (
          <div key={k.label} style={{
            background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.text2 }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} color={S.text3} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search agent, number, summary..."
              style={{
                width: '100%', background: S.bg, border: `1px solid ${S.border}`,
                borderRadius: 9, padding: '9px 14px 9px 34px', fontSize: 13, color: S.text, outline: 'none'
              }}
              onFocus={e => e.currentTarget.style.borderColor = S.accent}
              onBlur={e => e.currentTarget.style.borderColor = S.border}
            />
          </div>

          {/* Agent filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={12} color={S.text3} />
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              style={{
                background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8,
                padding: '7px 12px', fontSize: 12, color: S.text, outline: 'none', cursor: 'pointer'
              }}>
              <option value="All">All Agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.agent_name}</option>)}
            </select>
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['All', 'completed', 'missed', 'failed'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={filterBtn(statusFilter === s)}>
                {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['All', 'Web Call', 'Phone Call'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={filterBtn(typeFilter === t)}>
                {t === 'All' ? 'All Types' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result count */}
      <div style={{ fontSize: 13, color: S.text2, marginBottom: 12 }}>
        Showing <strong style={{ color: S.text }}>{filtered.length}</strong> of {calls.length} calls
      </div>

      {/* Table */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: S.card2 }}>
                <th style={thStyle}>Call Logs</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('date')}>
                  Call Date <SortIcon col="date" />
                </th>
                <th style={thStyle}>Bot Name</th>
                <th style={thStyle}>From Number</th>
                <th style={thStyle}>To Number</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('duration')}>
                  Duration <SortIcon col="duration" />
                </th>
                <th style={thStyle}>Call Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Ended By</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('cost')}>
                  Cost <SortIcon col="cost" />
                </th>
                <th style={thStyle}>Language</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: 48, textAlign: 'center', color: S.text3, fontSize: 14 }}>
                    Loading call logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 48, textAlign: 'center', color: S.text3, fontSize: 14 }}>
                    {calls.length === 0 ? 'No calls recorded yet. Start a call with any agent to see logs here.' : 'No calls match your filters.'}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr
                  key={c.id}
                  style={{ borderTop: `1px solid ${S.border}`, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = S.card2)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* View Logs button */}
                  <td style={tdStyle}>
                    <button
                      onClick={() => selectLog(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'rgba(8,145,178,0.06)', border: `1px solid rgba(8,145,178,0.15)`,
                        color: S.accent, borderRadius: 6, padding: '5px 10px', fontSize: 11,
                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                      }}
                    >
                      <FileText size={12} /> View Logs
                    </button>
                  </td>

                  {/* Call Date */}
                  <td style={tdStyle}>
                    <div style={{ fontSize: 12, color: S.text2, whiteSpace: 'nowrap' }}>{formatDate(c.call_date)}</div>
                    <div style={{ fontSize: 11, color: S.text3 }}>{formatTime(c.call_date)}</div>
                  </td>

                  {/* Bot Name */}
                  <td style={{ ...tdStyle, fontWeight: 600, color: S.text, fontSize: 13, maxWidth: 180 }}>
                    {c.agent_name}
                  </td>

                  {/* From */}
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: S.text2 }}>
                      <Phone size={11} /> {c.from_number}
                    </span>
                  </td>

                  {/* To */}
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: S.text2 }}>
                      <Phone size={11} /> {c.to_number}
                    </span>
                  </td>

                  {/* Duration */}
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: S.text2 }}>
                      <Clock size={11} /> {formatDuration(c.duration_seconds)}
                    </span>
                  </td>

                  {/* Call Type */}
                  <td style={tdStyle}>
                    <span style={{
                      background: c.call_type === 'Web Call' ? 'rgba(8,145,178,0.06)' : 'rgba(124,58,237,0.06)',
                      border: `1px solid ${c.call_type === 'Web Call' ? 'rgba(8,145,178,0.15)' : 'rgba(124,58,237,0.15)'}`,
                      color: c.call_type === 'Web Call' ? S.accent : S.purple,
                      borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap'
                    }}>
                      {c.call_type}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={tdStyle}><StatusBadge status={c.status} /></td>

                  {/* Ended By */}
                  <td style={{ ...tdStyle, fontSize: 12, color: S.text2 }}>{c.ended_by}</td>

                  {/* Cost */}
                  <td style={{ ...tdStyle, fontSize: 13, fontWeight: 600, color: S.text, whiteSpace: 'nowrap' }}>
                    ₹ {(c.cost || 0).toFixed(3)}
                  </td>

                  {/* Language */}
                  <td style={tdStyle}>
                    <span style={{
                      background: S.card2, border: `1px solid ${S.border}`,
                      borderRadius: 5, padding: '2px 8px', fontSize: 11, color: S.text2
                    }}>
                      {c.language}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Shared cell styles ─────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '11px 14px', textAlign: 'left', fontSize: 11, color: '#94A3B8',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
  whiteSpace: 'nowrap', borderBottom: '1px solid #E2E8F0', userSelect: 'none'
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px', whiteSpace: 'nowrap'
}
