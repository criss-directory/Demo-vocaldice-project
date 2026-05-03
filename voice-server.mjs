/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Vocaldice Voice Server — MODULAR ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Module 1: TELEPHONY LAYER   — /answer, /hangup, WebSocket /stream
 *  Module 2: AUDIO PROCESSING  — buffer, silence detect, WAV conversion
 *  Module 3: AI BRAIN          — STT → LLM → TTS (disabled in Phase 1)
 *
 *  PHASE 1:  Hardcoded greeting — test telephony + playAudio
 *  PHASE 2:  Real STT + LLM + TTS (enable when Phase 1 works)
 *  PHASE 3:  Barge-in, streaming TTS, conversation memory
 *  PHASE 4:  Product logic — clinic mapping, after-hours toggle
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import http from 'http'
import { createClient } from '@supabase/supabase-js'

// ─── CONFIGURATION ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.VOICE_SERVER_PORT || '5050')

// Set CURRENT_PHASE to control what's active
// Phase 1 = hardcoded responses (test telephony)
// Phase 2 = real AI pipeline (STT + LLM + TTS)
const CURRENT_PHASE = 1
console.log(`\n🔧 [CONFIG] Running Phase ${CURRENT_PHASE}`)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SARVAM_API_KEY = process.env.SARVAM_API_KEY
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

