import type { VoiceSession } from './types'
import { transcribe } from './stt'
import { synthesizeSSE } from './tts'
import { resolvePresetAndVoice, loadPreset } from './preset-loader'

export interface StreamEvent {
  type: 'transcript' | 'audio' | 'audio_chunk' | 'sentence_end' | 'empty' | 'done' | 'error'
  text?:     string   // transcript text or sentence text
  audio?:    string   // base64 WAV (first-message only, legacy)
  data?:     string   // base64 raw PCM chunk (streaming TTS)
  sentence?: number   // sentence index (1-based)
  stt_ms?:   number
  llm_ms?:   number   // time to first sentence from LLM
  tts_ms?:   number
  error?:    string
}

// Aggressive 1-sentence rule — every extra token here adds ~5ms to first LLM token
const VOICE_RULE = `\nRULE: Reply in ONE short sentence only. Same language as user. Be warm.`

// ── Sentence splitter with abbreviation guard ──────────────────────────────
// Common abbreviations that end with "." but are NOT sentence endings
const ABBR_RE = /(?:డా|Dr|Mr|Mrs|Ms|St|vs|etc|Jr|Sr|Prof)\.\s*$/i
// Sentence-ending punctuation for Latin + Indian scripts
const SENTENCE_END_RE = /[.!?।॥\u0964\u0965](?:\s|$)/u

function trySplitSentence(buf: string): { sentence: string; remainder: string } | null {
  const match = SENTENCE_END_RE.exec(buf)
  if (!match) return null

  const candidate = buf.slice(0, match.index + 1).trim()
  const remainder = buf.slice(match.index + 1).trimStart()

  // Reject if it's just an abbreviation like "డా." or "Dr."
  if (candidate.length < 8 && ABBR_RE.test(candidate)) return null
  // Reject tiny fragments — they waste a TTS call
  if (candidate.length < 10) return null

  return { sentence: candidate, remainder }
}

// ── LLM token reader ───────────────────────────────────────────────────────
async function readStreamTokens(
  body: ReadableStream<Uint8Array>,
  provider: 'gemini' | 'groq',
  onToken: (token: string) => void
): Promise<void> {
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const json = line.replace(/^data:\s*/, '').trim()
      if (!json || json === '[DONE]') continue
      try {
        const data = JSON.parse(json)
        let token = ''
        if (provider === 'gemini') {
          token = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        } else {
          token = data?.choices?.[0]?.delta?.content ?? ''
        }
        if (token) onToken(token)
      } catch {}
    }
  }
}

// ── Keep conversation history lean for fast LLM responses ──────────────────
const MAX_HISTORY_MSGS = 6  // last 3 turns (6 messages) is enough context

/**
 * Streams LLM tokens, detects sentences, and fires SSE TTS in parallel.
 * LLM reading is NEVER blocked by TTS — sentences queue up and TTS
 * processes them as fast as it can.
 */
async function streamWithSentenceTTS(
  provider: 'gemini' | 'groq',
  model: string,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  session: VoiceSession,
  onSentence: (sentence: string) => Promise<void>,
  onFirstSentenceReady?: () => void,
): Promise<string> {
  let fetchRes: Response

  // Trim history to keep LLM fast
  const trimmedHistory = history.length > MAX_HISTORY_MSGS
    ? history.slice(-MAX_HISTORY_MSGS)
    : history

  if (provider === 'groq') {
    const GROQ_API_KEY = process.env.GROQ_API_KEY
    if (!GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY')
    fetchRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...trimmedHistory],
        temperature: 0.2,
        max_tokens: 150,
        stream: true,
      }),
    })
  } else {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY')

    const contents: { role: string; parts: { text: string }[] }[] = []
    let lastRole = ''
    for (const m of trimmedHistory) {
      const role = m.role === 'assistant' ? 'model' : 'user'
      if (role === lastRole) continue
      contents.push({ role, parts: [{ text: m.content }] })
      lastRole = role
    }
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] })
    }

    fetchRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 150,
            ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      }
    )
  }

  if (!fetchRes.ok || !fetchRes.body) {
    const err = await fetchRes.text()
    throw new Error(`${fetchRes.status}: ${err}`)
  }

  // ── Decoupled LLM reader + TTS processor ─────────────────────────────────
  const sentenceQueue: string[] = []
  let llmDone   = false
  let fullText  = ''
  let firstSentenceSignalled = false

  // LLM reader coroutine — synchronous onToken, never awaits TTS
  const llmReader = async () => {
    let sentenceBuf = ''
    await readStreamTokens(fetchRes.body!, provider, (token) => {
      sentenceBuf += token
      const split = trySplitSentence(sentenceBuf)
      if (split) {
        sentenceQueue.push(split.sentence)
        sentenceBuf = split.remainder
        if (!firstSentenceSignalled) {
          firstSentenceSignalled = true
          onFirstSentenceReady?.()
        }
      }
    })
    // Flush remaining text
    if (sentenceBuf.trim().length > 5) {
      sentenceQueue.push(sentenceBuf.trim())
    }
    llmDone = true
  }

  // TTS processor coroutine — processes sentences sequentially
  const ttsProcessor = async () => {
    let idx = 0
    while (true) {
      if (idx < sentenceQueue.length) {
        const sentence = sentenceQueue[idx]
        fullText += (fullText ? ' ' : '') + sentence
        await onSentence(sentence)
        idx++
      } else if (llmDone) {
        break
      } else {
        await new Promise(r => setTimeout(r, 5))
      }
    }
  }

  await Promise.all([llmReader(), ttsProcessor()])
  return fullText
}

