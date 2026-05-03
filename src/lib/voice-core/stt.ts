import type { PresetConfig } from './types'

export interface STTResult {
  transcript: string
  language_code: string   // as returned by Sarvam e.g. 'te-IN'
  duration_ms: number
}

export async function transcribe(
  audioBuffer: Buffer,
  preset: PresetConfig,
  noiseReducer = false
): Promise<STTResult> {
  const SARVAM_API_KEY = process.env.SARVAM_API_KEY
  if (!SARVAM_API_KEY) throw new Error('Missing SARVAM_API_KEY')

  const start = Date.now()
  console.log(`[STT_START] ${start} | model: ${preset.stt_model} | language: ${preset.stt_language_code} | audio_bytes: ${audioBuffer.length} | endpoint: https://api.sarvam.ai/speech-to-text (batch)`)

  const body = new FormData()
  body.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'audio.webm')
  body.append('language_code', preset.stt_language_code)
  body.append('model', preset.stt_model)
  body.append('with_disfluences', noiseReducer ? 'false' : 'true')

  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_API_KEY },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sarvam STT failed (${res.status}): ${err}`)
  }

  const data = await res.json() as { transcript?: string; language_code?: string }
  const transcript = data.transcript || ''
  console.log(`[STT_END] ${Date.now()} | duration_ms: ${Date.now() - start} | transcript_length: ${transcript.length} | detected_lang: ${data.language_code || preset.stt_language_code}`)
  return {
    transcript,
    language_code: data.language_code || preset.stt_language_code,
    duration_ms:   Date.now() - start,
  }
}