// Supabase client (optional in Phase 1 — fallback gracefully)
let supabase = null
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  console.log('   ✅ Supabase connected')
} else {
  console.log('   ⚠️  Supabase not configured — running without DB')
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  MODULE 1: TELEPHONY LAYER                                              ║
// ║  Handles HTTP webhooks and WebSocket lifecycle                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Root status page ─────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.send(`<html><head><title>Vocaldice Voice Server</title>
  <style>body{font-family:system-ui;background:#F0F4F8;color:#1E293B;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.06)}
  h1{font-size:22px;margin-bottom:8px}p{color:#64748B;font-size:14px;line-height:1.6}
  code{background:#F0F4F8;border:1px solid #E2E8F0;padding:3px 8px;border-radius:6px;font-size:13px;color:#0891B2}
  .badge{display:inline-block;background:rgba(5,150,105,0.1);color:#059669;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px}
  .phase{background:rgba(8,145,178,0.1);color:#0891B2;padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px;margin-top:12px;display:inline-block}
  </style></head><body><div class="card">
  <div class="badge">● Running</div>
  <h1>🎙️ Vocaldice Voice Server</h1>
  <p>Real-time telephony pipeline via Vobiz</p>
  <div class="phase">Phase ${CURRENT_PHASE}${CURRENT_PHASE === 1 ? ' — Telephony Test' : ' — Full AI Pipeline'}</div>
  <p style="margin-top:16px"><strong>Endpoints:</strong></p>
  <p><code>POST /answer</code> Vobiz webhook &nbsp;
  <code>POST /hangup</code> Call ended<br/>
  <code>GET /health</code> Health &nbsp;
  <code>WSS /stream</code> Audio stream</p>
  </div></body></html>`)
})

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'vocaldice-voice',
    phase: CURRENT_PHASE,
    uptime: Math.round(process.uptime()),
    supabase: !!supabase,
    cartesia: !!CARTESIA_API_KEY,
  })
})

// ── POST /answer — Vobiz calls this when someone dials ───────────────────────

app.post('/answer', (req, res) => {
  const callId = req.body?.CallUUID || req.body?.callId || 'unknown'
  const from = req.body?.From || req.body?.from || 'unknown'
  const to = req.body?.To || req.body?.to || 'unknown'

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📞 INCOMING CALL`)
  console.log(`   CallID : ${callId}`)
  console.log(`   From   : ${from}`)
  console.log(`   To     : ${to}`)
  console.log(`${'═'.repeat(60)}`)

  // Build WebSocket URL from request headers (works with ngrok)
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws'
  const wsUrl = `${protocol}://${host}/stream`

  console.log(`   → Stream URL: ${wsUrl}`)

  res.set('Content-Type', 'text/xml')
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">
    ${wsUrl}
  </Stream>
</Response>`)
})

// ── POST /hangup — Call ended ────────────────────────────────────────────────

app.post('/hangup', (req, res) => {
  const callId = req.body?.CallUUID || req.body?.callId || 'unknown'
  const duration = req.body?.Duration || req.body?.CallDuration || 0

  console.log(`\n📴 HANGUP — CallID: ${callId}, Duration: ${duration}s`)
  res.json({ status: 'ok' })
})

// ── HTTP + WebSocket Server ──────────────────────────────────────────────────

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/stream' })


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SESSION STATE                                                          ║
// ║  Clean per-call state object                                            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

class CallSession {
  constructor(ws) {
    this.ws = ws
    this.streamId = null
    this.callId = null
    this.from = null
    this.to = null

    // Agent config (Phase 2+)
    this.agent = null
    this.agentId = null
    this.userId = null

    // Conversation history (Phase 2+)
    this.messages = []

    // Audio buffer state
    this.audioBuffer = []     // base64 μ-law chunks
    this.silenceTimer = null
    this.lastAudioTime = 0

    // Processing flags
    this.isAiSpeaking = false
    this.isProcessing = false

    // Settings
    this.SILENCE_MS = 800     // ms of silence = end of speech
    this.MIN_CHUNKS = 10      // minimum ~200ms of audio before processing

    // Timing
    this.callStart = Date.now()
    this.greetingSent = false
    this.turnCount = 0        // how many user turns processed
  }

  get durationSec() {
    return Math.round((Date.now() - this.callStart) / 1000)
  }
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  WEBSOCKET HANDLER — Core stream lifecycle                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

wss.on('connection', (ws) => {
  console.log('\n🔌 WebSocket connected')
  const session = new CallSession(ws)

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      switch (msg.event) {
        case 'start':
          handleStreamStart(session, msg)
          break

        case 'media':
          handleMediaChunk(session, msg)
          break

        case 'stop':
          handleStreamStop(session, msg)
          break

        // Vobiz confirmations
        case 'playedStream':
          console.log(`   ✓ playback confirmed: ${msg.name || 'chunk'}`)
          break

        case 'clearedAudio':
          console.log('   ✓ audio cleared')
          break

        default:
          if (msg.event) console.log(`   ? unknown event: ${msg.event}`)
      }
    } catch (err) {
      // Non-JSON message — could be binary, ignore
    }
  })

  ws.on('close', () => {
    console.log(`🔌 WebSocket closed (call lasted ${session.durationSec}s)`)
    clearTimeout(session.silenceTimer)
  })

  ws.on('error', (err) => {
    console.error(`❌ WebSocket error: ${err.message}`)
  })
})


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  MODULE 1 HANDLERS — Stream start / media / stop                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

async function handleStreamStart(session, msg) {
  // Extract IDs — Vobiz sends these in different places depending on version
  session.streamId = msg.streamId || msg.start?.streamId || null
  session.callId = msg.callId || msg.start?.callId || null
  session.from = msg.start?.from || msg.metadata?.from || null
  session.to = msg.start?.to || msg.metadata?.to || null

  console.log(`\n🎙️  STREAM STARTED`)
  console.log(`   StreamID : ${session.streamId}`)
  console.log(`   CallID   : ${session.callId}`)
  console.log(`   From     : ${session.from}`)
  console.log(`   To       : ${session.to}`)

  // ── PHASE 1: Hardcoded greeting ──
  if (CURRENT_PHASE === 1) {
    console.log('\n   🧪 [PHASE 1] Sending hardcoded greeting...')
    await sendTTSResponse(session, 'Hello! Thank you for calling. This is a test. How can I help you today?')
    session.greetingSent = true
    return
  }

  // ── PHASE 2+: Resolve agent from DB, send dynamic greeting ──
  await resolveAgent(session)
  const greeting = session.agent?.greeting ||
    `Hello! Thank you for calling ${session.agent?.clinic_name || 'our clinic'}. How can I help you today?`
  session.messages.push({ role: 'assistant', content: greeting, timestamp: new Date().toISOString() })
  await sendTTSResponse(session, greeting)
  session.greetingSent = true
}


function handleMediaChunk(session, msg) {
  const payload = msg.media?.payload
  if (!payload) return

  // ── PHASE 1: Check barge-in via energy ──
  if (session.isAiSpeaking) {
    const energy = AudioProcessor.calculateEnergy(payload)
    if (energy > 0.02) {  // Voice detected during AI speech
      console.log(`   🗣️  BARGE-IN detected (energy: ${energy.toFixed(3)})`)
      session.isAiSpeaking = false
      TelephonyCommands.clearAudio(session)
      session.audioBuffer = [payload]  // Start fresh
    }
    return  // Don't buffer while AI is speaking
  }

  // ── Buffer audio ──
  session.audioBuffer.push(payload)
  session.lastAudioTime = Date.now()

  // ── Don't start another pipeline while already processing ──
  if (session.isProcessing) return

  // ── Silence detection: reset on each chunk ──
  clearTimeout(session.silenceTimer)
  session.silenceTimer = setTimeout(() => {
    if (session.audioBuffer.length >= session.MIN_CHUNKS && !session.isProcessing) {
      onSilenceDetected(session)
    }
  }, session.SILENCE_MS)
}


async function handleStreamStop(session, msg) {
  console.log(`\n📴 STREAM STOPPED — reason: ${msg.reason || 'call_ended'}`)
  console.log(`   Duration  : ${session.durationSec}s`)
  console.log(`   Turns     : ${session.turnCount}`)
  console.log(`   Messages  : ${session.messages.length}`)

  clearTimeout(session.silenceTimer)

  // Phase 2+: save call log + post-call analysis
  if (CURRENT_PHASE >= 2 && session.messages.length > 0) {
    await PostCallProcessor.saveAndAnalyze(session)
  }
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  MODULE 2: AUDIO PROCESSING LAYER                                       ║
// ║  Buffer management, silence detection, WAV conversion                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const AudioProcessor = {

  /**
   * Calculate energy (RMS) of a base64 μ-law chunk.
   * Used for voice activity detection and barge-in.
   * μ-law silence is ~127/128, speech is further from center.
   */
  calculateEnergy(base64Chunk) {
    const buf = Buffer.from(base64Chunk, 'base64')
    if (buf.length === 0) return 0
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const sample = (buf[i] - 128) / 128.0
      sum += sample * sample
    }
    return Math.sqrt(sum / buf.length)
  },

  /**
   * Combine base64 μ-law chunks into a WAV buffer.
   * Sarvam STT expects a proper audio file.
   */
  chunksToWav(base64Chunks) {
    const buffers = base64Chunks.map(b64 => Buffer.from(b64, 'base64'))
    const rawAudio = Buffer.concat(buffers)

    const dataSize = rawAudio.length
    const header = Buffer.alloc(44)

    header.write('RIFF', 0)
    header.writeUInt32LE(36 + dataSize, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)          // chunk size
    header.writeUInt16LE(7, 20)           // format: μ-law
    header.writeUInt16LE(1, 22)           // mono
    header.writeUInt32LE(8000, 24)        // sample rate
    header.writeUInt32LE(8000, 28)        // byte rate
    header.writeUInt16LE(1, 32)           // block align
    header.writeUInt16LE(8, 34)           // bits per sample
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return Buffer.concat([header, rawAudio])
  },
}


/**
 * Called when silence is detected after user speech.
 * This is the entry point into the processing pipeline.
 */
async function onSilenceDetected(session) {
  if (session.isProcessing) return
  session.isProcessing = true
  session.turnCount++

  // Grab and clear the buffer
  const chunks = [...session.audioBuffer]
  session.audioBuffer = []

  const chunkCount = chunks.length
  const approxMs = Math.round(chunkCount * 20)  // each chunk ≈ 20ms
  console.log(`\n── Turn ${session.turnCount} ──────────────────────────`)
  console.log(`   📦 Buffered: ${chunkCount} chunks (~${approxMs}ms of audio)`)

  try {
    if (CURRENT_PHASE === 1) {
      // ═══ PHASE 1: Hardcoded response ═══
      console.log('   🧪 [PHASE 1] Sending hardcoded response...')
      await sendTTSResponse(session, 'I understand. Let me check on that for you. Is there anything else you need?')
    } else {
      // ═══ PHASE 2+: Real AI pipeline ═══
      await runAIPipeline(session, chunks)
    }
  } catch (err) {
    console.error(`   ❌ Pipeline error: ${err.message}`)
    // Try to recover with an error message
    try {
      await sendTTSResponse(session, 'I apologize, I had a brief issue. Could you repeat that?')
    } catch (_) {}
  }

  session.isProcessing = false
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  MODULE 3: AI BRAIN                                                     ║
// ║  STT → LLM → TTS pipeline (Phase 2+)                                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Full AI pipeline: audio chunks → text → thinking → speech
 * Only called in Phase 2+
 */
async function runAIPipeline(session, audioChunks) {

  // ── Step 1: STT ──
  const sttStart = Date.now()
  const wavBuffer = AudioProcessor.chunksToWav(audioChunks)
  const transcript = await STT.transcribe(wavBuffer)
  const sttMs = Date.now() - sttStart
  console.log(`   🔊 STT (${sttMs}ms): "${transcript}"`)

  if (!transcript || transcript.trim().length < 2) {
    console.log('   ⏭️  Empty transcript — skipping')
    return
  }

  session.messages.push({ role: 'user', content: transcript, timestamp: new Date().toISOString() })

  // ── Step 2: LLM ──
  const llmStart = Date.now()
  const response = await LLM.getResponse(session, transcript)
  const llmMs = Date.now() - llmStart
  console.log(`   🧠 LLM (${llmMs}ms): "${response.substring(0, 80)}..."`)

  session.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() })

  // ── Step 3: TTS + Send ──
  const ttsStart = Date.now()
  await sendTTSResponse(session, response)
  const ttsMs = Date.now() - ttsStart
  console.log(`   🔈 TTS (${ttsMs}ms): Audio sent`)

  // ── Total ──
  const total = sttMs + llmMs + ttsMs
  console.log(`   ⏱️  Total turn: ${total}ms (STT:${sttMs} LLM:${llmMs} TTS:${ttsMs})`)
}


// ── STT Module ───────────────────────────────────────────────────────────────

const STT = {
  async transcribe(wavBuffer) {
    if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not set')

    const formData = new FormData()
    formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav')
    formData.append('model', 'saarika:v2')
    formData.append('language_code', 'unknown')

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_API_KEY },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sarvam STT ${res.status}: ${err}`)
    }

    const data = await res.json()
    return data.transcript || ''
  }
}


// ── LLM Module ───────────────────────────────────────────────────────────────

const VOICE_RULE = `
CRITICAL RULES FOR VOICE CALL:
1. Keep responses to 1-2 short sentences. Finish every sentence.
2. Be warm and professional — like a real medical receptionist.
3. Respond in the SAME language the caller uses.
4. Do not repeat greetings after the first message.
5. Stay focused on clinic tasks only.
6. NEVER use bullet points or lists — speak naturally.`

const LLM = {
  async getResponse(session, userText) {
    const agent = session.agent || {}
    const provider = (agent.llm_provider || process.env.LLM_PROVIDER || 'groq').toLowerCase()
    const model = agent.llm_model || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'gemini-2.0-flash')
    const temperature = agent.llm_temperature ?? 0.2
    const systemPrompt = (agent.system_prompt || 'You are a helpful AI medical receptionist.') + VOICE_RULE

    if (provider === 'groq') return LLM._callGroq(session.messages, systemPrompt, model, temperature)
    return LLM._callGemini(session.messages, systemPrompt, model, temperature)
  },

  async _callGroq(messages, systemPrompt, model, temperature) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
    const groqMsgs = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.content?.trim()).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model, messages: groqMsgs, temperature, max_tokens: 300 }),
    })
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || 'Could you repeat that?'
  },

  async _callGemini(messages, systemPrompt, model, temperature) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
    const filtered = messages.filter(m => m.content?.trim())
    const contents = []
    let lastRole = ''
    for (const m of filtered) {
      const role = m.role === 'assistant' ? 'model' : 'user'
      if (role === lastRole) continue
      contents.push({ role, parts: [{ text: m.content }] })
      lastRole = role
    }
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] })
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature, maxOutputTokens: 300 },
        }),
      }
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could you repeat that?'
  },
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  TTS + SEND TO VOBIZ                                                    ║
// ║  Text → Cartesia μ-law → playAudio chunks                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

