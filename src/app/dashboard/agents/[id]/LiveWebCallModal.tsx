'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, PhoneOff, Loader2, Volume2, AlertCircle, Activity } from 'lucide-react'

const S = {
  bg: '#F8FAFC', card: '#FFFFFF', border: '#E2E8F0',
  teal: '#0891B2', red: '#DC2626', green: '#059669',
  text: '#1E293B', text2: '#64748B', text3: '#94A3B8', amber: '#D97706'
}

const LANG_CODE_TO_NAME: Record<string, string> = {
  te: 'Telugu', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam',
  en: 'English', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi', bn: 'Bengali',
}

type CallState = 'idle' | 'connecting' | 'agent_speaking' | 'listening' | 'processing' | 'ended' | 'error'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface LatencyInfo { stt: number; llm: number; tts: number }

export default function LiveWebCallModal({ agent, onClose }: { agent: any; onClose: () => void }) {
  const [callState, setCallState]   = useState<CallState>('idle')
  const [messages,  setMessages]    = useState<Message[]>([])
  const [error,     setError]       = useState<string | null>(null)
  const [latency,   setLatency]     = useState<LatencyInfo>({ stt: 0, llm: 0, tts: 0 })
  const [micLevel,  setMicLevel]    = useState(0)
  const [currentLang, setCurrentLang] = useState<string>('en')

  // Session ref — server holds all conversation state
  const sessionIdRef     = useRef<string>('')
  const callStartTimeRef = useRef<Date | null>(null)
  const endedByRef       = useRef<'User' | 'System' | 'Agent'>('User')

  // Persistent mic resources — opened ONCE at call start
  const streamRef      = useRef<MediaStream | null>(null)
  const audioCtxRef    = useRef<AudioContext | null>(null)
  const analyserRef    = useRef<AnalyserNode | null>(null)

  // Calibrated VAD thresholds
  const speechThreshRef  = useRef<number>(12)
  const silenceThreshRef = useRef<number>(6)

  // Per-turn recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const currentAudioRef  = useRef<HTMLAudioElement | null>(null)
  const animFrameRef     = useRef<number | null>(null)
  const callActiveRef    = useRef(false)
  const messagesEndRef   = useRef<HTMLDivElement>(null)

  // Full-call recorder (mic + TTS mixed)
  const callRecorderRef       = useRef<MediaRecorder | null>(null)
  const callAudioChunksRef    = useRef<Blob[]>([])
  const recordingDestRef      = useRef<MediaStreamAudioDestinationNode | null>(null)
  const callRecordingReadyRef = useRef<Promise<Blob | null>>(Promise.resolve(null))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      callActiveRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (mediaRecorderRef.current?.state !== 'inactive') { try { mediaRecorderRef.current?.stop() } catch {} }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      if (audioCtxRef.current?.state !== 'closed') { audioCtxRef.current?.close() }
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
    }
  }, [])

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date().toLocaleTimeString() }])
  }

  const cleanupMic = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    setMicLevel(0)
  }

  const cleanupCall = () => {
    cleanupMic()
    if (callRecorderRef.current && callRecorderRef.current.state !== 'inactive') {
      try { callRecorderRef.current.stop() } catch {}
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close(); audioCtxRef.current = null
    }
    analyserRef.current   = null
    recordingDestRef.current = null
  }

  const calibrateMic = (analyser: AnalyserNode): Promise<void> => {
    return new Promise(resolve => {
      const samples: number[] = []
      const dataArr = new Uint8Array(analyser.frequencyBinCount)
      const start = Date.now()
      const tick = () => {
        analyser.getByteFrequencyData(dataArr)
        samples.push(dataArr.reduce((a, b) => a + b, 0) / dataArr.length)
        if (Date.now() - start < 600) { requestAnimationFrame(tick); return }
        const floor = Math.max(3, samples.reduce((a, b) => a + b, 0) / samples.length)
        speechThreshRef.current  = Math.max(10, floor * 2.5)
        silenceThreshRef.current = Math.max(4,  floor * 1.4)
        resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  // Play WAV audio from base64 string, routing through AudioContext for call recording
  const playAudioFromBase64 = useCallback(async (base64: string): Promise<void> => {
    return new Promise(async resolve => {
      try {
        const bytes    = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const audioBlob = new Blob([bytes], { type: 'audio/wav' })
        const audioUrl  = URL.createObjectURL(audioBlob)
        const audio     = new Audio(audioUrl)
        currentAudioRef.current = audio

        if (audioCtxRef.current && recordingDestRef.current && audioCtxRef.current.state !== 'closed') {
          try {
            const src = audioCtxRef.current.createMediaElementSource(audio)
            src.connect(recordingDestRef.current)        // → call recording
            src.connect(audioCtxRef.current.destination) // → speakers
          } catch { /* fallback to normal play */ }
        }

        audio.onended = () => { URL.revokeObjectURL(audioUrl); currentAudioRef.current = null; resolve() }
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); currentAudioRef.current = null; resolve() }
        await audio.play()
      } catch (e) {
        console.error('[Audio] playback error:', e)
        resolve()
      }
    })
  }, [])

  const recordUntilSilence = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const stream   = streamRef.current
      const analyser = analyserRef.current
      if (!stream || !analyser) { reject(new Error('Mic not initialized')); return }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current   = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => resolve(new Blob(audioChunksRef.current, { type: mimeType }))
      recorder.start(100)

      const dataArray          = new Uint8Array(analyser.frequencyBinCount)
      const SILENCE_DURATION   = agent.stt_silence_timeout ?? 500
      const MAX_WAIT_FOR_SPEECH = 10000
      const MAX_RECORDING_MS   = 20000

      let silenceStart: number | null = null
      let hasSpoken = false
      const recordingStart = Date.now()
      let stopped = false

      const stopRecorder = () => {
        if (stopped) return
        stopped = true
        clearTimeout(hardLimitTimer)
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        recorder.stop()
      }
      const hardLimitTimer = setTimeout(stopRecorder, MAX_RECORDING_MS)

      const tick = () => {
        if (!callActiveRef.current) { stopRecorder(); return }
        const elapsed = Date.now() - recordingStart
        if (elapsed > MAX_RECORDING_MS) { stopRecorder(); return }
        if (!hasSpoken && elapsed > MAX_WAIT_FOR_SPEECH) { setMicLevel(0); stopRecorder(); return }

        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setMicLevel(Math.min(100, avg * 2))

        if (avg > speechThreshRef.current) {
          hasSpoken     = true
          silenceStart  = null
        } else if (hasSpoken) {
          if (!silenceStart) silenceStart = Date.now()
          else if (Date.now() - silenceStart > SILENCE_DURATION) {
            setMicLevel(0); stopRecorder(); return
          }
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    })
  }, [agent])

  // ── PCM chunk player ─────────────────────────────────────────────────────
  // Schedules raw PCM Int16 chunks via AudioContext for gapless playback.
  const pcmNextTimeRef = useRef(0)
  const pcmGainRef     = useRef<GainNode | null>(null)

  const feedPCMChunk = useCallback((base64Pcm: string) => {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state === 'closed') return

    // Lazy-create gain node on first chunk
    if (!pcmGainRef.current) {
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      if (recordingDestRef.current) gain.connect(recordingDestRef.current)
      pcmGainRef.current = gain
    }

    // Decode base64 → Int16 → Float32
    const binary = atob(base64Pcm)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const int16   = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

    // Create buffer at source sample rate — WebAudio resamples automatically
    const buffer = ctx.createBuffer(1, float32.length, 22050)
    buffer.getChannelData(0).set(float32)

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(pcmGainRef.current)

    const now = ctx.currentTime
    if (pcmNextTimeRef.current < now) pcmNextTimeRef.current = now
    src.start(pcmNextTimeRef.current)
    pcmNextTimeRef.current += buffer.duration
  }, [])

  const waitForPCMDone = useCallback(async () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    while (true) {
      const remaining = pcmNextTimeRef.current - ctx.currentTime
      if (remaining <= 0.02) break
      await new Promise(r => setTimeout(r, Math.max(20, remaining * 1000 - 30)))
    }
  }, [])

  const resetPCMPlayer = useCallback(() => {
    pcmNextTimeRef.current = 0
    if (pcmGainRef.current) {
      try { pcmGainRef.current.gain.setValueAtTime(1, audioCtxRef.current?.currentTime ?? 0) } catch {}
    }
    pcmGainRef.current = null
  }, [])

  // ── Streaming session/turn — SSE events with PCM audio chunks ───────────
  const callSessionTurn = useCallback(async (audioBlob: Blob): Promise<void> => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    const formData = new FormData()
    formData.append('sessionId', sessionId)
    formData.append('audio', audioBlob, 'audio.webm')

    let res: Response
    try {
      res = await fetch('/api/webcall/session/turn', { method: 'POST', body: formData })
    } catch (e: any) {
      setError('Network error: ' + e.message)
      return
    }

    if (res.status === 410) {
      setError('Session expired. Please start a new call.')
      setCallState('error')
      return
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      try { setError(`Turn error: ${(JSON.parse(text) as any).error || res.status}`) }
      catch { setError(`Turn error: ${res.status}`) }
      return
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buf          = ''
    let fullResponse = ''
    let isEmpty      = false
    let streamError  = false

    // Reset PCM player for this turn
    resetPCMPlayer()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const json = line.replace(/^data:\s*/, '').trim()
        if (!json) continue
        try {
          const ev = JSON.parse(json) as {
            type: string; text?: string; data?: string; audio?: string;
            sentence?: number; stt_ms?: number; llm_ms?: number; tts_ms?: number; error?: string
          }
          switch (ev.type) {
            case 'transcript':
              if (ev.text?.trim()) addMessage('user', ev.text)
              if (ev.stt_ms) setLatency(prev => ({ ...prev, stt: ev.stt_ms! }))
              break
            case 'audio_chunk':
              // Raw PCM chunk — feed directly to player
              if (ev.data) {
                if (!callActiveRef.current) break
                setCallState('agent_speaking')
                feedPCMChunk(ev.data)
              }
              if (ev.llm_ms) setLatency(prev => ({ ...prev, llm: ev.llm_ms! }))
              break
            case 'sentence_end':
              if (ev.text) fullResponse += (fullResponse ? ' ' : '') + ev.text
              break
            case 'audio':
              // Legacy WAV fallback (shouldn't happen in new pipeline)
              if (ev.text) fullResponse += (fullResponse ? ' ' : '') + ev.text
              if (ev.llm_ms) setLatency(prev => ({ ...prev, llm: ev.llm_ms! }))
              break
            case 'empty':
              isEmpty = true
              break
            case 'done':
              if (ev.tts_ms) setLatency(prev => ({ ...prev, tts: ev.tts_ms! }))
              break
            case 'error':
              setError(`Turn error: ${ev.error}`)
              streamError = true
              break
          }
        } catch {}
        if (streamError) break
      }
      if (streamError) break
    }

    // Wait for all scheduled PCM to finish playing
    if (!streamError && !isEmpty) {
      await waitForPCMDone()
    }

    if (streamError) {
      callActiveRef.current = false
      setCallState('error')
      return
    }
    if (isEmpty) {
      await new Promise(r => setTimeout(r, 400))
      return
    }

    if (fullResponse) addMessage('assistant', fullResponse)
  }, [feedPCMChunk, waitForPCMDone, resetPCMPlayer])

  const processTurn = useCallback(async () => {
    if (!callActiveRef.current) return
    setCallState('listening')

    let audioBlob: Blob
    try {
      audioBlob = await recordUntilSilence()
    } catch (e: any) {
      if (!callActiveRef.current) return
      setError(e.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow microphone access and try again.'
        : 'Microphone error: ' + e.message)
      setCallState('error')
      return
    }

    if (!callActiveRef.current) return
    setCallState('processing')

    await callSessionTurn(audioBlob)

    if (callActiveRef.current) processTurn()
  }, [recordUntilSilence, callSessionTurn])

  const startCall = async () => {
    setError(null)
    setMessages([])
    setLatency({ stt: 0, llm: 0, tts: 0 })
    sessionIdRef.current = ''
    setCallState('connecting')

    // 1. Open mic ONCE for the entire call
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e: any) {
      setError(e.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow mic access and try again.'
        : 'Could not access microphone: ' + e.message)
      setCallState('error')
      return
    }
    streamRef.current = stream

    // 2. AudioContext + Analyser for VAD
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const analyser  = audioCtx.createAnalyser()
    analyser.fftSize = 256
    const micSource = audioCtx.createMediaStreamSource(stream)
    micSource.connect(analyser)
    analyserRef.current = analyser

    // 3. Mixed destination for call recording (mic + TTS)
    const recordingDest = audioCtx.createMediaStreamDestination()
    recordingDestRef.current = recordingDest
    micSource.connect(recordingDest)
    callAudioChunksRef.current = []
    let resolveRecording!: (blob: Blob | null) => void
    callRecordingReadyRef.current = new Promise<Blob | null>(r => { resolveRecording = r })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
    try {
      const callRecorder = new MediaRecorder(recordingDest.stream, mimeType ? { mimeType } : {})
      callRecorder.ondataavailable = (e) => { if (e.data.size > 0) callAudioChunksRef.current.push(e.data) }
      callRecorder.onstop = () => {
        const chunks = callAudioChunksRef.current
        resolveRecording(chunks.length > 0 ? new Blob(chunks, { type: mimeType || 'audio/webm' }) : null)
      }
      callRecorder.start(1000)
      callRecorderRef.current = callRecorder
    } catch (e) {
      console.warn('[Recorder] Could not start call recorder:', e)
      resolveRecording(null)
    }

    // 4. Calibrate mic noise floor
    await calibrateMic(analyser)

    // 5. Start server-side session — pass auth token so server can read agent via RLS
    const { supabase: sb } = await import('@/lib/supabase')
    const { data: { session: authSession } } = await sb.auth.getSession()
    const accessToken = authSession?.access_token || ''

    let sessionRes: Response
    try {
      sessionRes = await fetch('/api/webcall/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ agentId: agent.id }),
      })
    } catch (e: any) {
      setError('Failed to start session: ' + e.message)
      cleanupCall()
      setCallState('error')
      return
    }

    if (!sessionRes.ok) {
      const data = await sessionRes.json().catch(() => ({})) as any
      setError(data.error || 'Failed to start session')
      cleanupCall()
      setCallState('error')
      return
    }

    const sessionData = await sessionRes.json() as {
      sessionId: string; firstMessage: string; firstMessageAudio: string
      preset: { language: string; languageName: string }
    }

    sessionIdRef.current = sessionData.sessionId
    setCurrentLang(sessionData.preset.language)
    callActiveRef.current  = true
    callStartTimeRef.current = new Date()

    addMessage('assistant', sessionData.firstMessage)
    setCallState('agent_speaking')
    await playAudioFromBase64(sessionData.firstMessageAudio)

    if (callActiveRef.current) processTurn()
  }

  const endCall = (endedBy: 'User' | 'System' | 'Agent' = 'User') => {
    endedByRef.current    = endedBy
    callActiveRef.current = false
    cleanupCall()
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
    setCallState('ended')
    setMicLevel(0)
    saveCallLog(endedBy)
  }

  const saveCallLog = async (endedBy: 'User' | 'System' | 'Agent') => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return

    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()

      const startTime    = callStartTimeRef.current || new Date()
      const durationSecs = Math.round((Date.now() - startTime.getTime()) / 1000)

      // 1. Upload call recording if available
      let recordingUrl = ''
      const audioBlob = await Promise.race([
        callRecordingReadyRef.current,
        new Promise<null>(r => setTimeout(() => r(null), 5000)),
      ])

      if (audioBlob && session) {
        try {
          const ext      = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
          const fileName = `${agent.id}/${crypto.randomUUID()}.${ext}`
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('call-recordings')
            .upload(fileName, audioBlob, { contentType: audioBlob.type, upsert: false })
          if (!uploadErr && uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('call-recordings')
              .getPublicUrl(uploadData.path)
            recordingUrl = publicUrl
          }
        } catch (e) {
          console.warn('[CallLog] Audio upload error:', e)
        }
      }

      // 2. End session server-side — server saves call_log with full transcript
      const endRes = await fetch('/api/webcall/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          accessToken:  session?.access_token || '',
          duration:     durationSecs,
          endedBy,
          recordingUrl,
        }),
      })

      const endData = await endRes.json().catch(() => ({})) as any
      const callLogId = endData?.callLogId

      window.dispatchEvent(new CustomEvent('call-log-saved'))

      // 3. Post-call analysis (fire-and-forget)
      if (callLogId && session) {
        const msgs = messages.concat() // snapshot of messages state
        const transcriptJson = msgs.map((m, i) => ({
          role: m.role, content: m.content, timestamp: m.timestamp, index: i,
        }))
        const postCallConfig = agent.post_call_config
          ? (typeof agent.post_call_config === 'string'
              ? JSON.parse(agent.post_call_config)
              : agent.post_call_config)
          : { variables: [], options: { call_summary: true, sentiment_analysis: true } }

        fetch('/api/post-call-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            callLogId, transcript: transcriptJson, postCallConfig,
            agentId: agent.id, llmProvider: 'gemini',
            callDurationSeconds: durationSecs, callType: 'Web Call',
          }),
        }).then(() => {
          window.dispatchEvent(new CustomEvent('call-analysis-ready', { detail: { callLogId } }))
        }).catch(e => console.error('[CallLog] Post-call analysis failed:', e))
      }
    } catch (e) {
      console.error('[CallLog] saveCallLog error:', e)
    }
  }

  const statusColor = () => {
    switch (callState) {
      case 'listening':     return S.green
      case 'processing':    return S.teal
      case 'agent_speaking':return S.amber
      case 'error':         return S.red
      default:              return S.text3
    }
  }

  const statusLabel = () => {
    switch (callState) {
      case 'idle':           return 'Ready to call'
      case 'connecting':     return 'Connecting...'
      case 'agent_speaking': return 'Speaking...'
      case 'listening':      return 'Listening...'
      case 'processing':     return 'Thinking...'
      case 'ended':          return 'Call ended'
      case 'error':          return 'Error'
    }
  }

  const isActive = callState !== 'idle' && callState !== 'ended' && callState !== 'error'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 500, background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 24, padding: 30, display: 'flex', flexDirection: 'column',
        height: '88vh', maxHeight: 860
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ width: 44 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: callState === 'agent_speaking' ? S.amber : callState === 'error' ? S.red : S.teal,
              color: '#fff', fontSize: 32, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              boxShadow: `0 0 30px ${(callState === 'agent_speaking' ? S.amber : callState === 'error' ? S.red : S.teal)}40`,
              animation: callState === 'agent_speaking' ? 'pulse 1s infinite' : 'none'
            }}>
              {(agent.agent_name || 'A').charAt(0)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.text }}>{agent.agent_name}</div>
            <div style={{ fontSize: 13, color: S.text2, marginTop: 4 }}>{agent.clinic_name}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: S.text2, fontSize: 24, cursor: 'pointer'
          }}>✕</button>
        </div>

        {/* Status */}
        <div style={{
          textAlign: 'center', fontSize: 14, fontWeight: 600, color: statusColor(),
          height: 24, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          {(callState === 'connecting' || callState === 'processing') &&
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {callState === 'error' && <AlertCircle size={14} />}
          {statusLabel()}
        </div>

        {/* Language badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          {isActive && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: S.teal,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
              padding: '2px 10px', borderRadius: 100
            }}>
              {LANG_CODE_TO_NAME[currentLang] || currentLang.toUpperCase()}
            </span>
          )}
        </div>

        {/* Mic level bar */}
        {callState === 'listening' && (
          <div style={{ height: 4, background: S.border, borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: S.green, borderRadius: 2, width: `${micLevel}%`, transition: 'width 80ms ease' }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 12,
            fontSize: 13, color: S.red, textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Transcript */}
        <div style={{
          flex: 1, overflowY: 'auto', background: S.bg, borderRadius: 12, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
          border: `1px solid ${S.border}`, marginBottom: 16
        }}>
          {messages.length === 0 && callState === 'idle' && (
            <div style={{ margin: 'auto', color: S.text3, fontSize: 14, textAlign: 'center' }}>
              Click <strong style={{ color: S.teal }}>Start Call</strong> to test your agent.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ fontSize: 11, color: S.text3, marginBottom: 4 }}>
                {m.role === 'user' ? 'You' : agent.agent_name} · {m.timestamp}
              </div>
              <div style={{
                padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
                background: m.role === 'user' ? S.teal : '#F1F5F9',
                color: m.role === 'user' ? '#fff' : S.text,
                borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                borderBottomLeftRadius:  m.role === 'user' ? 12 : 2,
                maxWidth: '85%'
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {callState === 'listening' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{
                background: S.green + '20', border: `1px solid ${S.green}40`,
                padding: '8px 20px', borderRadius: 20, color: S.green,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: S.green, animation: 'blink 1s infinite' }} />
                Listening for your voice...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Latency */}
        {(latency.stt > 0 || latency.llm > 0 || latency.tts > 0) && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 12, fontSize: 11, color: S.text3 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity size={10} /> STT: {latency.stt}ms
            </span>
            <span>LLM: {latency.llm}ms</span>
            <span>TTS: {latency.tts}ms</span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          {!isActive ? (
            <button onClick={startCall} style={{
              background: S.teal, color: '#fff', border: 'none',
              padding: '16px 32px', borderRadius: 100, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <Mic size={20} /> Start Call
            </button>
          ) : (
            <>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: callState === 'agent_speaking' ? S.amber + '20' : callState === 'listening' ? S.green + '20' : '#F1F5F9',
                border: `2px solid ${callState === 'listening' ? S.green : callState === 'agent_speaking' ? S.amber : S.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: callState === 'listening' ? S.green : callState === 'agent_speaking' ? S.amber : S.text3
              }}>
                {callState === 'agent_speaking' ? <Volume2 size={24} /> :
                 callState === 'processing'     ? <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> :
                 <Mic size={24} />}
              </div>
              <button onClick={() => endCall('User')} style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: S.red, padding: '0 24px', borderRadius: 100, fontSize: 16, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <PhoneOff size={20} /> End Call
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
