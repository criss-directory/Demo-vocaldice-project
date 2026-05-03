'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Bot, Zap, Phone, FileText, Calendar, LogOut, Menu, X, ChevronRight, Mic } from 'lucide-react'
import OnboardingWizard from '@/components/OnboardingWizard'

const S = { bg: '#F0F4F8', sidebar: '#FFFFFF', card: '#FFFFFF', border: '#E2E8F0', accent: '#0891B2', text: '#1E293B', text2: '#64748B', text3: '#94A3B8' }

const navItems = [
  { href: '/dashboard/appointments', icon: Calendar,        label: 'Clinic Dashboard' },
  { href: '/dashboard/agents',       icon: Bot,             label: 'My Agents' },
  { href: '/dashboard/integrations', icon: Zap,             label: 'Integrations' },
  { href: '/dashboard/phone',        icon: Phone,           label: 'Phone Numbers' },
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Analytics' },
  { href: '/dashboard/calls',        icon: FileText,        label: 'Call Logs' },
]



export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string; clinic_name?: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const loadUser = useCallback(async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) { router.push('/login'); return }
      setUser({ email: session.user.email, clinic_name: session.user.user_metadata?.clinic_name || 'My Clinic' })

      // Check if user has any agents; if 0, pop up wizard automatically
      const { count } = await supabase.from('agents').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id)
      if (count === 0) {
        setShowOnboarding(true)
      }
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => { loadUser() }, [loadUser])

  useEffect(() => {
    const handleOpen = () => setShowOnboarding(true)
    window.addEventListener('open-onboarding', handleOpen)
    return () => window.removeEventListener('open-onboarding', handleOpen)
  }, [])

  async function handleLogout() {
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleOnboardingComplete = (agentId?: string) => {
    setShowOnboarding(false)
    window.dispatchEvent(new CustomEvent('agent-created'))
    if (agentId) {
      router.push(`/dashboard/agents/${agentId}`)
    }
  }

  return (
    <div className="dashboard-root" style={{ display: 'flex', minHeight: '100vh', background: S.bg }}>
      {/* Desktop sidebar */}
      <aside style={{ width: '232px', flexShrink: 0, background: S.sidebar, borderRight: `1px solid ${S.border}`, boxShadow: '2px 0 12px rgba(0,0,0,0.04)', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '24px 18px 20px', borderBottom: `1px solid ${S.border}`, background: '#F8FAFC' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="/logo.png" 
              alt="Vocaldice Logo" 
              style={{
                height: '40px', 
                width: 'auto', 
                filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.22)) drop-shadow(0px 0px 2px rgba(0,0,0,0.15))'
              }} 
            />
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px' }}>
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '9px', marginBottom: '2px', textDecoration: 'none', background: active ? 'rgba(8,145,178,0.08)' : 'transparent', color: active ? S.accent : S.text2, fontWeight: active ? 600 : 400, fontSize: '14px', transition: 'all 0.18s', border: active ? '1px solid rgba(8,145,178,0.15)' : '1px solid transparent' }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(8,145,178,0.04)'; (e.currentTarget as HTMLElement).style.color = S.text } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = S.text2 } }}>
                <item.icon size={16} />
                {item.label}
                {active && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '14px 10px', borderTop: `1px solid ${S.border}` }}>
          <div style={{ padding: '10px 12px', borderRadius: '9px', background: '#F8FAFC', border: '1px solid #E2E8F0', marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.clinic_name}</div>
            <div style={{ fontSize: '11px', color: S.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{user?.email}</div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', background: 'none', border: 'none', color: S.text2, cursor: 'pointer', borderRadius: '9px', fontSize: '13px', transition: 'all 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.06)'; (e.currentTarget as HTMLElement).style.color = '#DC2626' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = S.text2 }}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />}

      {/* Main */}
      <div style={{ flex: 1, marginLeft: '232px', minWidth: 0 }}>
        {/* Mobile topbar */}
        <div style={{ background: S.sidebar, borderBottom: `1px solid ${S.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '0 20px', height: '54px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: S.text2, cursor: 'pointer' }}><Menu size={22} /></button>
          <span style={{ fontWeight: 700, fontSize: '15px', color: S.text }}>{navItems.find(n => n.href === pathname)?.label || 'Dashboard'}</span>
          {sidebarOpen && <button onClick={() => setSidebarOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: S.text2, cursor: 'pointer' }}><X size={20} /></button>}
        </div>

        <div style={{ padding: '28px 32px' }}>
          {children}
        </div>
      </div>

      <OnboardingWizard 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
        onComplete={handleOnboardingComplete}
      />
    </div>
  )
}