async function sendTTSResponse(session, text) {
  if (!text || !session.ws || session.ws.readyState !== 1) return

  session.isAiSpeaking = true
  const ttsStart = Date.now()

  try {
    // Get μ-law 8kHz audio from Cartesia
    const audioBuffer = await TTS.synthesize(text)
    const ttsMs = Date.now() - ttsStart
    console.log(`   🔈 TTS: ${audioBuffer.length} bytes (${ttsMs}ms)`)

    // Send as 20ms chunks (160 bytes each for μ-law 8kHz)
    const CHUNK_SIZE = 160
    let offset = 0
    let chunksSent = 0

    while (offset < audioBuffer.length) {
      // Stop if barge-in happened or connection died
      if (!session.isAiSpeaking || session.ws.readyState !== 1) {
        console.log(`   ⚡ Playback interrupted at chunk ${chunksSent}`)
        break
      }

      const chunk = audioBuffer.slice(offset, offset + CHUNK_SIZE)

      session.ws.send(JSON.stringify({
        event: 'playAudio',
        media: {
          contentType: 'audio/x-mulaw',
          sampleRate: 8000,
          payload: chunk.toString('base64'),
        },
      }))

      offset += CHUNK_SIZE
      chunksSent++
    }

    console.log(`   📤 Sent ${chunksSent} audio chunks`)

    // Mark end of this response
    if (session.isAiSpeaking && session.ws.readyState === 1) {
      session.ws.send(JSON.stringify({
        event: 'checkpoint',
        streamId: session.streamId,
        name: `turn_${session.turnCount}`,
      }))
    }

  } catch (err) {
    console.error(`   ❌ TTS error: ${err.message}`)
  }

  // Allow a small window for audio to reach the network, then mark done
  setTimeout(() => { session.isAiSpeaking = false }, 300)
}


