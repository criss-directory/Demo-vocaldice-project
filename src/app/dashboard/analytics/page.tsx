'use client'

const S = { card: '#FFFFFF', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', green: '#059669', yellow: '#D97706', purple: '#7C3AED', red: '#DC2626' }

const Bar = ({ h, color, label }: { h: number; color: string; label: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
    <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', height: `${h}%`, background: color, borderRadius: '4px 4px 0 0' }} />
    </div>
    <span style={{ fontSize: 10, color: S.text2 }}>{label}</span>
  </div>
)

const weeklyData = [
  { day: 'Mon', calls: 48, booked: 30, missed: 5 },
  { day: 'Tue', calls: 62, booked: 41, missed: 8 },
  { day: 'Wed', calls: 55, booked: 38, missed: 4 },
  { day: 'Thu', calls: 78, booked: 52, missed: 10 },
  { day: 'Fri', calls: 91, booked: 61, missed: 12 },
  { day: 'Sat', calls: 43, booked: 28, missed: 3 },
  { day: 'Sun', calls: 12, booked: 7, missed: 2 },
]

const maxCalls = Math.max(...weeklyData.map(d => d.calls))

const langData = [
  { lang: 'Telugu', pct: 42, color: S.accent },
  { lang: 'English', pct: 28, color: S.green },
  { lang: 'Hindi', pct: 16, color: S.yellow },
  { lang: 'Tamil', pct: 9, color: S.purple },
  { lang: 'Kannada', pct: 5, color: S.red },
]

const peakHours = [
  { hour: '9AM', load: 60 }, { hour: '10AM', load: 85 }, { hour: '11AM', load: 90 },
  { hour: '12PM', load: 55 }, { hour: '1PM', load: 40 }, { hour: '2PM', load: 70 },
  { hour: '3PM', load: 95 }, { hour: '4PM', load: 80 }, { hour: '5PM', load: 65 },
  { hour: '6PM', load: 45 }, { hour: '7PM', load: 30 },
]

export default function AnalyticsPage() {
  return (
    <div style={{ color: S.text }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Analytics</h1>
        <p style={{ color: S.text2, fontSize: 14, marginTop: 4 }}>Detailed call intelligence and performance breakdown</p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Total Calls (7d)', v: '389', c: S.text },
          { l: 'Booked (7d)', v: '257', c: S.green },
          { l: 'Missed (7d)', v: '44', c: S.red },
          { l: 'Avg Handle Time', v: '2m 14s', c: S.yellow },
          { l: 'Peak Hour', v: '3:00 PM', c: S.purple },
          { l: 'CSAT Score', v: '4.7/5', c: S.accent },
        ].map(k => (
          <div key={k.l} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: S.text2, marginBottom: 8 }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Weekly Grouped Bar Chart */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Weekly Call Performance</h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: S.text2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: S.accent, display: 'inline-block' }} />Total Calls</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: S.green, display: 'inline-block' }} />Booked</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: S.red, display: 'inline-block' }} />Missed</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {weeklyData.map(d => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 130, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                <div style={{ flex: 1, height: `${(d.calls/maxCalls)*100}%`, background: S.accent, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                <div style={{ flex: 1, height: `${(d.booked/maxCalls)*100}%`, background: S.green, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                <div style={{ flex: 1, height: `${(d.missed/maxCalls)*100}%`, background: S.red, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: S.text2 }}>{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Language Breakdown */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 16 }}>Language Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {langData.map(l => (
              <div key={l.lang}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{l.lang}</span>
                  <span style={{ fontWeight: 700, color: l.color }}>{l.pct}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${l.pct}%`, height: '100%', background: l.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours Heatmap */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, fontSize: 16 }}>Call Volume by Hour</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130 }}>
            {peakHours.map(h => (
              <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: `${h.load}%`, background: h.load > 80 ? S.red : h.load > 60 ? S.yellow : S.accent, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
                <span style={{ fontSize: 9, color: S.text2, transform: 'rotate(-45deg)', transformOrigin: 'center', display: 'block', marginTop: 4 }}>{h.hour}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: S.red, display: 'inline-block' }} />High (&gt;80%)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: S.yellow, display: 'inline-block' }} />Medium</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: S.accent, display: 'inline-block' }} />Low</span>
          </div>
        </div>
      </div>
    </div>
  )
}
