'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  preview_url?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface FormData {
  // Step 1
  clinicName: string;
  clinicType: string;
  services: string[];
  numDoctors: string;
  openTime: string;
  closeTime: string;
  // Step 2
  language: string;
  selectedVoiceId: string;
  backgroundNoise: boolean;
  toneOfVoice: string;
  // Step 3
  useCases: string[];
  faqs: FAQ[];
  systemPrompt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CLINIC_TYPES = ['General Practice', 'Dental', 'Dermatology', 'Cosmetic', 'Pediatrics', 'Orthopedics', 'Other'];
const SERVICE_OPTIONS = ['Consultations', 'Appointments', 'Emergencies', 'Lab Tests', 'Vaccinations', 'Follow-ups', 'Walk-ins', 'Surgery', 'Physiotherapy'];
const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' }, { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' }, { code: 'kn', label: 'Kannada' }, { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' }, { code: 'bn', label: 'Bengali' }, { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' }, { code: 'es', label: 'Spanish' }, { code: 'ar', label: 'Arabic' },
];
const USE_CASES = [
  { id: 'booking', label: 'Appointment Booking', icon: '📅' },
  { id: 'after_hours', label: 'After-Hours Handling', icon: '🌙' },
  { id: 'faq', label: 'FAQ Handling', icon: '❓' },
  { id: 'lead_qual', label: 'Lead Qualification', icon: '🎯' },
];
const TONES = ['Professional', 'Friendly', 'Calm'];

// ── API Placeholder ──────────────────────────────────────────────────────────
async function fetchVoices(language: string): Promise<Voice[]> {
  // Replace this with: GET https://api.cartesia.ai/voices?language={language}
  // Headers: { Authorization: `Bearer ${API_KEY}`, 'Cartesia-Version': '2026-03-01' }
  await new Promise(r => setTimeout(r, 800)); // Simulate network delay
  return [
    { id: 'v1', name: 'Aria', language, gender: 'feminine', preview_url: '' },
    { id: 'v2', name: 'Marcus', language, gender: 'masculine', preview_url: '' },
    { id: 'v3', name: 'Nova', language, gender: 'feminine', preview_url: '' },
    { id: 'v4', name: 'Cole', language, gender: 'masculine', preview_url: '' },
    { id: 'v5', name: 'Luna', language, gender: 'gender_neutral', preview_url: '' },
  ];
}

