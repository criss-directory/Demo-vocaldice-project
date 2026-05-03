'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar as CalendarIcon, PhoneOff, List, Search, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const S = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1E293B',
  text2: '#64748B',
  text3: '#94A3B8',
  accent: '#0891B2',
  cols: {
    scheduled: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    showed_up:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    no_show:    { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    completed:  { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  }
}

type ColumnType = 'scheduled' | 'showed_up' | 'no_show' | 'completed'
type TabType = 'calendar' | 'appointments' | 'no_showup'

interface Appointment {
  id: string
  patient_name: string
  patient_phone: string
  appointment_date: string   // YYYY-MM-DD
  appointment_time: string   // HH:MM
  doctor: string
  department: string
  status: ColumnType
  call_duration_seconds: number
  call_type: string
  call_summary: string
  transcript: string
  raw_analysis: Record<string, any>
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt24to12(t: string): string {
  if (!t) return '—'
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function fmtDuration(secs: number): string {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')} min`
}

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatHeadingDate(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClinicDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appointments')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColumnType | null>(null)

  // Modal state
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true })

      if (error) throw error
      setAppointments((data || []) as Appointment[])
      setLastRefreshed(new Date())
    } catch (e) {
      console.error('[ClinicDashboard] Failed to fetch appointments:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchAppointments(true)
    }, 5 * 60 * 1000)
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current) }
  }, [fetchAppointments])

  // Real-time subscription — new appointment shows instantly
  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAppointments(prev => [payload.new as Appointment, ...prev])
          setLastRefreshed(new Date())
        } else if (payload.eventType === 'UPDATE') {
          setAppointments(prev => prev.map(a => a.id === (payload.new as Appointment).id ? payload.new as Appointment : a))
        } else if (payload.eventType === 'DELETE') {
          setAppointments(prev => prev.filter(a => a.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { if (e.target instanceof HTMLElement) e.target.style.opacity = '0.4' }, 0)
  }
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null); setDragOverCol(null)
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1'
  }
  const handleDragOver = (e: React.DragEvent, col: ColumnType) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== col) setDragOverCol(col)
  }
  const handleDrop = async (e: React.DragEvent, targetCol: ColumnType) => {
    e.preventDefault(); setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    // Optimistic update
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: targetCol } : a))
    setDraggedId(null)
    // Persist to Supabase
    await supabase.from('appointments').update({ status: targetCol }).eq('id', id)
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedApt) return
    await supabase.from('appointments').delete().eq('id', selectedApt.id)
    setAppointments(prev => prev.filter(a => a.id !== selectedApt.id))
    setSelectedApt(null)
  }

  // ── Card UI ─────────────────────────────────────────────────────────────────
  const CardUI = ({ apt }: { apt: Appointment }) => {
    const colKey = (apt.status || 'scheduled') as ColumnType
    const theme = S.cols[colKey] || S.cols.scheduled
    return (
      <div
        draggable={activeTab === 'appointments'}
        onDragStart={activeTab === 'appointments' ? (e) => handleDragStart(e, apt.id) : undefined}
        onDragEnd={activeTab === 'appointments' ? handleDragEnd : undefined}
        onClick={() => { setSelectedApt(apt); setTranscriptOpen(false) }}
        style={{
          background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16,
          cursor: 'pointer', transition: 'all 0.15s', boxShadow: draggedId === apt.id ? '0 5px 15px rgba(0,0,0,0.2)' : 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = theme.color; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 12px ${theme.bg}` }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, color: S.text, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span>{apt.patient_name || 'Unknown Patient'}</span>
          {activeTab !== 'appointments' && (
            <span style={{ fontSize: 10, padding: '2px 7px', background: theme.bg, color: theme.color, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
              {colKey.replace('_', ' ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(59,130,246,0.1)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, fontWeight: 600 }}>
            {apt.appointment_date}
          </span>
          {apt.department && (
            <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(0,0,0,0.04)', color: S.text2, border: `1px solid ${S.border}`, borderRadius: 4, fontWeight: 600 }}>
              {apt.department}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: S.text2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {fmt24to12(apt.appointment_time)}
          </div>
          {apt.doctor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {apt.doctor}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Time elapsed ────────────────────────────────────────────────────────────
  const elapsedLabel = () => {
    const diff = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    return `${Math.floor(diff / 3600)} hr ago`
  }

  // ── PIPELINE VIEW ───────────────────────────────────────────────────────────
  const renderPipeline = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, alignItems: 'flex-start' }}>
      {(['scheduled', 'showed_up', 'no_show', 'completed'] as ColumnType[]).map(colType => {
        const list = appointments.filter(a => a.status === colType)
        const isDragOver = dragOverCol === colType
        const theme = S.cols[colType]
        const title = colType === 'showed_up' ? 'Showed Up' : colType === 'no_show' ? 'No Show' : colType.charAt(0).toUpperCase() + colType.slice(1)
        return (
          <div key={colType}
            onDragOver={(e) => handleDragOver(e, colType)}
            onDragLeave={(e) => { e.preventDefault(); setDragOverCol(null) }}
            onDrop={(e) => handleDrop(e, colType)}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 400,
              background: isDragOver ? theme.bg : 'transparent',
              borderRadius: 12, padding: isDragOver ? 8 : 0, transition: 'all 0.2s' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `2px solid ${theme.color}` }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 14, color: theme.color }}>{title}</h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.color, background: theme.bg, padding: '2px 8px', borderRadius: 10 }}>{list.length}</span>
            </div>
            {list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: S.text3, fontSize: 12, border: `2px dashed ${S.border}`, borderRadius: 10 }}>Drag appointments here</div>
            ) : list.map(apt => <CardUI key={apt.id} apt={apt} />)}
          </div>
        )
      })}
    </div>
  )

  // ── CALENDAR VIEW ───────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay()
    const today = todayISO()
    const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    const displayedAppts = appointments.filter(a => {
      if (selectedDate && a.appointment_date !== selectedDate) return false
      if (searchFilter && !a.patient_name.toLowerCase().includes(searchFilter.toLowerCase())) return false
      return true
    })

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(290px, 340px) 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Calendar widget */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ padding: 6, borderRadius: 7, background: 'transparent', border: `1px solid ${S.border}`, color: S.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={14} /></button>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ padding: 6, borderRadius: 7, background: 'transparent', border: `1px solid ${S.border}`, color: S.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ padding: '5px 2px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: S.text3 }}>{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = getDateStr(day)
              const count = appointments.filter(a => a.appointment_date === dateStr).length
              const isSel = selectedDate === dateStr
              const isToday = dateStr === today
              return (
                <button key={day} onClick={() => setSelectedDate(isSel ? null : dateStr)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '7px 2px', borderRadius: 7, cursor: 'pointer', border: 'none', fontSize: 12,
                    background: isSel ? S.accent : isToday ? 'rgba(8,145,178,0.1)' : 'transparent',
                    color: isSel ? '#fff' : isToday ? S.accent : S.text, fontWeight: isToday ? 700 : 400, transition: 'all 0.15s' }}>
                  <span>{day}</span>
                  {count > 0 && <span style={{ fontSize: 8, color: isSel ? '#fff' : S.accent, marginTop: 1, fontWeight: 700 }}>{count}</span>}
                </button>
              )
            })}
          </div>
          {selectedDate && (
            <button onClick={() => setSelectedDate(null)} style={{ width: '100%', marginTop: 14, padding: '8px', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text2, fontSize: 12, cursor: 'pointer' }}>
              Clear Selection
            </button>
          )}
        </div>

        {/* Appointment cards */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px 14px' }}>
              <Search size={15} color={S.text3} />
              <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search patients..." style={{ background: 'none', border: 'none', outline: 'none', color: S.text, fontSize: 13, width: '100%' }} />
            </div>
          </div>
          {selectedDate && (
            <p style={{ fontSize: 12, color: S.text2, marginBottom: 12 }}>
              Showing appointments for <strong style={{ color: S.text }}>{selectedDate}</strong>
            </p>
          )}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {displayedAppts.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: S.text3 }}>
                {selectedDate ? 'No appointments on this date.' : 'No appointments yet.'}
              </div>
            ) : displayedAppts.map(apt => <CardUI key={apt.id} apt={apt} />)}
          </div>
        </div>
      </div>
    )
  }

  // ── NO-SHOW VIEW ────────────────────────────────────────────────────────────
  const renderNoShowups = () => {
    const list = appointments.filter(a => a.status === 'no_show')
    return (
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22, minHeight: 400 }}>
        <h3 style={{ margin: '0 0 18px', fontWeight: 700, fontSize: 17, color: S.cols.no_show.color, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PhoneOff size={18} /> Total No Shows: {list.length}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {list.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: S.text3 }}>Great job! No missed appointments.</div>
          ) : list.map(apt => <CardUI key={apt.id} apt={apt} />)}
        </div>
      </div>
    )
  }

  // ── TAB BUTTON ──────────────────────────────────────────────────────────────
  const TabBtn = ({ tab, label, icon }: { tab: TabType; label: string; icon: React.ReactNode }) => {
    const isActive = activeTab === tab
    return (
      <button onClick={() => setActiveTab(tab)} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
        background: isActive ? 'rgba(8,145,178,0.12)' : 'transparent',
        color: isActive ? S.accent : S.text2,
      }}>
        {icon} {label}
      </button>
    )
  }

  // ── MODAL ───────────────────────────────────────────────────────────────────
  const colKey = ((selectedApt?.status) || 'scheduled') as ColumnType
  const theme = S.cols[colKey] || S.cols.scheduled

  return (
    <div style={{ color: S.text }}>

      {/* ─── Top Bar ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 14, borderBottom: `1px solid ${S.border}` }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 3px', color: S.text }}>Clinic Dashboard</h1>
          <p style={{ fontSize: 12, color: S.text3, margin: 0 }}>{formatHeadingDate()}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Refresh info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: S.text3 }}>
            <span>Updated {elapsedLabel()} · auto-refreshes every 5 min</span>
            <button onClick={() => fetchAppointments(true)} title="Refresh now"
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', color: S.text2, fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 3 }}>
            <TabBtn tab="calendar" label="Calendar" icon={<CalendarIcon size={15} />} />
            <TabBtn tab="appointments" label="Pipeline" icon={<List size={15} />} />
            <TabBtn tab="no_showup" label="No Shows" icon={<PhoneOff size={15} />} />
          </div>
        </div>
      </div>

      {/* ─── Stats row ─── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {(['scheduled','showed_up','no_show','completed'] as ColumnType[]).map(col => {
            const count = appointments.filter(a => a.status === col).length
            const label = col === 'showed_up' ? 'Showed Up' : col === 'no_show' ? 'No Show' : col.charAt(0).toUpperCase() + col.slice(1)
            const t = S.cols[col]
            return (
              <div key={col} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: S.text2, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: t.color }}>{count}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Content ─── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: S.text3 }}>
          <RefreshCw size={28} style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }} />
          Loading appointments...
        </div>
      ) : (
        <div>
          {activeTab === 'appointments' && renderPipeline()}
          {activeTab === 'calendar' && renderCalendar()}
          {activeTab === 'no_showup' && renderNoShowups()}
        </div>
      )}

      {/* ─── Modal ─── */}
      {selectedApt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding: '22px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: S.text }}>{selectedApt.patient_name || 'Unknown Patient'}</h2>
                <span style={{ fontSize: 12, padding: '3px 10px', background: theme.bg, color: theme.color, borderRadius: 10, fontWeight: 700, textTransform: 'capitalize' }}>
                  {colKey.replace('_', ' ')}
                </span>
              </div>
              <button onClick={() => setSelectedApt(null)} style={{ background: 'none', border: 'none', color: S.text3, cursor: 'pointer', padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '0 24px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Phone', value: selectedApt.patient_phone || selectedApt.call_type || 'Web Call', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
                  { label: 'Date', value: selectedApt.appointment_date, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
                  { label: 'Time', value: fmt24to12(selectedApt.appointment_time), icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                  { label: 'Doctor', value: selectedApt.doctor || 'Not provided', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                  { label: 'Department', value: selectedApt.department || 'General', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg> },
                  { label: 'Call Duration', value: fmtDuration(selectedApt.call_duration_seconds), icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                ].map(item => (
                  <div key={item.label} style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 9, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: S.text3, fontSize: 11, marginBottom: 4 }}>{item.icon} {item.label}</div>
                    <div style={{ color: S.text, fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Call summary */}
              {selectedApt.call_summary && (
                <div style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 9, padding: '12px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Call Summary</p>
                  <p style={{ fontSize: 13, color: S.text2, lineHeight: 1.6, margin: 0 }}>{selectedApt.call_summary}</p>
                </div>
              )}

              {/* Collapsible transcript */}
              {selectedApt.transcript && (
                <div>
                  <button onClick={() => setTranscriptOpen(p => !p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: S.text2, cursor: 'pointer', padding: '4px 0', fontSize: 13, fontWeight: 600 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Call Transcript
                    <ChevronDown size={14} style={{ transform: transcriptOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {transcriptOpen && (
                    <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 9, padding: 14, marginTop: 8, color: S.text2, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}>
                      {selectedApt.transcript}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', borderBottomLeftRadius: 18, borderBottomRightRadius: 18, background: S.bg }}>
              <button onClick={handleDelete} style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)', padding: '10px 20px', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Delete Card
              </button>
              <button onClick={() => setSelectedApt(null)} style={{ background: '#10B981', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
