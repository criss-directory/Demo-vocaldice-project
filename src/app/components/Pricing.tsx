'use client';

import Link from 'next/link';

export default function Pricing() {
  return (
    <section id="pricing" className="section section-border">
      <div className="container">
        <div className="section-head">
          <span className="section-eyebrow" style={{ color: 'var(--accent)' }}>Credit Pack Pricing</span>
          <h2 className="section-h2">Start Saving Lost Revenue Today</h2>
          <p className="section-sub">Choose the credit pack that fits your clinic's call volume. No hidden fees.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', position: 'relative', zIndex: 1, alignItems: 'start' }}>
          
          {/* Tier 1: Starter */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '16px' }}>Starter</h3>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>₹2,999</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px', flex: 1 }}>
              {[
                <span key={0}><strong style={{ color: 'var(--text)' }}>430 minutes</strong> included</span>,
                '₹7 per minute',
                'Approximately 172 calls'
              ].map((feature, i) => (
                <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '15px', color: 'var(--text2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12"/></svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Start Free Trial</Link>
          </div>

          {/* Tier 2: Growth */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderColor: 'var(--accent)', background: 'linear-gradient(180deg, rgba(8,145,178,0.06) 0%, var(--bg-card) 100%)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-14px', left: '24px', background: 'var(--emerald)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '4px 12px', borderRadius: '50px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Popular
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '16px' }}>Growth</h3>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>₹5,999</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px', flex: 1 }}>
              {[
                <span key={0}><strong style={{ color: 'var(--text)' }}>923 minutes</strong> included</span>,
                '₹6.5 per minute',
                'Approximately 369 calls'
              ].map((feature, i) => (
                <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '15px', color: 'var(--text2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12"/></svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Get Started</Link>
          </div>

          {/* Tier 3: Pro */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderColor: 'var(--accent2)', background: 'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, var(--bg-card) 100%)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-14px', left: '24px', background: 'var(--accent2)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '4px 12px', borderRadius: '50px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Best Value
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '16px' }}>Pro</h3>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>₹9,999</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px', flex: 1 }}>
              {[
                <span key={0}><strong style={{ color: 'var(--text)' }}>2,222 minutes</strong> included</span>,
                '₹4.5 per minute',
                'Approximately 889 calls'
              ].map((feature, i) => (
                <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '15px', color: 'var(--text2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12"/></svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, var(--accent2), #3B82F6)', boxShadow: '0 4px 20px rgba(37,99,235,0.25)' }}>Get Started</Link>
          </div>

          {/* Tier 4: Enterprise */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '16px' }}>Enterprise</h3>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>Custom</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px', flex: 1 }}>
              {[
                <span key={0}><strong style={{ color: 'var(--text)' }}>Minimum 10,000 minutes</strong></span>,
                '₹4 per minute',
                'For hospital chains and multi-location clinics'
              ].map((feature, i) => (
                <li key={i} style={{ display: 'flex', gap: '12px', fontSize: '15px', color: 'var(--text2)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12"/></svg>
                  {feature}
                </li>
              ))}
            </ul>
            <a href="#contact" className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Contact Sales</a>
          </div>

        </div>
      </div>
    </section>
  );
}