export async function runTurnStream(
  session: VoiceSession,
  audioBuffer: Buffer,
  send: (event: StreamEvent) => void
): Promise<void> {
  const turnStart = Date.now()
  console.log(`[TURN_START] ${turnStart} | pipeline: pipeline-stream.ts (STREAMING SSE+PCM) | sessionId: ${session.session_id} | agent: ${session.agent.agent_name}`)

  // ── STT ──────────────────────────────────────────────────────────────────
  const sttStart  = Date.now()
  const sttResult = await transcribe(audioBuffer, session.preset, session.agent.stt_noise_reducer ?? false)
  const sttMs     = Date.now() - sttStart

  console.log(`[TURN_AFTER_STT] ${Date.now()} | elapsed_from_start: ${Date.now() - turnStart}ms | transcript: "${sttResult.transcript.slice(0, 60)}"`)

  if (!sttResult.transcript.trim()) {
    send({ type: 'empty' })
    return
  }

  // Browser sees transcript immediately
  send({ type: 'transcript', text: sttResult.transcript, stt_ms: sttMs })

  // Language switching on first detection
  const detectedLang = sttResult.language_code
  if (!session.detected_language && detectedLang) {
    session.detected_language = detectedLang
    const { presetId, voiceId } = resolvePresetAndVoice(session.agent, detectedLang)
    if (presetId !== session.preset.preset_id) {
      session.preset = await loadPreset(presetId)
    }
    session.voice = { voice_id: voiceId, language: session.preset.language }
  }

  session.history.push({ role: 'user', content: sttResult.transcript })

  // ── LLM streaming + SSE TTS ─────────────────────────────────────────────
  const provider     = (session.preset.llm_provider || 'groq') as 'gemini' | 'groq'
  const model        = session.preset.llm_model    || 'llama-3.1-8b-instant'
  const systemPrompt = (session.agent.system_prompt || '') + VOICE_RULE

  const history = session.history.map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const llmStart       = Date.now()
  let   firstSentence  = true
  let   sentenceIndex  = 0
  let   totalTtsMs     = 0
  let   fullResponse   = ''
  console.log(`[LLM_STREAM_START] ${llmStart} | provider: ${provider} | model: ${model} | streaming: YES (SSE + PCM TTS) | elapsed_from_turn_start: ${llmStart - turnStart}ms`)

  const onSentence = async (sentence: string) => {
    const sentenceN = ++sentenceIndex
    if (firstSentence) {
      console.log(`[LLM_FIRST_SENTENCE] ${Date.now()} | elapsed_from_llm_start: ${Date.now() - llmStart}ms | elapsed_from_turn_start: ${Date.now() - turnStart}ms | sentence: "${sentence.slice(0, 60)}"`)
    }

    const ttsStart = Date.now()
    let chunkCount = 0

    // Stream PCM chunks directly to the browser
    await synthesizeSSE(sentence, session.preset, session.voice, (base64Pcm) => {
      chunkCount++
      send({
        type:     'audio_chunk',
        data:     base64Pcm,
        sentence: sentenceN,
        ...(firstSentence && chunkCount === 1 ? { llm_ms: Date.now() - llmStart } : {}),
      })
    })

    const ttsMs = Date.now() - ttsStart
    totalTtsMs += ttsMs
    console.log(`[SENTENCE_TTS_DONE] ${Date.now()} | sentence: ${sentenceN} | tts_ms: ${ttsMs} | chunks: ${chunkCount} | elapsed_from_turn_start: ${Date.now() - turnStart}ms | first_audio_to_browser: ${firstSentence}`)

    fullResponse += (fullResponse ? ' ' : '') + sentence

    // Tell browser this sentence is done (for transcript display)
    send({ type: 'sentence_end', text: sentence, sentence: sentenceN })
    firstSentence = false
  }

  try {
    fullResponse = await streamWithSentenceTTS(provider, model, systemPrompt, history, session, onSentence)
  } catch (err: any) {
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      // Fallback: try gemini-2.5-flash-lite (lower quota tier) instead of Groq
      // Groq/Llama models cannot generate proper Indian language text
      console.warn('[pipeline-stream] Gemini 429 — retrying with gemini-2.0-flash-lite')
      try {
        fullResponse = await streamWithSentenceTTS('gemini' as any, 'gemini-2.0-flash-lite', systemPrompt, history, session, onSentence)
      } catch (err2: any) {
        console.warn('[pipeline-stream] Lite model also failed — last resort Groq')
        fullResponse = await streamWithSentenceTTS('groq', 'llama-3.1-8b-instant', systemPrompt, history, session, onSentence)
      }
    } else {
      throw err
    }
  }
  console.log(`[TURN_AFTER_LLM_TTS] ${Date.now()} | elapsed_from_start: ${Date.now() - turnStart}ms | total_sentences: ${sentenceIndex} | total_tts_ms: ${totalTtsMs}`)

  if (!fullResponse) {
    fullResponse = "I'm sorry, I didn't catch that. Could you please repeat?"
    // Fallback: stream this as PCM too
    await synthesizeSSE(fullResponse, session.preset, session.voice, (base64Pcm) => {
      send({ type: 'audio_chunk', data: base64Pcm, sentence: 1 })
    })
    send({ type: 'sentence_end', text: fullResponse, sentence: 1 })
  }

  session.history.push({ role: 'assistant', content: fullResponse })
  session.last_active = Date.now()

  const totalMs = Date.now() - turnStart
  console.log(`[TURN_END] ${Date.now()} | total_turn_ms: ${totalMs} | stt_ms: ${sttMs} | llm_to_first_sentence_ms: ${Date.now() - llmStart} | total_tts_ms: ${totalTtsMs}`)
  send({ type: 'done', stt_ms: sttMs, llm_ms: Date.now() - llmStart, tts_ms: totalTtsMs })
}
