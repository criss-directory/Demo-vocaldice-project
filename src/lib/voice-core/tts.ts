import type { PresetConfig, VoiceConfig } from './types'

export interface TTSResult {
  audio: Buffer     // WAV bytes (pcm_s16le, 22050 Hz)
  duration_ms: number
}

export interface TTSSSEResult {
  duration_ms: number
  totalBytes: number
}

const CARTESIA_LANG_MAP: Record<string, string> = {
  te: 'te', ta: 'ta', kn: 'kn', ml: 'ml', hi: 'hi',
  mr: 'mr', gu: 'gu', pa: 'pa', bn: 'bn',
  en: 'en', es: 'es', fr: 'fr', de: 'de', pt: 'pt',
  ja: 'ja', zh: 'zh', ko: 'ko', ar: 'ar',
}

/** Batch WAV synthesis — used for first-message greeting only */
export async function synthesize(
  text: string,
  preset: PresetConfig,
  voice: VoiceConfig,
  speed = 1.0
): Promise<TTSResult> {
  const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
  if (!CARTESIA_API_KEY) throw new Error('Missing CARTESIA_API_KEY')

  const start    = Date.now()
  const langCode = CARTESIA_LANG_MAP[voice.language] || 'en'
  console.log(`[TTS_START] ${start} | endpoint: /tts/bytes (batch WAV) | model: ${preset.tts_model} | voice_id: ${voice.voice_id} | language: ${langCode} | text_length: ${text.length}`)

  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': CARTESIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: preset.tts_model,
      transcript: text,
      voice: { mode: 'id', id: voice.voice_id },
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 22050 },
      language: langCode,
      ...(speed !== 1.0 ? { _experimental_voice_controls: { speed } } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cartesia TTS failed (${res.status}): ${err}`)
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer())
  const ttsMs = Date.now() - start
  console.log(`[TTS_FIRST_BYTE] ${start + ttsMs} | (batch endpoint: first byte == last byte == response received)`)
  console.log(`[TTS_END] ${Date.now()} | duration_ms: ${ttsMs} | audio_bytes: ${audioBuffer.length}`)
  return { audio: audioBuffer, duration_ms: ttsMs }
}

/**
 * SSE streaming TTS — first audio chunk in ~80-150ms instead of ~1000ms.
 * Streams raw PCM (pcm_s16le, 22050 Hz mono) chunks via onChunk callback.
 */
export async function synthesizeSSE(
  text: string,
  preset: PresetConfig,
  voice: VoiceConfig,
  onChunk: (base64Pcm: string) => void,
  speed = 1.0
): Promise<TTSSSEResult> {
  const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
  if (!CARTESIA_API_KEY) throw new Error('Missing CARTESIA_API_KEY')

  const start    = Date.now()
  const langCode = CARTESIA_LANG_MAP[voice.language] || 'en'
  console.log(`[TTS_SSE_START] ${start} | endpoint: /tts/sse (streaming) | model: ${preset.tts_model} | voice_id: ${voice.voice_id} | language: ${langCode} | text_length: ${text.length}`)

  const res = await fetch('https://api.cartesia.ai/tts/sse', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': CARTESIA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: preset.tts_model,
      transcript: text,
      voice: { mode: 'id', id: voice.voice_id },
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 22050 },
      language: langCode,
      ...(speed !== 1.0 ? { generation_config: { speed } } : {}),
    }),
  })

  if (!res.ok || !res.body) {
    const err = await res.text()
    throw new Error(`Cartesia SSE TTS failed (${res.status}): ${err}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf        = ''
  let totalBytes = 0
  let firstChunk = true

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
        const ev = JSON.parse(json) as { type?: string; data?: string; done?: boolean }
        if (ev.type === 'chunk' && ev.data) {
          if (firstChunk) {
            console.log(`[TTS_SSE_FIRST_CHUNK] ${Date.now()} | elapsed_ms: ${Date.now() - start}`)
            firstChunk = false
          }
          onChunk(ev.data)
          totalBytes += Math.floor(ev.data.length * 3 / 4)
        }
      } catch { /* skip malformed SSE lines */ }
    }
  }

  const duration = Date.now() - start
  console.log(`[TTS_SSE_END] ${Date.now()} | duration_ms: ${duration} | total_bytes: ${totalBytes}`)
  return { duration_ms: duration, totalBytes }
}