const TTS = {
  async synthesize(text) {
    if (!CARTESIA_API_KEY) throw new Error('CARTESIA_API_KEY not set')

    const res = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-2024-10-19',
        transcript: text,
        voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
        output_format: {
          container: 'raw',
          encoding: 'pcm_mulaw',
          sample_rate: 8000,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Cartesia ${res.status}: ${err}`)
    }

    return Buffer.from(await res.arrayBuffer())
  }
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  TELEPHONY COMMANDS — Outbound messages to Vobiz                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const TelephonyCommands = {
  /** Tell Vobiz to stop playing current audio (for barge-in) */
  clearAudio(session) {
    if (session.ws?.readyState === 1 && session.streamId) {
      session.ws.send(JSON.stringify({
        event: 'clearAudio',
        streamId: session.streamId,
      }))
      console.log('   🔇 clearAudio sent')
    }
  },
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  AGENT RESOLUTION (Phase 2+)                                            ║
// ║  Maps phone number → agent from vobiz_numbers table                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

async function resolveAgent(session) {
  if (!supabase) return

  try {
    const targetNumber = session.to

    if (targetNumber) {
      const { data: mapping } = await supabase
        .from('vobiz_numbers')
        .select('agent_id, user_id')
        .eq('phone_number', targetNumber)
        .eq('is_active', true)
        .single()

      if (mapping) {
        session.agentId = mapping.agent_id
        session.userId = mapping.user_id

        const { data: agent } = await supabase
          .from('agents').select('*').eq('id', mapping.agent_id).single()

        if (agent) {
          session.agent = agent
          console.log(`   ✅ Agent: "${agent.name}" (${session.agentId})`)
          return
        }
      }
    }

    // Fallback: use first available agent
    console.log('   ⚠️  No number mapping — trying fallback agent')
    const { data: agents } = await supabase.from('agents').select('*').limit(1)
    if (agents?.[0]) {
      session.agent = agents[0]
      session.agentId = agents[0].id
      session.userId = agents[0].user_id
      console.log(`   ↳ Fallback: "${agents[0].name}"`)
    }
  } catch (err) {
    console.error(`   ❌ Agent resolve failed: ${err.message}`)
  }
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  POST-CALL PROCESSOR (Phase 2+)                                         ║
// ║  Save call log → run analysis → create appointment                      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const PostCallProcessor = {
  async saveAndAnalyze(session) {
    if (!supabase || !session.userId || !session.agentId) {
      console.log('   ⏭️  Skip save — missing context')
      return
    }

    try {
      // Insert call log
      const { data: callLog, error } = await supabase
        .from('call_logs')
        .insert({
          user_id: session.userId,
          agent_id: session.agentId,
          agent_name: session.agent?.name || 'Unknown',
          call_date: new Date().toISOString(),
          call_type: 'Phone Call',
          from_number: session.from || '',
          to_number: session.to || '',
          duration_seconds: session.durationSec,
          status: session.durationSec > 5 ? 'completed' : 'missed',
          ended_by: 'caller',
          transcript_json: session.messages,
          summary: '',
        })
        .select('id')
        .single()

      if (error) {
        console.error(`   ❌ Save failed: ${error.message}`)
        return
      }

      console.log(`   💾 Call saved: ${callLog.id}`)

      // Post-call analysis
      const config = session.agent?.post_call_config
      if (config && session.messages.length >= 2) {
        console.log('   🔬 Running post-call analysis...')
        await PostCallProcessor._analyze(session, callLog.id, config)
      }

    } catch (err) {
      console.error(`   ❌ PostCall error: ${err.message}`)
    }
  },

  async _analyze(session, callLogId, rawConfig) {
    const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig
    const vars = config.variables?.filter(v => v.enabled) || []
    const opts = config.options || { call_summary: true, sentiment_analysis: true, extracted_information: true }

    const sections = []
    if (opts.extracted_information && vars.length > 0) {
      sections.push(`Extract: ${vars.map(v => `"${v.key}": ${v.label}`).join(', ')}`)
    }
    sections.push(`IMPORTANT: If the caller booked or requested an appointment, you MUST extract "appointment_date" (YYYY-MM-DD format or words like "tomorrow") and "appointment_time" (e.g., "4:00 PM"). If they did not, set these two fields to null.`)
    if (opts.call_summary) sections.push('Provide "call_summary": 2-3 sentence summary.')
    if (opts.sentiment_analysis) sections.push('Provide "sentiment": Positive, Neutral, or Negative.')

    const transcript = session.messages.map(m =>
      `${m.role === 'assistant' ? 'Assistant' : 'Caller'}: ${m.content}`
    ).join('\n')

    const prompt = `Analyze this clinic call. ${sections.join(' ')}\nReturn ONLY valid JSON.\n\nTRANSCRIPT:\n${transcript}\n\nJSON:`

    let analysis = {}
    try {
      if (GROQ_API_KEY) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1, max_tokens: 512,
            response_format: { type: 'json_object' },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          analysis = JSON.parse(data.choices?.[0]?.message?.content || '{}')
        }
      }
    } catch (e) {
      console.error(`   ⚠️  Analysis failed: ${e.message}`)
    }

    // Save analysis
    await supabase.from('call_logs')
      .update({ analysis, summary: analysis.call_summary || '' })
      .eq('id', callLogId)

    // Auto-create appointment if detected
    const rawDate = analysis.appointment_date ?? analysis.date
    const rawTime = analysis.appointment_time ?? analysis.time
    if (rawDate && rawTime) {
      const date = resolveVoiceDate(rawDate)
      const time = resolveVoiceTime(rawTime)
      if (!date || !time) {
        console.log(`   ⚠️  Could not resolve date/time — raw: "${rawDate}" / "${rawTime}"`)
      } else {
        let slotDuration = 30
        const { data: a } = await supabase.from('agents').select('slot_duration_minutes').eq('id', session.agentId).single()
        if (a?.slot_duration_minutes) slotDuration = a.slot_duration_minutes

        await supabase.from('appointments').insert({
          user_id: session.userId,
          agent_id: session.agentId,
          call_log_id: callLogId,
          patient_name: analysis.caller_name || analysis.name || 'Unknown',
          patient_phone: analysis.phone_number || '',
          doctor: analysis.doctor || null,
          department: analysis.department || null,
          appointment_date: date,
          appointment_time: time,
          slot_duration: slotDuration,
          status: 'scheduled',
          call_summary: analysis.call_summary || '',
          transcript,
          call_duration_seconds: session.durationSec,
          call_type: 'Phone Call',
          raw_analysis: analysis,
        })
        console.log(`   📅 Appointment created: ${date} at ${time}`)
      }
    }

    console.log('   ✅ Analysis complete')
  }
}

// ── Date/Time resolvers (mirrors post-call-analysis/route.ts) ───────────────

function resolveVoiceDate(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  const pad = n => String(n).padStart(2, '0')
  const nowUtc = new Date()
  const ist = new Date(nowUtc.getTime() + 5.5 * 3600000)
  const fmt = d => { const a = new Date(d.getTime() + 5.5*3600000); return `${a.getUTCFullYear()}-${pad(a.getUTCMonth()+1)}-${pad(a.getUTCDate())}` }

  if (lower === 'today') return fmt(ist)
  if (lower === 'tomorrow') { const t = new Date(ist); t.setUTCDate(t.getUTCDate()+1); return fmt(t) }
  if (lower === 'day after tomorrow') { const t = new Date(ist); t.setUTCDate(t.getUTCDate()+2); return fmt(t) }

  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const nextMatch = lower.match(/^next\s+(\w+)$/)
  if (nextMatch) {
    const target = days.indexOf(nextMatch[1])
    if (target !== -1) { const t = new Date(ist); const diff = (target - t.getUTCDay() + 7) % 7 || 7; t.setUTCDate(t.getUTCDate()+diff); return fmt(t) }
  }
  const dayMatch = lower.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/)
  if (dayMatch) {
    const target = days.indexOf(dayMatch[1])
    const t = new Date(ist); const diff = (target - t.getUTCDay() + 7) % 7 || 7; t.setUTCDate(t.getUTCDate()+diff); return fmt(t)
  }

  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const dm = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/)
  if (dm) { const day=parseInt(dm[1]), mon=months.indexOf(dm[2]), yr=dm[3]?parseInt(dm[3]):ist.getUTCFullYear(); if(mon!==-1&&day>=1&&day<=31) return `${yr}-${pad(mon+1)}-${pad(day)}` }
  const md = lower.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/)
  if (md) { const mon=months.indexOf(md[1]), day=parseInt(md[2]), yr=md[3]?parseInt(md[3]):ist.getUTCFullYear(); if(mon!==-1&&day>=1&&day<=31) return `${yr}-${pad(mon+1)}-${pad(day)}` }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  return null
}

function resolveVoiceTime(raw) {
  if (!raw) return null
  // Strip time ranges: "3:00 PM - 4:00 PM" → "3:00 PM"
  const stripped = raw
    .replace(/\s*[-\u2013]\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/\s+to\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .trim()
  const lower = stripped.toLowerCase().trim()
  const pad = n => String(n).padStart(2, '0')

  const colon = lower.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/)
  if (colon) { let h=parseInt(colon[1]),m=parseInt(colon[2]),ap=colon[3]; if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; return `${pad(h)}:${pad(m)}` }

  const oclock = lower.match(/^(\d{1,2})\s*o['\s]?clock(?:\s*(am|pm))?$/)
  if (oclock) { let h=parseInt(oclock[1]),ap=oclock[2]; if(ap==='pm'||(!ap&&h>=1&&h<=7))h=h<12?h+12:h; if(ap==='am'&&h===12)h=0; return `${pad(h)}:00` }

  const simple = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (simple) { let h=parseInt(simple[1]),m=simple[2]?parseInt(simple[2]):0,ap=simple[3]; if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; if(!ap&&h<8)h+=12; return `${pad(h)}:${pad(m)}` }

  if (lower==='noon') return '12:00'
  if (lower==='midnight') return '00:00'
  return null
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  START SERVER                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🎙️  Vocaldice Voice Server — Phase ${CURRENT_PHASE}                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  HTTP:     http://localhost:${PORT}                         ║
║  Answer:   http://localhost:${PORT}/answer  (POST)          ║
║  Hangup:   http://localhost:${PORT}/hangup  (POST)          ║
║  Stream:   ws://localhost:${PORT}/stream   (WebSocket)      ║
║  Health:   http://localhost:${PORT}/health  (GET)            ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  Phase 1: Hardcoded response — test telephony             ║
║  Phase 2: Real AI (change CURRENT_PHASE to 2)             ║
╠═══════════════════════════════════════════════════════════╣
║  ⚡ ngrok http ${PORT}                                      ║
║  Then set Vobiz Answer URL → https://<ngrok>/answer       ║
╚═══════════════════════════════════════════════════════════╝
`)
})
