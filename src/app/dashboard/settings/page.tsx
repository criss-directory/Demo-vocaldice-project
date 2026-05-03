'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, AlertTriangle, Loader2 } from 'lucide-react'

const S = { bg: '#0B1120', card: '#111D35', card2: '#162040', border: '#1E2D4E', accent: '#2F80ED', text: '#F0F4FF', text2: '#8A9BC0', text3: '#4A6080', error: '#EF4444', success: '#22C55E' }
const inp: React.CSSProperties = { width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: S.text, outline: 'none' }

export default function SettingsPage() {
  const [profile, setProfile] = useState({ fullName: '', clinicName: '', phone: '', email: '' })
  const [passwords, setPasswords] = useState({ current: '', newPw: '', confirm: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [error, setError] = useState('')
  const [pwError, setPwError] = useState('')

  const load = useCallback(async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const u = session.user
      setProfile({ fullName: u.user_metadata?.full_name || '', clinicName: u.user_metadata?.clinic_name || '', phone: u.user_metadata?.phone || '', email: u.email || '' })
    } catch (_) { } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.auth.updateUser({ data: { full_name: profile.fullName, clinic_name: profile.clinicName, phone: profile.phone } })
      if (error) { setError(error.message) } else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    } catch (_) { setError('Save failed.') } finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPwError('')
    if (passwords.newPw !== passwords.confirm) { setPwError('Passwords do not match'); return }
    if (passwords.newPw.length < 6) { setPwError('Password must be 6+ characters'); return }
    setPwSaving(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.auth.updateUser({ password: passwords.newPw })
      if (error) { setPwError(error.message) } else { setPwSaved(true); setPasswords({ current: '', newPw: '', confirm: '' }); setTimeout(() => setPwSaved(false), 2500) }
    } catch (_) { setPwError('Failed to update password.') } finally { setPwSaving(false) }
  }

  async function deleteAccount() {
    const confirmed = window.confirm('Are you absolutely sure? This will permanently delete your account and all data. This cannot be undone.')
    if (!confirmed) return
    const second = window.confirm('Last chance — this will delete everything including your agent configuration and call logs.')
    if (!second) return
    alert('To complete account deletion, please contact support@vocaldice.com')
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '13px', padding: '24px', marginBottom: '18px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: S.text, marginBottom: '18px', paddingBottom: '14px', borderBottom: `1px solid ${S.border}` }}>{title}</h2>
      {children}
    </div>
  )

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}><Loader2 size={28} color={S.accent} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={{ maxWidth: '620px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: S.text, marginBottom: '4px' }}>Settings</h1>
        <p style={{ color: S.text2, fontSize: '14px' }}>Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Section title="Account Information">
        <form onSubmit={saveProfile}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 13px', marginBottom: '16px', color: '#fca5a5', fontSize: '13px' }}>{error}</div>}
          {[['Full Name', 'fullName', 'text', 'Dr. Rajesh Kumar'], ['Clinic Name', 'clinicName', 'text', 'Sunshine Medical'], ['Phone', 'phone', 'tel', '+91 98765 43210']].map(([label, key, type, ph]) => (
            <div key={key} style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
              <input type={type} value={profile[key as keyof typeof profile]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={inp} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            </div>
          ))}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" value={profile.email} readOnly style={{ ...inp, color: S.text3, cursor: 'not-allowed' }} />
            <p style={{ fontSize: '11px', color: S.text3, marginTop: '4px' }}>Email cannot be changed here</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: saved ? 'rgba(34,197,94,0.15)' : S.accent, color: saved ? '#4ade80' : '#fff', border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none', borderRadius: '9px', padding: '11px 22px', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
            </button>
            <div style={{ background: 'rgba(47,128,237,0.08)', border: '1px solid rgba(47,128,237,0.2)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', color: S.accent, fontWeight: 600 }}>Starter Plan</div>
          </div>
        </form>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <form onSubmit={changePassword}>
          {pwError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 13px', marginBottom: '14px', color: '#fca5a5', fontSize: '13px' }}>{pwError}</div>}
          {pwSaved && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 13px', marginBottom: '14px', color: '#86efac', fontSize: '13px' }}>Password updated successfully!</div>}
          {[['New Password', 'newPw'], ['Confirm New Password', 'confirm']].map(([label, key]) => (
            <div key={key} style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: S.text2, fontSize: '11px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
              <input type="password" value={passwords[key as keyof typeof passwords]} onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))} placeholder="••••••••" minLength={6} style={inp} onFocus={e => (e.currentTarget.style.borderColor = S.accent)} onBlur={e => (e.currentTarget.style.borderColor = S.border)} />
            </div>
          ))}
          <button type="submit" disabled={pwSaving} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: S.card2, border: `1px solid ${S.border}`, color: S.text, borderRadius: '9px', padding: '11px 22px', fontWeight: 600, fontSize: '14px', cursor: pwSaving ? 'not-allowed' : 'pointer' }}>
            {pwSaving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null} Change Password
          </button>
        </form>
      </Section>

      {/* Danger zone */}
      <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '13px', padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <AlertTriangle size={16} color={S.error} />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: S.error }}>Danger Zone</h2>
        </div>
        <p style={{ color: S.text2, fontSize: '13px', marginBottom: '16px' }}>Deleting your account is permanent and cannot be undone. All your agent data, call logs, and settings will be erased.</p>
        <button onClick={deleteAccount} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '9px', padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Delete Account</button>
      </div>
    </div>
  )
}