function generatePrompt(data: FormData): string {
  const useCaseLabels = USE_CASES.filter(u => data.useCases.includes(u.id)).map(u => u.label).join(', ');
  const faqSection = data.faqs.filter(f => f.question && f.answer)
    .map((f, i) => `Q${i+1}: ${f.question}\nA: ${f.answer}`).join('\n\n');
  return `You are an AI medical receptionist for ${data.clinicName || 'the clinic'}${data.clinicType ? `, a ${data.clinicType} clinic` : ''}. ` +
    `Your tone is ${data.toneOfVoice.toLowerCase()}. ` +
    `You are available ${data.openTime && data.closeTime ? `from ${data.openTime} to ${data.closeTime}` : 'during clinic hours'}.` +
    (useCaseLabels ? `\n\nYour primary responsibilities include: ${useCaseLabels}.` : '') +
    (faqSection ? `\n\nFAQ Knowledge Base:\n${faqSection}` : '') +
    `\n\nAlways greet callers warmly and efficiently route them to the right outcome. Never pretend to be human if directly asked.`;
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>Step {step} of {total}</span>
        <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{Math.round((step / total) * 100)}% complete</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(step / total) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius: '99px', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 600, color: i + 1 <= step ? 'var(--accent)' : 'var(--text3)' }}>
            {['Clinic Info', 'Voice & AI', 'Behavior'][i]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Input Components ─────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
  color: 'var(--text)', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px', display: 'block' };
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' };

// ── Step 1 ────────────────────────────────────────────────────────────────────
function Step1({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: unknown) => void }) {
  const [serviceInput, setServiceInput] = useState('');

  const addService = (s: string) => {
    if (s && !data.services.includes(s)) onChange('services', [...data.services, s]);
    setServiceInput('');
  };
  const removeService = (s: string) => onChange('services', data.services.filter(x => x !== s));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={fieldStyle}>
        <label style={labelStyle}>Clinic Name *</label>
        <input style={inputStyle} placeholder="e.g. Sunrise Family Clinic" value={data.clinicName} onChange={e => onChange('clinicName', e.target.value)} />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Clinic Type *</label>
        <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.clinicType} onChange={e => onChange('clinicType', e.target.value)}>
          <option value="">Select type...</option>
          {CLINIC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Services Offered</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          {SERVICE_OPTIONS.map(s => (
            <button key={s} onClick={() => data.services.includes(s) ? removeService(s) : addService(s)}
              style={{ padding: '5px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: data.services.includes(s) ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: data.services.includes(s) ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)',
                color: data.services.includes(s) ? '#C4B5FD' : 'var(--text2)',
              }}>
              {s}
            </button>
          ))}
        </div>
        <input style={inputStyle} placeholder="Add custom service..." value={serviceInput}
          onChange={e => setServiceInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addService(serviceInput)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Number of Doctors</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.numDoctors} onChange={e => onChange('numDoctors', e.target.value)}>
            <option value="">Select...</option>
            {['1', '2-5', '6-10', '10+'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Clinic Hours</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="time" style={{ ...inputStyle, flex: 1 }} value={data.openTime} onChange={e => onChange('openTime', e.target.value)} />
            <span style={{ color: 'var(--text3)', fontSize: '12px' }}>to</span>
            <input type="time" style={{ ...inputStyle, flex: 1 }} value={data.closeTime} onChange={e => onChange('closeTime', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function Step2({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: unknown) => void }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const loadVoices = async (lang: string) => {
    setLoading(true); setVoices([]); onChange('selectedVoiceId', '');
    const v = await fetchVoices(lang);
    setVoices(v); setLoading(false);
  };

  useEffect(() => { if (data.language) loadVoices(data.language); }, []);// eslint-disable-line

  const handleLangChange = (lang: string) => { onChange('language', lang); loadVoices(lang); };

  const playPreview = (voice: Voice) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === voice.id) { setPlayingId(null); return; }
    if (voice.preview_url) {
      const audio = new Audio(voice.preview_url);
      audio.play().catch(() => {});
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
    }
    setPlayingId(voice.id);
  };

  const genderIcon = (g?: string) => g === 'feminine' ? '♀' : g === 'masculine' ? '♂' : '⊹';
  const genderColor = (g?: string) => g === 'feminine' ? '#F472B6' : g === 'masculine' ? '#60A5FA' : '#A3E635';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Language */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>A · Language</div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Primary Language</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={data.language} onChange={e => handleLangChange(e.target.value)}>
            <option value="">Select language...</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Voices */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>B · Voice Selection</div>
        <label style={labelStyle}>Choose your AI receptionist's voice</label>
        {!data.language && <p style={{ fontSize: '13px', color: 'var(--text3)', fontStyle: 'italic' }}>Select a language first to load available voices.</p>}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', color: 'var(--text3)', fontSize: '13px' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Fetching voices...
          </div>
        )}
        {!loading && voices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {voices.map(voice => (
              <div key={voice.id} onClick={() => onChange('selectedVoiceId', voice.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s',
                  border: '1px solid', background: data.selectedVoiceId === voice.id ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                  borderColor: data.selectedVoiceId === voice.id ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)',
                }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, color: genderColor(voice.gender) }}>
                  {genderIcon(voice.gender)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{voice.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'capitalize' }}>{voice.gender?.replace('_', ' ') || 'Neutral'}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); playPreview(voice); }}
                  style={{ padding: '6px 12px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: playingId === voice.id ? 'var(--accent)' : 'var(--text2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
                  {playingId === voice.id ? '⏸ Pause' : '▶ Preview'}
                </button>
                {data.selectedVoiceId === voice.id && (
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', flexShrink: 0 }}>✓</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>C · Voice Preferences</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Background Clinic Noise</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>Subtle ambient sound to feel more natural</div>
            </div>
            <button onClick={() => onChange('backgroundNoise', !data.backgroundNoise)}
              style={{ width: '44px', height: '24px', borderRadius: '99px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                background: data.backgroundNoise ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }}>
              <div style={{ position: 'absolute', top: '2px', left: data.backgroundNoise ? '22px' : '2px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </button>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Tone of Voice</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TONES.map(t => (
                <button key={t} onClick={() => onChange('toneOfVoice', t)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                    background: data.toneOfVoice === t ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: data.toneOfVoice === t ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)',
                    color: data.toneOfVoice === t ? '#C4B5FD' : 'var(--text2)',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function Step3({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: unknown) => void }) {
  const toggleUseCase = (id: string) => {
    const next = data.useCases.includes(id) ? data.useCases.filter(u => u !== id) : [...data.useCases, id];
    onChange('useCases', next);
    // Regenerate prompt
    setTimeout(() => onChange('systemPrompt', generatePrompt({ ...data, useCases: next })), 50);
  };

  const updateFAQ = (idx: number, field: 'question' | 'answer', val: string) => {
    const updated = data.faqs.map((f, i) => i === idx ? { ...f, [field]: val } : f);
    onChange('faqs', updated);
    onChange('systemPrompt', generatePrompt({ ...data, faqs: updated }));
  };
  const addFAQ = () => onChange('faqs', [...data.faqs, { question: '', answer: '' }]);
  const removeFAQ = (idx: number) => onChange('faqs', data.faqs.filter((_, i) => i !== idx));

  useEffect(() => {
    onChange('systemPrompt', generatePrompt(data));
  }, []); // eslint-disable-line

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Use Cases */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>A · Use Cases</div>
        <label style={labelStyle}>What should your AI agent do? (Select all that apply)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {USE_CASES.map(u => (
            <button key={u.id} onClick={() => toggleUseCase(u.id)}
              style={{ padding: '14px', borderRadius: '12px', border: '1px solid', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                background: data.useCases.includes(u.id) ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                borderColor: data.useCases.includes(u.id) ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)',
              }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{u.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: data.useCases.includes(u.id) ? '#C4B5FD' : 'var(--text)' }}>{u.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>B · FAQ Knowledge Base</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.faqs.map((faq, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', position: 'relative' }}>
              {data.faqs.length > 1 && (
                <button onClick={() => removeFAQ(idx)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
              )}
              <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder={idx === 0 ? 'Q: What are your clinic hours?' : 'Question'} value={faq.question} onChange={e => updateFAQ(idx, 'question', e.target.value)} />
              <input style={inputStyle} placeholder={idx === 0 ? 'A: We are open Mon-Sat, 9AM to 7PM.' : 'Answer'} value={faq.answer} onChange={e => updateFAQ(idx, 'answer', e.target.value)} />
            </div>
          ))}
          <button onClick={addFAQ}
            style={{ padding: '10px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', background: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}>
            + Add Question
          </button>
        </div>
      </div>

      {/* Prompt Preview */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>C · Agent Prompt Preview</div>
        <label style={labelStyle}>This is how your AI will behave during calls</label>
        <textarea
          value={data.systemPrompt}
          onChange={e => onChange('systemPrompt', e.target.value)}
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6', fontSize: '13px' }}
        />
        <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>Auto-generated from your inputs. You can edit this freely.</p>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<FormData>({
    clinicName: '', clinicType: '', services: [], numDoctors: '', openTime: '09:00', closeTime: '18:00',
    language: 'en', selectedVoiceId: '', backgroundNoise: false, toneOfVoice: 'Professional',
    useCases: ['booking'], faqs: [{ question: '', answer: '' }], systemPrompt: '',
  });

  const update = (key: keyof FormData, val: unknown) => setData(prev => ({ ...prev, [key]: val }));

  const canProceed = () => {
    if (step === 1) return data.clinicName.trim() !== '' && data.clinicType !== '';
    if (step === 2) return data.language !== '' && data.selectedVoiceId !== '';
    return data.useCases.length > 0 && data.faqs.some(f => f.question && f.answer);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // TODO: POST clinic + agent data to your backend
    await new Promise(r => setTimeout(r, 2500));
    router.push('/dashboard');
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000 }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1001, width: '100%', maxWidth: '600px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
        margin: '0 16px',
      }}>
        {/* Modal Header */}
        <div style={{ padding: '28px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
                {step === 1 && 'Tell us about your clinic'}
                {step === 2 && 'Set up your AI receptionist'}
                {step === 3 && 'Customize how your agent speaks'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text3)' }}>
                {step === 1 && 'Basic info to personalize your AI agent'}
                {step === 2 && 'Choose a voice and configure your AI'}
                {step === 3 && 'Define behaviors, FAQs, and tone'}
              </p>
            </div>
            <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'var(--text2)', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>
          <StepBar step={step} total={3} />
        </div>

        {/* Modal Body (scrollable) */}
        {!submitting ? (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 8px' }}>
              {step === 1 && <Step1 data={data} onChange={update} />}
              {step === 2 && <Step2 data={data} onChange={update} />}
              {step === 3 && <Step3 data={data} onChange={update} />}
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)}
                  style={{ padding: '11px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--text2)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                  ← Back
                </button>
              ) : <div />}
              <button
                disabled={!canProceed()}
                onClick={() => step < 3 ? setStep(s => s + 1) : handleSubmit()}
                style={{ padding: '12px 28px', background: canProceed() ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', color: canProceed() ? '#fff' : 'var(--text3)', fontWeight: 700, fontSize: '14px', cursor: canProceed() ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
                  boxShadow: canProceed() ? '0 4px 20px rgba(139,92,246,0.3)' : 'none' }}>
                {step < 3 ? 'Continue →' : '🚀 Generate My Agent'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 28px', gap: '20px' }}>
            <div style={{ width: '56px', height: '56px', border: '4px solid rgba(139,92,246,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>Setting up your AI receptionist...</h3>
            <p style={{ fontSize: '14px', color: 'var(--text3)', textAlign: 'center' }}>Configuring your voice agent and saving your clinic details.</p>
          </div>
        )}
      </div>
    </>
  );
}
