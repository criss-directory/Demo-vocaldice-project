'use client'
import { CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react'

const S = { card: '#FFFFFF', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B' }

const integrations = [
  {
    name: 'Google Calendar',
    desc: 'Sync appointments directly to Google Calendar and send automatic reminders.',
    icon: '📅',
    status: 'coming_soon',
    category: 'Calendar',
  },
  {
    name: 'Microsoft Outlook',
    desc: 'Connect with Outlook calendar for appointment management and scheduling.',
    icon: '📧',
    status: 'coming_soon',
    category: 'Calendar',
  },
  {
    name: 'Zoho CRM',
    desc: 'Push patient records and appointment data into your Zoho CRM pipeline.',
    icon: '🏢',
    status: 'coming_soon',
    category: 'CRM',
  },
  {
    name: 'Salesforce',
    desc: 'Sync caller data and lead information directly into Salesforce.',
    icon: '☁️',
    status: 'coming_soon',
    category: 'CRM',
  },
  {
    name: 'WhatsApp Business',
    desc: 'Send appointment confirmations and reminders via WhatsApp.',
    icon: '💬',
    status: 'coming_soon',
    category: 'Messaging',
  },
  {
    name: 'SMS / Twilio',
    desc: 'Send SMS confirmations and recall messages to patients automatically.',
    icon: '📱',
    status: 'coming_soon',
    category: 'Messaging',
  },
  {
    name: 'Practo',
    desc: 'Sync appointment slots and patient data with the Practo platform.',
    icon: '🏥',
    status: 'coming_soon',
    category: 'Healthcare',
  },
  {
    name: 'DocPrime',
    desc: 'Integrate with DocPrime for patient management and billing.',
    icon: '💊',
    status: 'coming_soon',
    category: 'Healthcare',
  },
  {
    name: 'Razorpay',
    desc: 'Accept online consultation payments and send receipts automatically.',
    icon: '💳',
    status: 'coming_soon',
    category: 'Payments',
  },
]

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  connected:   { label: 'Connected',   color: '#10b981', icon: CheckCircle },
  available:   { label: 'Available',   color: '#2F80ED', icon: Zap },
  coming_soon: { label: 'Coming Soon', color: '#8A9BC0', icon: Clock },
}

const categories = ['All', ...Array.from(new Set(integrations.map(i => i.category)))]

export default function IntegrationsPage() {
  return (
    <div style={{ color: S.text }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Integrations</h1>
        <p style={{ color: S.text2, fontSize: 14, marginTop: 4 }}>Connect Vocaldice with your existing tools and workflows</p>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {categories.map(c => (
          <span key={c} style={{ padding: '6px 14px', borderRadius: 20, background: c === 'All' ? S.accent : 'rgba(255,255,255,0.05)', border: `1px solid ${c === 'All' ? S.accent : S.border}`, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: S.text }}>
            {c}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {integrations.map(intg => {
          const cfg = statusConfig[intg.status]
          const Ico = cfg.icon
          return (
            <div key={intg.name} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 28 }}>{intg.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{intg.name}</div>
                    <div style={{ fontSize: 11, color: S.text2, marginTop: 2 }}>{intg.category}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                  <Ico size={13} />
                  {cfg.label}
                </div>
              </div>
              <p style={{ fontSize: 13, color: S.text2, lineHeight: 1.55, margin: 0 }}>{intg.desc}</p>
              <button style={{
                padding: '9px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: intg.status === 'coming_soon' ? 'not-allowed' : 'pointer',
                background: intg.status === 'connected' ? 'rgba(16,185,129,0.1)' : intg.status === 'available' ? 'rgba(47,128,237,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${intg.status === 'connected' ? '#10b98133' : intg.status === 'available' ? '#2F80ED33' : S.border}`,
                color: intg.status === 'connected' ? '#10b981' : intg.status === 'available' ? S.accent : S.text2,
                opacity: intg.status === 'coming_soon' ? 0.7 : 1,
              }}>
                {intg.status === 'connected' ? 'Manage Connection' : intg.status === 'available' ? 'Connect Now' : 'Coming Soon'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
