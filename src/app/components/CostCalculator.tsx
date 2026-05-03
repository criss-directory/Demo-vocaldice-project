'use client';

import { useState } from 'react';

export default function CostCalculator() {
  const [callsPerDay, setCallsPerDay] = useState(50);
  const [avgDuration, setAvgDuration] = useState(2); // in minutes

  const APPOINTMENT_VALUE = 1500;
  const APPOINTMENT_CONVERSION_RATE = 0.15; // 15% of calls result in booking

  // Derived metrics
  const monthlyMinutes = Math.round(callsPerDay * avgDuration * 30);
  const totalMonthlyCalls = callsPerDay * 30;

  // Calculate cost on each logic tier:
  // Starter: 2999 base, 430 included, 7/min
  const starterCost = 2999 + Math.max(0, monthlyMinutes - 430) * 7;
  // Growth: 5999 base, 923 included, 6.5/min
  const growthCost = 5999 + Math.max(0, monthlyMinutes - 923) * 6.5;
  // Pro: 9999 base, 2222 included, 4.5/min
  const proCost = 9999 + Math.max(0, monthlyMinutes - 2222) * 4.5;
  // Enterprise: 4/min, minimum 10000 min -> 40000 base
  const enterpriseCost = Math.max(10000, monthlyMinutes) * 4;

  let activePlan = 'Starter';
  let activeBase = 2999;
  let activeIncluded = 430;
  let activeOverageRate = 7;
  let activeTotal = starterCost;

  if (growthCost < activeTotal) { activePlan = 'Growth'; activeBase = 5999; activeIncluded = 923; activeOverageRate = 6.5; activeTotal = growthCost; }
  if (proCost < activeTotal) { activePlan = 'Pro'; activeBase = 9999; activeIncluded = 2222; activeOverageRate = 4.5; activeTotal = proCost; }
  if (enterpriseCost < activeTotal) { activePlan = 'Enterprise'; activeBase = Math.max(10000, monthlyMinutes) * 4; activeIncluded = Math.max(10000, monthlyMinutes); activeOverageRate = 4; activeTotal = enterpriseCost; }

  const overageMinutes = Math.max(0, monthlyMinutes - activeIncluded);
  const overageCost = overageMinutes * activeOverageRate;

  const totalMonthlyCost = activeTotal;

  const appointmentsCaptured = Math.round(totalMonthlyCalls * APPOINTMENT_CONVERSION_RATE);
  const revenueGenerated = appointmentsCaptured * APPOINTMENT_VALUE;
  
  const costCalcNetGain = Math.max(0, revenueGenerated - totalMonthlyCost);
  const costCalcROI = totalMonthlyCost > 0 ? (revenueGenerated / totalMonthlyCost).toFixed(1) : '0.0';

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  return (
    <section id="cost-calculator" className="section">
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="section-head" style={{ marginBottom: '40px' }}>
          <span className="section-eyebrow" style={{ color: 'var(--emerald)' }}>ROI Calculator</span>
          <h2 className="section-h2">
            Calculate Your <span style={{ color: 'var(--emerald)' }}>Monthly Cost</span>
          </h2>
          <p className="section-sub">See how much revenue you're losing to missed calls, and how affordable AI really is.</p>
        </div>

        <div className="card" style={{ padding: '40px' }}>
          
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginBottom: '40px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>How many calls per day?</label>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)' }}>{callsPerDay}</span>
              </div>
              <input 
                type="range" 
                min="20" max="150" step="1" 
                value={callsPerDay} 
                onChange={(e) => setCallsPerDay(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>Average call duration (minutes):</label>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent)' }}>{avgDuration} min</span>
              </div>
              <input 
                type="range" 
                min="1" max="5" step="0.5" 
                value={avgDuration} 
                onChange={(e) => setAvgDuration(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)', margin: '0 0 32px' }} />

          {/* Results Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            
            {/* Cost Breakdown */}
            <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--bg-border)', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>Cost Breakdown</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span>Monthly minutes</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{monthlyMinutes.toLocaleString('en-IN')} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span>Recommended Plan</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{activePlan}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span>Plan Base Cost</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatCurrency(activeBase)}</span>
                </div>
                {overageMinutes > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                    <span>Overage ({overageMinutes.toLocaleString('en-IN')}m @ ₹{activeOverageRate}/m)</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatCurrency(overageCost)}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                    <span>Overage</span>
                    <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>₹0</span>
                  </div>
                )}
                
                <hr style={{ border: 'none', borderTop: '1px dashed var(--bg-border)', margin: '8px 0' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Total Cost</span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent)' }}>{formatCurrency(totalMonthlyCost)}</span>
                </div>
              </div>
            </div>

            {/* ROI Estimate */}
            <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--emerald)' }}>ROI Estimate</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span style={{ color: 'rgba(16,185,129,0.8)' }}>Bookings / month</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{appointmentsCaptured.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span style={{ color: 'rgba(16,185,129,0.8)' }}>Gross Revenue</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatCurrency(revenueGenerated)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
                  <span style={{ color: 'rgba(16,185,129,0.8)' }}>Your Cost</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>-{formatCurrency(totalMonthlyCost)}</span>
                </div>
                
                <hr style={{ border: 'none', borderTop: '1px dashed rgba(16,185,129,0.3)', margin: '8px 0' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--emerald)' }}>Net Gain</span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--emerald)' }}>+{formatCurrency(costCalcNetGain)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(16,185,129,0.7)' }}>Return on Investment</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--emerald)' }}>{costCalcROI}x</span>
                </div>
              </div>
            </div>

          </div>

          <button 
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
          >
            Start Your Free Trial
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
          
        </div>
      </div>
    </section>
  );
}
