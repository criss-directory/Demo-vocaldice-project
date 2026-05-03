'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  PhoneCall, CalendarCheck, PhoneForwarded, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart
} from "recharts"
import { supabase } from '@/lib/supabase'

const S = {
  bg: '#F0F4F8', card: '#FFFFFF', border: '#E2E8F0',
  teal: '#0891B2', green: '#10B981', yellow: '#F59E0B', red: '#EF4444',
  text: '#1E293B', text2: '#64748B', text3: '#94A3B8',
  chart_1: '#0891B2', chart_2: '#3B82F6', chart_3: '#8B5CF6', chart_4: '#EC4899', chart_5: '#F59E0B'
}

type Period = 'week' | 'month'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [logs, setLogs] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch maximum of last 60 days to handle "month" period and its previous month for % change
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
      
      const { data: logData } = await supabase.from('call_logs').select('id, call_date, status, duration_seconds, analysis, agent_name, call_type').gte('call_date', sixtyDaysAgo.toISOString())
      if (logData) setLogs(logData)
      
      const { data: aptData } = await supabase.from('appointments').select('id, created_at, call_log_id').gte('created_at', sixtyDaysAgo.toISOString())
      if (aptData) setAppointments(aptData)
      
      setLoading(false)
    }
    load()
  }, [])

  const filteredLogs = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (period === 'week' ? 7 : 30))
    return logs.filter(l => new Date(l.call_date) >= cutoff)
  }, [logs, period])
  
  const filteredApts = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (period === 'week' ? 7 : 30))
    return appointments.filter(a => new Date(a.created_at) >= cutoff)
  }, [appointments, period])

  // Top stats
  const statsInfo = useMemo(() => {
    const totalCalls = filteredLogs.length
    const totalApts = filteredApts.length
    const completedCalls = filteredLogs.filter(l => l.status === 'completed').length
    
    // Previous period (for % change)
    const cutoff2 = new Date()
    cutoff2.setDate(cutoff2.getDate() - (period === 'week' ? 14 : 60))
    const cutoff1 = new Date()
    cutoff1.setDate(cutoff1.getDate() - (period === 'week' ? 7 : 30))
    const prevLogs = logs.filter(l => new Date(l.call_date) >= cutoff2 && new Date(l.call_date) < cutoff1)
    const prevApts = appointments.filter(a => new Date(a.created_at) >= cutoff2 && new Date(a.created_at) < cutoff1)
    
    const prevCalls = prevLogs.length || 1
    const prevTotalApts = prevApts.length || 1
    const prevCompleted = prevLogs.filter(l => l.status === 'completed').length || 1
    
    const callChange = Math.round(((totalCalls - prevCalls) / prevCalls) * 100)
    const aptChange = Math.round(((totalApts - prevTotalApts) / prevTotalApts) * 100)
    const compChange = Math.round(((completedCalls - prevCompleted) / prevCompleted) * 100)
    
    const totalSecs = filteredLogs.reduce((a, l) => a + (l.duration_seconds || 0), 0)
    const avgSecs = totalCalls ? Math.round(totalSecs / totalCalls) : 0
    const prevSecs = prevLogs.reduce((a, l) => a + (l.duration_seconds || 0), 0)
    const prevAvgSecs = prevLogs.length ? Math.round(prevSecs / prevLogs.length) : 0
    const durChange = prevAvgSecs ? Math.round(((avgSecs - prevAvgSecs) / prevAvgSecs) * 100) : 0
    
    const fmtDur = (s: number) => {
        const m = Math.floor(s/60); const sc = s%60; return `${m}m ${sc}s`
    }
    
    return [
      { label: "Total Calls", value: totalCalls.toLocaleString(), icon: PhoneCall, change: `${callChange > 0 ? '+' : ''}${callChange}%`, up: callChange >= 0 },
      { label: "Appointments", value: totalApts.toLocaleString(), icon: CalendarCheck, change: `${aptChange > 0 ? '+' : ''}${aptChange}%`, up: aptChange >= 0 },
      { label: "Completed Calls", value: completedCalls.toLocaleString(), icon: PhoneForwarded, change: `${compChange > 0 ? '+' : ''}${compChange}%`, up: compChange >= 0 },
      { label: "Avg Duration", value: fmtDur(avgSecs), icon: Activity, change: `${durChange > 0 ? '+' : ''}${durChange}%`, up: durChange >= 0 },
    ]
  }, [filteredLogs, filteredApts, logs, appointments, period])

  // Daily Call Volume
  const callVolumeData = useMemo(() => {
     if (period === 'week') {
         const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
         const data = Array.from({length: 7}).map((_, i) => {
             const d = new Date(); d.setDate(d.getDate() - (6 - i))
             return { day: days[d.getDay()], dateStr: d.toDateString(), calls: 0, appointments: 0 }
         })
         filteredLogs.forEach(l => {
             const entry = data.find(x => x.dateStr === new Date(l.call_date).toDateString())
             if (entry) entry.calls++
         })
         filteredApts.forEach(a => {
             const entry = data.find(x => x.dateStr === new Date(a.created_at).toDateString())
             if (entry) entry.appointments++
         })
         return data.map(d => ({ day: d.day, calls: d.calls, appointments: d.appointments }))
     } else {
         const data = [
             { day: 'Week 1', start: 30, end: 23, calls: 0, appointments: 0 },
             { day: 'Week 2', start: 23, end: 16, calls: 0, appointments: 0 },
             { day: 'Week 3', start: 16, end: 9, calls: 0, appointments: 0 },
             { day: 'Week 4', start: 9, end: 0, calls: 0, appointments: 0 },
         ]
         const now = new Date()
         filteredLogs.forEach(l => {
             const diff = (now.getTime() - new Date(l.call_date).getTime()) / (1000 * 3600 * 24)
             const w = data.find(x => diff <= x.start && diff > x.end)
             if (w) w.calls++
         })
         filteredApts.forEach(a => {
             const diff = (now.getTime() - new Date(a.created_at).getTime()) / (1000 * 3600 * 24)
             const w = data.find(x => diff <= x.start && diff > x.end)
             if (w) w.appointments++
         })
         return data.map(d => ({ day: d.day, calls: d.calls, appointments: d.appointments }))
     }
  }, [filteredLogs, filteredApts, period])

  // Weekly Trend Map (Line/Area)
  const weeklyTrendData = useMemo(() => {
      const points = period === 'week' ? 7 : 30
      const data = Array.from({length: points}).map((_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - ((points - 1) - i))
          return { label: period === 'week' ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] : d.getDate().toString(), dateStr: d.toDateString(), calls: 0 }
      })
      filteredLogs.forEach(l => {
          const entry = data.find(x => x.dateStr === new Date(l.call_date).toDateString())
          if (entry) entry.calls++
      })
      return data.map(d => ({ label: d.label, calls: d.calls }))
  }, [filteredLogs, period])

  // Agent distribution
  const agentData = useMemo(() => {
     const counts: Record<string, number> = {}
     filteredLogs.forEach(l => {
         const agent = l.agent_name || 'Agent'
         counts[agent] = (counts[agent] || 0) + 1
     })
     const total = filteredLogs.length || 1
     const colors = [S.teal, S.chart_2, S.chart_3, S.chart_4, S.chart_5]
     return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name, count], i) => ({
         name, value: Math.round((count/total)*100), color: colors[i % colors.length]
     }))
  }, [filteredLogs])

  // Outcomes
  const outcomeData = useMemo(() => {
      const counts = { 'Appointment Booked': 0, 'Enquiry Answered': 0, 'Missed / Dropped': 0 }
      filteredLogs.forEach(l => {
          if (l.status !== 'completed') counts['Missed / Dropped']++
          else if (l.analysis?.appointment_date || l.analysis?.time || filteredApts.some(a => a.call_log_id === l.id)) counts['Appointment Booked']++
          else counts['Enquiry Answered']++
      })
      const total = filteredLogs.length || 1
      return [
          { name: 'Appointment Booked', value: Math.round((counts['Appointment Booked']/total)*100), color: S.green },
          { name: 'Enquiry Answered', value: Math.round((counts['Enquiry Answered']/total)*100), color: S.teal },
          { name: 'Missed / Dropped', value: Math.round((counts['Missed / Dropped']/total)*100), color: S.red },
      ].filter(x => x.value > 0)
  }, [filteredLogs, filteredApts])

  // Peak Call Hours
  const hourlyData = useMemo(() => {
      const hours = Array.from({length: 13}).map((_, i) => ({ hour: i + 8, label: `${(i+8)>12?(i+8)-12:i+8}${(i+8)>=12?'PM':'AM'}`, calls: 0 }))
      filteredLogs.forEach(l => {
          const d = new Date(l.call_date)
          const h = d.getHours()
          const slot = hours.find(x => x.hour === h)
          if (slot) slot.calls++
      })
      return hours.map(h => ({ hour: h.label, calls: h.calls }))
  }, [filteredLogs])

  // Shared Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 13, color: S.text }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ margin: 0, fontSize: 12, color: S.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ fontWeight: 500 }}>{p.name || p.dataKey}</span>: <span style={{ fontWeight: 700, color: S.text }}>{p.value}</span>
          </p>
        ))}
      </div>
    )
  }

  if (loading) {
     return <div style={{ textAlign: 'center', padding: '80px 0', color: S.text3 }}><RefreshCw size={28} style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }} />Loading Analytics...</div>
  }

  return (
    <div style={{ color: S.text, display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Header & Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
           <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Analytics Overview</h1>
           <p style={{ color: S.text2, fontSize: 14, marginTop: 4 }}>Deep dive into your AI receptionist performance</p>
        </div>
        <div style={{ display: 'flex', background: S.bg, borderRadius: 8, padding: 4, border: `1px solid ${S.border}` }}>
          {(["week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: period === p ? S.card : 'transparent',
                color: period === p ? S.text : S.text2,
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              {p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {statsInfo.map((s) => (
          <div key={s.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: S.text2, fontWeight: 500 }}>{s.label}</span>
              <s.icon size={16} color={S.text3} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800 }}>{s.value}</span>
              <span style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', color: s.up ? S.green : S.yellow }}>
                {s.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {s.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Call Volume + Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
        {/* Daily call volume bar chart */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 15 }}>Call Volume</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callVolumeData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={S.border} opacity={0.6} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: S.text2 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: S.text2 }} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: S.bg, opacity: 0.6 }} />
                <Bar dataKey="calls" name="Total Calls" fill={S.teal} radius={[4, 4, 0, 0]} />
                <Bar dataKey="appointments" name="Appointments" fill={S.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly trend area chart */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 15 }}>Call Volume Trend</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData}>
                <defs>
                  <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={S.teal} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={S.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={S.border} opacity={0.6} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: S.text2 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: S.text2 }} dx={-10} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="calls" name="Total Calls" stroke={S.teal} fill="url(#callGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Distributions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
        {/* Agent Activity */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 15 }}>Agent Activity</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ height: 180, width: 180, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={agentData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                    {agentData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agentData.map((a) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: a.color }} />
                    <span style={{ fontWeight: 500 }}>{a.name}</span>
                  </div>
                  <span style={{ color: S.text2, fontFamily: 'monospace', fontWeight: 600 }}>{a.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Outcome breakdown */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 15 }}>Call Outcomes</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ height: 180, width: 180, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                    {outcomeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {outcomeData.map((o) => (
                <div key={o.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: o.color }} />
                    <span style={{ fontWeight: 500 }}>{o.name}</span>
                  </div>
                  <span style={{ color: S.text2, fontFamily: 'monospace', fontWeight: 600 }}>{o.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Peak hours chart */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22 }}>
        <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 15 }}>Peak Call Hours</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={S.border} opacity={0.6} />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: S.text2 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: S.text2 }} dx={-10} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: S.bg, opacity: 0.6 }} />
              <Bar dataKey="calls" name="Total Calls" fill={S.teal} radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
