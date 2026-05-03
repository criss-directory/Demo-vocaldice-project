'use client';

import { useState } from 'react';
import OnboardingModal from './OnboardingModal';

export default function GetStartedButton({ label = 'Get Started Free', style }: { label?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-primary"
        style={style}
      >
        {label}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      {open && <OnboardingModal onClose={() => setOpen(false)} />}
    </>
  );
}
