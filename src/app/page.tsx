import Link from "next/link";
import CostCalculator from "./components/CostCalculator";
import AudioDemo from "./components/AudioDemo";
import Pricing from "./components/Pricing";
export default function LandingPage() {
  return (
    <>
      {/* ── NAVBAR ─────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', padding: '6px 12px', borderRadius: '10px' }}>
            <img 
              src="/logo.png" 
              alt="Vocaldice AI Logo" 
              style={{
                height: '42px', 
                width: 'auto', 
                filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.22)) drop-shadow(0px 0px 2px rgba(0,0,0,0.15))'
              }} 
            />
          </Link>

          <ul className="nav-links">
            <li><a href="#problem">The Problem</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#preview">Preview</a></li>
          </ul>

          <div className="nav-actions">
            <Link href="/login" className="nav-login">Log In</Link>
            <Link href="/signup" className="nav-cta">Sign Up Free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────── */}
      <section className="hero">
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
        <div className="hero-inner">
          {/* Left: copy */}
          <div className="hero-content">
            <span className="badge">
              <span className="dot-pulse" />
              AI Medical Receptionist
            </span>

            <h1 className="hero-h1">
              Never Miss<br/>
              Another{" "}
              <span className="gradient-text">Patient Call</span>
            </h1>

            <p className="hero-sub">
              The AI receptionist that answers every call, books appointments, and handles patient inquiries — perfectly, <strong style={{ color: "var(--accent)" }}>24/7</strong>.
            </p>

            <div className="hero-ctas">
              <Link href="/signup" className="btn-primary">
                Get Started Free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <a href="#audio-demo" className="btn-secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Listen to Demo
              </a>
            </div>

            <div className="hero-trust">
              <div className="hero-trust-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                No credit card required
              </div>
              <div className="hero-trust-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                HIPAA Compliant
              </div>
              <div className="hero-trust-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Setup in 5 minutes
              </div>
            </div>
          </div>

          {/* Right: Product Mockup */}
          <div className="hero-mock">
            <div className="mock-topbar">
              <div className="mock-dots">
                <div className="mock-dot red" />
                <div className="mock-dot yellow" />
                <div className="mock-dot green" />
              </div>
              <div className="mock-status">
                <span className="dot-live" />
                Live Call Active
              </div>
            </div>
            <div className="mock-body">
              {/* Caller ID */}
              <div className="mock-caller">
                <div className="mock-caller-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2.84h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.45a16 16 0 0 0 6.09 6.09l1.27-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <div className="mock-caller-name">Ramesh Kumar</div>
                  <div className="mock-caller-num">+91 98765 XXXXX</div>
                </div>
              </div>

              {/* Chat */}
              <div className="chat-ai">
                "Sunrise Clinic. How can I help you today?"
              </div>
              <div className="chat-patient">
                "I need to book a checkup with Dr. Sharma for tomorrow"
              </div>
              <div className="chat-ai">
                "Dr. Sharma has openings tomorrow at 10:00 AM. Shall I book that for you?"
              </div>

              {/* Booking confirmation */}
              <div className="mock-booking">
                <div className="mock-booking-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <div className="mock-booking-label">✓ Appointment Confirmed</div>
                  <div className="mock-booking-val">Dr. Sharma — Tomorrow 10:00 AM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM SECTION ─────────────────────── */}
      <section id="problem" className="section section-border">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow" style={{ color: "var(--orange)" }}>The Problem</span>
            <h2 className="section-h2">
              Missed Calls are{" "}
              <span className="gradient-text-warm">Lost Revenue</span>
            </h2>
            <p className="section-sub">
              If your clinic can&apos;t answer the phone, patients call the next available option on Google.
            </p>
          </div>

          <div className="grid-3">
            <div className="card">
              <div className="card-icon" style={{ background: "rgba(234,88,12,0.1)", borderColor: "rgba(234,88,12,0.2)", color: "var(--orange)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 2.84h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.45a16 16 0 0 0 6.09 6.09l1.27-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <h3 className="card-h3">Up to 30% Missed</h3>
              <p className="card-p">Staff can&apos;t answer every call during peak hours while also managing in-person patients at the desk.</p>
            </div>

            <div className="card">
              <div className="card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3 className="card-h3">No After-Hours Coverage</h3>
              <p className="card-p">Patients experience symptoms and call at all hours. An empty front desk means permanently lost opportunities.</p>
            </div>

            <div className="card">
              <div className="card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 className="card-h3">Slow Follow-ups</h3>
              <p className="card-p">Manual callbacks are inconsistent. Lead conversion drops drastically after just 5 minutes of waiting.</p>
            </div>
          </div>

          <div className="outcome-banner">
            <p>
              "Our AI receptionist answers every call instantly and turns more callers into booked patients."
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────── */}
      <section id="how-it-works" className="section section-alt section-border">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">How It Works</span>
            <h2 className="section-h2">Set Up in Minutes</h2>
            <p className="section-sub">Three simple steps to automate your clinic&apos;s front desk.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-num">01</span>
              <div className="step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
              </div>
              <h3 className="step-h3">Connect Clinic Details</h3>
              <p className="step-p">Input your clinic&apos;s services, doctors, and scheduling rules into our easy-to-use dashboard.</p>
            </div>

            <div className="step-card">
              <span className="step-num">02</span>
              <div className="step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </div>
              <h3 className="step-h3">AI Answers and Handles Calls</h3>
              <p className="step-p">It answers every call instantly and speaks naturally. No patient will ever hear a missed ring again.</p>
            </div>

            <div className="step-card">
              <span className="step-num">03</span>
              <div className="step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h3 className="step-h3">Appointments Booked Automatically</h3>
              <p className="step-p">Confirmed bookings sync directly to your calendar in real-time. Zero admin effort required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT PREVIEW ─────────────────────── */}
      <section id="preview" className="section section-border">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Dashboard</span>
            <h2 className="section-h2">See It in Action</h2>
            <p className="section-sub">Everything you need to track calls and bookings, in one clean dashboard.</p>
          </div>

          <div className="preview-grid">
            {/* Stats */}
            <div className="card">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Performance Analytics
              </h3>
              <div className="stat-row">
                <span className="stat-label">Total Calls Handled</span>
                <span className="stat-val">142</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Appointments Booked</span>
                <span className="stat-val green">45</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">AI Resolution Rate</span>
                <span className="stat-val purple">96%</span>
              </div>
            </div>

            {/* Call Flow */}
            <div className="card">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Call Flow Visualization
              </h3>
              <div className="flow-step">
                <div className="flow-step-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div className="flow-step-title">Call Answered</div>
                  <div className="flow-step-sub">Instant pickup — 0 rings</div>
                </div>
              </div>
              <div className="flow-step">
                <div className="flow-step-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div className="flow-step-title">Intent Recognized</div>
                  <div className="flow-step-sub">Patient wants to book</div>
                </div>
              </div>
              <div className="flow-step">
                <div className="flow-step-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div className="flow-step-title">Action Complete</div>
                <div className="flow-step-sub">Scheduled &amp; patient auto-notified</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COST CALCULATOR */}
      <CostCalculator />

      {/* AUDIO DEMO */}
      <AudioDemo />

      {/* PRICING */}
      <Pricing />

      {/* ── SOCIAL PROOF ────────────────────────── */}
      <section className="section section-alt section-border">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow" style={{ color: "var(--emerald)" }}>Testimonials</span>
            <h2 className="section-h2">Trusted by Growing Clinics</h2>
          </div>

          <div className="testimonials-grid">
            {[
              { quote: "We stopped missing calls completely. Bookings increased within the first week.", name: "Sarah Jenkins", role: "Clinic Manager, Wellness First" },
              { quote: "The AI sounds so natural. Half of our patients don't even realise they're speaking to AI.", name: "Dr. David Chen", role: "Owner, Chen Family Practice" },
              { quote: "A complete lifesaver. We finally have time to focus on patients who are actually in front of us.", name: "Elena Rodriguez", role: "Lead Receptionist, Prime Health" }
            ].map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="stars">
                  {[1,2,3,4,5].map(s => <span key={s} className="star">★</span>)}
                </div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div>
                  <div className="testimonial-author-name">{t.name}</div>
                  <div className="testimonial-author-role">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────── */}
      <section className="cta-section section-border">
        <div className="cta-glow" />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div className="cta-box">
            <h2>Start Capturing Every Patient Call</h2>
            <p>Set up your AI receptionist in minutes. No technical skills required.</p>
            <Link href="/signup" className="btn-primary" style={{ fontSize: "18px", padding: "16px 40px" }}>
              Create Your Account
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <p className="cta-note">14-day free trial · No credit card required · Cancel anytime</p>
          </div>

        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="footer">
        <div className="footer-inner">
          <div style={{ display: "flex", alignItems: "center" }}>
            <img 
              src="/logo.png" 
              alt="Vocaldice AI Logo" 
              style={{
                height: '24px', 
                width: 'auto', 
                filter: 'grayscale(100%) opacity(0.7) drop-shadow(0px 1px 2px rgba(0,0,0,0.05))',
              }} 
            />
          </div>
          <div className="footer-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <span className="footer-copy">© 2026 Vocaldice. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
