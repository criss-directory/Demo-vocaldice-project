'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mic, Eye, EyeOff } from 'lucide-react'

const S = { bg: '#F0F4F8', card: '#FFFFFF', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B' }

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const authPromise = supabase.auth.signInWithPassword({ email, password })
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please try again.')), 12000))
      const { error } = await Promise.race([authPromise, timeout])
      if (error) { 
        setError(error.message) 
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
    } finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: S.bg, border: `1px solid ${S.border}`,
    borderRadius: '10px', padding: '12px 16px', fontSize: '15px', color: S.text, outline: 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '28px', background: '#F8FAFC', padding: '14px 28px', borderRadius: '16px', border: `1px solid ${S.border}` }}>
            <img 
              src="/logo.png" 
              alt="Vocaldice Logo" 
              style={{
                height: '54px', 
                width: 'auto', 
                filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.22)) drop-shadow(0px 0px 2px rgba(0,0,0,0.15))'
              }} 
            />
          </Link>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: S.text, marginBottom: '6px' }}>Welcome back</h1>
          <p style={{ color: S.text2, fontSize: '14px' }}>Sign in to your Vocaldice dashboard</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '32px' }}>
          {error && (
            <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '9px', padding: '12px 14px', marginBottom: '20px', color: '#DC2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', color: S.text2, fontSize: '12px', fontWeight: 600, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@clinic.com" required
              style={inputStyle} onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', color: S.text2, fontSize: '12px', fontWeight: 600, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                style={{ ...inputStyle, paddingRight: '46px' }}
                onFocus={e => e.target.style.borderColor = S.accent} onBlur={e => e.target.style.borderColor = S.border} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: S.text2 }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: '22px' }}>
            <a href="#" style={{ color: S.accent, fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</a>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#7BB3C0' : S.accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '13px', fontWeight: 700, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 4px 16px rgba(8,145,178,0.3)' }}>
            {loading ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />Signing in...</> : 'Sign In'}
          </button>

          <p style={{ textAlign: 'center', color: S.text2, fontSize: '14px', marginTop: '20px' }}>
            Don&apos;t have an account? <Link href="/signup" style={{ color: S.accent, textDecoration: 'none', fontWeight: 600 }}>Sign up free</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
