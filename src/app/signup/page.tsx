'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

const S = { bg: '#F0F4F8', card: '#FFFFFF', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8' }

export default function Signup() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '', clinicName: '', email: '', phone: '', password: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { name: formData.name, clinic_name: formData.clinicName, phone: formData.phone }
        }
      })
      if (signUpError) {
        setError(signUpError.message)
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: S.bg, border: `1px solid ${S.border}`,
    borderRadius: '10px', padding: '12px 16px', fontSize: '15px', color: S.text, outline: 'none',
    transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', color: S.text2, fontSize: '12px', fontWeight: 600,
    marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '28px', background: '#F8FAFC', padding: '14px 28px', borderRadius: '16px', border: `1px solid ${S.border}` }}>
            <img
              src="/logo.png"
              alt="Vocaldice Logo"
              style={{
                height: '54px', width: 'auto',
                filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.22)) drop-shadow(0px 0px 2px rgba(0,0,0,0.15))'
              }}
            />
          </Link>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: S.text, marginBottom: '6px' }}>Create your account</h1>
          <p style={{ color: S.text2, fontSize: '14px' }}>Join Vocaldice and automate your front desk</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '32px' }}>
          {error && (
            <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '9px', padding: '12px 14px', marginBottom: '20px', color: '#DC2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Your Name</label>
            <input required type="text" placeholder="Dr. Sarah Jenkins"
              value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = S.accent)}
              onBlur={e => (e.target.style.borderColor = S.border)} />
          </div>

          {/* Clinic Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Clinic Name</label>
            <input required type="text" placeholder="Sunrise Family Clinic"
              value={formData.clinicName} onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = S.accent)}
              onBlur={e => (e.target.style.borderColor = S.border)} />
          </div>

          {/* Email + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input required type="email" placeholder="doctor@clinic.com"
                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = S.accent)}
                onBlur={e => (e.target.style.borderColor = S.border)} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input required type="tel" placeholder="+91 98765 43210"
                value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = S.accent)}
                onBlur={e => (e.target.style.borderColor = S.border)} />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input required type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                style={{ ...inputStyle, paddingRight: '46px' }}
                onFocus={e => (e.target.style.borderColor = S.accent)}
                onBlur={e => (e.target.style.borderColor = S.border)} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: S.text2 }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', background: loading ? '#7BB3C0' : S.accent, color: '#fff', border: 'none',
              borderRadius: '10px', padding: '13px', fontWeight: 700, fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(8,145,178,0.3)',
            }}>
            {loading ? (
              <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Creating account...</>
            ) : 'Create Account'}
          </button>

          <p style={{ textAlign: 'center', color: S.text2, fontSize: '14px', marginTop: '20px' }}>
            Already have an account? <Link href="/login" style={{ color: S.accent, textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
