import { NextResponse } from 'next/server';

// ─── Language maps ─────────────────────────────────────────────────────────────
const CARTESIA_LANG_MAP: Record<string, string> = {
  te: 'te', ta: 'ta', kn: 'kn', ml: 'ml', hi: 'hi',
  mr: 'mr', gu: 'gu', pa: 'pa', bn: 'bn', or: 'or',
  en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it',
  pt: 'pt', ja: 'ja', zh: 'zh', ko: 'ko', nl: 'nl',
  pl: 'pl', ru: 'ru', sv: 'sv', tr: 'tr', ar: 'ar',
  Telugu: 'te', Tamil: 'ta', Kannada: 'kn', Malayalam: 'ml',
  Hindi: 'hi', Marathi: 'mr', Gujarati: 'gu', Punjabi: 'pa',
  Bengali: 'bn', English: 'en', Spanish: 'es', French: 'fr',
  German: 'de', Italian: 'it', Portuguese: 'pt', Japanese: 'ja',
  Chinese: 'zh', Korean: 'ko', Arabic: 'ar',
}

const SARVAM_INDIAN_LANGS = new Set(['te', 'hi', 'ta', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or'])
const SARVAM_LANG_CODE: Record<string, string> = {
  te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN',
  mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', bn: 'bn-IN', or: 'od-IN',
  en: 'en-IN',
}
const SARVAM_VALID_SPEAKERS = new Set(['meera', 'pavithra', 'maitreyi', 'arvind', 'amol', 'amartya'])

// ─── Cartesia TTS ──────────────────────────────────────────────────────────────
// Uses sonic-3 — Cartesia's current model with full Indian language support.
// sonic-multilingual was the OLD model; sonic-3 is what VAPI/Omnidimension use.
async function cartesiaTTS(
  apiKey: string,
  voice_id: string,
  text: string,
  language: string
): Promise<Response> {
  return fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-3',
      transcript: text,
      voice: { mode: 'id', id: voice_id },
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 22050 },
      language,
    }),
  })
}

const isLangError = (body: string) =>
  body.includes('does not support language') ||
  body.includes('invalid model ID') ||
  body.includes('not supported')

// ─── Sarvam TTS (emergency fallback only) ─────────────────────────────────────
async function sarvamTTS(
  apiKey: string,
  text: string,
  langCode: string,
  speaker: string
): Promise<{ audioBuffer: Buffer; ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: langCode,
        speaker,
        model: 'bulbul:v2',
        enable_preprocessing: true,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      return { audioBuffer: Buffer.alloc(0), ok: false, error: err }
    }
    const data = await res.json()
    const base64Audio: string | undefined = data.audios?.[0]
    if (!base64Audio) return { audioBuffer: Buffer.alloc(0), ok: false, error: 'No audio in response' }
    return { audioBuffer: Buffer.from(base64Audio, 'base64'), ok: true }
  } catch (e: any) {
    return { audioBuffer: Buffer.alloc(0), ok: false, error: e.message }
  }
}

// ─── POST /api/webcall/speak ───────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { text, voice_id, language, sarvam_speaker } = await request.json()

    if (!text)     return NextResponse.json({ error: 'Missing text' },     { status: 400 })
    if (!voice_id) return NextResponse.json({ error: 'Missing voice_id' }, { status: 400 })

    const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
    const SARVAM_API_KEY   = process.env.SARVAM_API_KEY

    if (!CARTESIA_API_KEY) return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 })

    const langCode = CARTESIA_LANG_MAP[language] || 'en'
    console.log(`[TTS] model=sonic-3 voice=${voice_id} lang=${langCode} chars=${text.length}`)

    // ── Primary: Cartesia sonic-3 ────────────────────────────────────────────
    let res = await cartesiaTTS(CARTESIA_API_KEY, voice_id, text, langCode)
    let usedLang = langCode

    if (res.ok) {
      console.log(`[TTS] Cartesia sonic-3 OK — lang=${usedLang}`)
      return new NextResponse(res.body, {
        status: 200,
        headers: { 'Content-Type': 'audio/wav', 'X-Language-Used': usedLang, 'X-TTS-Provider': 'cartesia' },
      })
    }

    const errBody = await res.text()
    console.warn(`[TTS] Cartesia sonic-3 failed (${res.status}):`, errBody)

    // ── If the selected voice doesn't support this language, try 'en' ────────
    // NOTE: This usually means the wrong Cartesia voice is selected.
    // The user should pick a multilingual voice like "Sindhu" in Voice settings.
    if (isLangError(errBody) && langCode !== 'en') {
      console.warn(`[TTS] Voice doesn't support '${langCode}'. Trying 'en' — user should select a multilingual voice.`)
      const enRes = await cartesiaTTS(CARTESIA_API_KEY, voice_id, text, 'en')
      if (enRes.ok) {
        console.warn(`[TTS] Fell back to 'en' — text will be read in English. Fix: select a multilingual Cartesia voice.`)
        return new NextResponse(enRes.body, {
          status: 200,
          headers: { 'Content-Type': 'audio/wav', 'X-Language-Used': 'en', 'X-TTS-Provider': 'cartesia' },
        })
      }
    }

    // ── Emergency fallback: Sarvam bulbul:v2 for Indian languages ────────────
    if (SARVAM_INDIAN_LANGS.has(langCode) && SARVAM_API_KEY) {
      console.warn(`[TTS] Cartesia failed — emergency fallback to Sarvam bulbul:v2`)
      const sarvamLang = SARVAM_LANG_CODE[langCode] || 'hi-IN'
      const speaker    = SARVAM_VALID_SPEAKERS.has(sarvam_speaker) ? sarvam_speaker : 'meera'
      const { audioBuffer, ok, error } = await sarvamTTS(SARVAM_API_KEY, text, sarvamLang, speaker)
      if (ok) {
        console.log(`[TTS] Sarvam fallback OK — lang=${sarvamLang} speaker=${speaker}`)
        return new NextResponse(new Uint8Array(audioBuffer), {
          status: 200,
          headers: { 'Content-Type': 'audio/wav', 'X-Language-Used': langCode, 'X-TTS-Provider': 'sarvam' },
        })
      }
      console.error('[TTS] Sarvam fallback also failed:', error)
    }

    return NextResponse.json({ error: 'TTS failed', detail: errBody }, { status: 500 })

  } catch (error: any) {
    console.error('[TTS] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
