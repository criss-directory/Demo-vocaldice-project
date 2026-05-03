'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, PhoneOff, Phone, Loader2 } from 'lucide-react'

const S = { bg: '#0B1120', card: '#111D35', card2: '#162040', border: '#1E2D4E', accent: '#2F80ED', text: '#F0F4FF', text2: '#8A9BC0', text3: '#4A6080', success: '#22C55E', error: '#EF4444' }

type Msg = { role: 'user' | 'assistant'; content: string; ts: string; lang?: string }
type Latency = { stt?: number; llm?: number; tts?: number }
type CallState = 'idle' | 'connecting' | 'active' | 'processing' | 'ended'

export default function LiveDemoPage() {
  const [callState, setCallState] = useState<CallState>('idle')
  const [transcript, setTranscript] = useState<Msg[]>([])
  const [muted, setMuted] = useState(false)
  const [detectedLang, setDetectedLang] = useState('—')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [latency, setLatency] = useState<Latency>({})

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const processingRef = useRef(false)
  const historyRef = useRef<{ role: string; content: string }[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  function ts() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

  async function playAudio(buf: ArrayBuffer) {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    const decoded = await ctx.decodeAudioData(buf.slice(0))
    const src = ctx.createBufferSource(); src.buffer = decoded; src.connect(ctx.destination); src.start(0)
    return new Promise<void>(res => { src.onended = () => res() })
  }

  const process = useCallback(async (blob: Blob) => {
    if (processingRef.current || blob.size < 1500) return
    processingRef.current = true; setCallState('processing')
    const t0 = Date.now()
    try {
      // STT
      setStatus('Listening...')
      const fd = new FormData(); fd.append('audio', blob, 'audio.webm')
      const sttRes = await fetch('/api/stt', { method: 'POST', body: fd })
      if (!sttRes.ok) throw new Error('STT failed')
      const { transcript: text, language_code: lang } = await sttRes.json()
      const sttMs = Date.now() - t0
      if (!text?.trim()) { processingRef.current = false; setCallState('active'); setStatus('Listening...'); return }

      setDetectedLang(lang?.split('-')[0]?.toUpperCase() || 'EN')
      setLatency(l => ({ ...l, stt: sttMs }))
      setTranscript(p => [...p, { role: 'user', content: text, ts: ts(), lang }])
      historyRef.current.push({ role: 'user', content: text })

      // LLM
      setStatus('Thinking...')
      const t1 = Date.now()
      const chatRes = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: text, history: historyRef.current.slice(-10) }) })
      if (!chatRes.ok) throw new Error('Chat failed')
      const { response: aiText } = await chatRes.json()
      const llmMs = Date.now() - t1
      setLatency(l => ({ ...l, llm: llmMs }))
      setTranscript(p => [...p, { role: 'assistant', content: aiText, ts: ts() }])
      historyRef.current.push({ role: 'assistant', content: aiText })

      // TTS
      setStatus('Speaking...')
      const t2 = Date.now()
      const ttsRes = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: aiText }) })
      if (!ttsRes.ok) throw new Error('TTS failed')
      const ttsMs = Date.now() - t2
      setLatency(l => ({ ...l, tts: ttsMs }))
      await playAudio(await ttsRes.arrayBuffer())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline error')
    } finally {
      processingRef.current = false
      if (callState !== 'ended') { setCallState('active'); setStatus('Listening...') }
    }
  }, [callState])

  async function startCall() {
    setError(''); setCallState('connecting'); setStatus('Requesting microphone...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream; audioCtxRef.current = new AudioContext()
      setCallState('active'); setStatus('Listening...')
      setTranscript([{ role: 'assistant', content: 'Hello! I\'m Priya, your AI clinic receptionist. How can I help you today? You can speak in Telugu, Tamil, Kannada, Malayalam, Hindi, or English.', ts: ts() }])
      historyRef.current = []

      function chunk() {
        if (!streamRef.current) return
        const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' })
        chunksRef.current = []; recorderRef.current = rec
        rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        rec.onstop = () => { if (chunksRef.current.length) process(new Blob(chunksRef.current, { type: rec.mimeType })) }
        rec.start()
        intervalRef.current = setTimeout(() => { if (rec.state === 'recording') rec.stop(); if (streamRef.current) chunk() }, 4000)
      }
      chunk()
    } catch { setError('Microphone access denied. Please allow mic permissions.'); setCallState('idle') }
  }

  function endCall() {
    setCallState('ended'); setStatus('')
    if (intervalRef.current) clearTimeout(intervalRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    audioCtxRef.current?.close()
    setTranscript(p => [...p, { role: 'assistant', content: 'Thank you for calling! Have a great day. Goodbye! 👋', ts: ts() }])
  }

  function reset() { setCallState('idle'); setTranscript([]); setLatency({}); setDetectedLang('—'); setStatus(''); setError(''); historyRef.current = [] }
  function toggleMute() { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted }); setMuted(!muted) }

  const isActive = callState === 'active' || callState === 'processing'

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: S.text, marginBottom: '4px' }}>Live Demo</h1>
        <p style={{ color: S.text2, fontSize: '14px' }}>Talk to Priya — your AI clinic receptionist</p>
      </div>

      <div style={{ maxWidth: '680px' }}>
        {/* Call card */}
        <div style={{ background: S.card, border: `1px solid ${isActive ? 'rgba(47,128,237,0.35)' : S.border}`, borderRadius: '18px', padding: '32px', textAlign: 'center', marginBottom: '18px', transition: 'border-color 0.3s', boxShadow: isActive ? '0 0 40px rgba(47,128,237,0.1)' : 'none' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '18px' }}>
            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'linear-gradient(135deg, #2F80ED, #1A6FD4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto', boxShadow: isActive ? '0 0 30px rgba(47,128,237,0.5)' : 'none', transition: 'box-shadow 0.3s' }}>🤖</div>
            {isActive && <div style={{ position: 'absolute', bottom: '4px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '9px', height: '9px', borderRadius: '50%', background: S.success }} className="pulse-blue" /></div>}
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: S.text, marginBottom: '3px' }}>Priya</h2>
          <p style={{ color: S.text2, fontSize: '13px', marginBottom: '18px' }}>AI Receptionist — Sample Clinic</p>

          {status && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: S.card2, borderRadius: '100px', padding: '7px 18px', marginBottom: '18px' }}>
              {callState === 'processing' ? <Loader2 size={13} color={S.accent} style={{ animation: 'spin 1s linear infinite' }} /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: S.accent }} className="pulse-blue" />}
              <span style={{ fontSize: '13px', color: S.accent, fontWeight: 600 }}>{status}</span>
            </div>
          )}

          {isActive && (
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center', height: '36px', marginBottom: '20px' }}>
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="wave-bar" style={{ width: '4px', borderRadius: '2px', background: S.accent, opacity: 0.7,
                  height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '9px', padding: '11px 14px', marginBottom: '18px', color: '#fca5a5', fontSize: '13px', textAlign: 'left' }}>{error}</div>}

          {callState === 'idle' && (
            <button onClick={startCall} style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: S.accent, color: '#fff', border: 'none', borderRadius: '50px', padding: '15px 34px', fontWeight: 800, fontSize: '16px', cursor: 'pointer', boxShadow: '0 0 26px rgba(47,128,237,0.4)' }}>
              <Phone size={19} /> Start Call
            </button>
          )}
          {callState === 'connecting' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', color: S.text2, fontSize: '15px' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</div>}
          {isActive && (
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button onClick={toggleMute} style={{ width: '52px', height: '52px', borderRadius: '50%', background: muted ? 'rgba(239,68,68,0.15)' : S.card2, border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : S.border}`, color: muted ? '#f87171' : S.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button onClick={endCall} style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PhoneOff size={20} />
              </button>
            </div>
          )}
          {callState === 'ended' && (
            <div>
              <p style={{ color: S.text3, marginBottom: '14px', fontSize: '13px' }}>Call ended</p>
              <button onClick={reset} style={{ background: S.card2, color: S.text, border: `1px solid ${S.border}`, borderRadius: '50px', padding: '11px 26px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Start New Call</button>
            </div>
          )}

          {/* Latency + Language */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: S.text3 }}>Lang: <span style={{ color: S.accent, fontWeight: 600 }}>{detectedLang}</span></span>
            {latency.stt !== undefined && <span style={{ fontSize: '12px', color: S.text3 }}>STT: <span style={{ color: S.text2 }}>{latency.stt}ms</span></span>}
            {latency.llm !== undefined && <span style={{ fontSize: '12px', color: S.text3 }}>LLM: <span style={{ color: S.text2 }}>{latency.llm}ms</span></span>}
            {latency.tts !== undefined && <span style={{ fontSize: '12px', color: S.text3 }}>TTS: <span style={{ color: S.text2 }}>{latency.tts}ms</span></span>}
          </div>
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isActive ? S.accent : S.text3 }} className={isActive ? 'pulse-blue' : ''} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: S.text }}>Live Transcript</span>
            </div>
            <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {transcript.map((m, i) => (
                <div key={i} className="fade-in" style={{ display: 'flex', gap: '10px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: m.role === 'user' ? S.card2 : S.accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>{m.role === 'user' ? '👤' : '🤖'}</div>
                  <div style={{ maxWidth: '80%' }}>
                    <div style={{ fontSize: '11px', color: S.text3, marginBottom: '3px', textAlign: m.role === 'user' ? 'right' : 'left' }}>
                      {m.role === 'user' ? 'You' : 'Priya'} · {m.ts}
                    </div>
                    <div style={{ background: m.role === 'user' ? S.card2 : 'rgba(47,128,237,0.08)', border: `1px solid ${m.role === 'user' ? S.border : 'rgba(47,128,237,0.2)'}`, borderRadius: '11px', padding: '9px 13px', fontSize: '14px', color: S.text, lineHeight: 1.55 }}>{m.content}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>
        )}

        {callState === 'idle' && (
          <div style={{ background: 'rgba(47,128,237,0.05)', border: '1px solid rgba(47,128,237,0.15)', borderRadius: '11px', padding: '14px 18px', marginTop: '14px', fontSize: '13px', color: S.text2, lineHeight: 1.7 }}>
            🎤 Click &quot;Start Call&quot; → allow microphone → speak in any of the 6 languages → Priya responds via Sarvam STT + Gemini + Cartesia TTS.
          </div>
        )}
      </div>
    </div>
  )
}
