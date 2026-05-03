import { NextRequest, NextResponse } from 'next/server'
import { loadAgent, loadPreset, resolvePresetAndVoice } from '@/lib/voice-core/preset-loader'
import { createSession, purgeExpired } from '@/lib/voice-core/session'
import { synthesize } from '@/lib/voice-core/tts'

const LANG_CODE_TO_NAME: Record<string, string> = {
  te: 'Telugu', kn: 'Kannada', ta: 'Tamil', ml: 'Malayalam', hi: 'Hindi', en: 'English',
}

type FirstMsgFn = (agentName: string, clinicName: string) => string
const FIRST_MSG_FALLBACKS: Record<string, FirstMsgFn> = {
  te: (n, c) => `నమస్కారం! ${c} కి call chesinanduku thanks. Nenu ${n}. Ela help cheyali?`,
  kn: (n, c) => `ನಮಸ್ಕಾರ! ${c}ಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ. ನಾನು ${n}. ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`,
  ta: (n, c) => `வணக்கம்! ${c}-க்கு அழைத்தமைக்கு நன்றி. நான் ${n}. எவ்வாறு உதவலாம்?`,
  ml: (n, c) => `നമസ്കാരം! ${c}ലേക്ക് വിളിച്ചതിന് നന്ദി. ഞാൻ ${n}. എങ്ങനെ സഹായിക്കാം?`,
  hi: (n, c) => `नमस्कार! ${c} में आपका स्वागत है। मैं ${n} हूँ। कैसे मदद करूँ?`,
  en: (n, c) => `Thank you for calling ${c}. This is ${n}, how may I help you today?`,
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    purgeExpired()

    const { agentId } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 })

    // Extract auth token so loadAgent can satisfy RLS on the agents table
    const authHeader  = req.headers.get('Authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    // 1. Load agent
    const agent = await loadAgent(agentId, accessToken)

    // Resolve preset and voice ID resiliently (handles legacy missing preset ID)
    const { presetId, voiceId: resolvedVoiceId } = resolvePresetAndVoice(agent, null)

    // 2. Load preset
    const preset = await loadPreset(presetId)

    // 3. Defensive voice check — warn if saved voice is no longer in Cartesia
    const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
    if (!CARTESIA_API_KEY) return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 })

    let voiceId = resolvedVoiceId || ''
    try {
      const voiceRes = await fetch(
        `https://api.cartesia.ai/voices?language=${preset.language}&limit=100`,
        { headers: { 'X-API-Key': CARTESIA_API_KEY, 'Cartesia-Version': '2024-06-10' } }
      )
      if (voiceRes.ok) {
        const voiceData = await voiceRes.json() as any
        const voices: any[] = Array.isArray(voiceData) ? voiceData : (voiceData.voices || [])
        const voiceIds = new Set(voices.map((v: any) => v.id))
        if (!voiceId || !voiceIds.has(voiceId)) {
          const fallback = voices[0]
          if (fallback?.id) {
            console.warn(`[session/start] Voice "${voiceId}" not in Cartesia for lang=${preset.language} — using fallback: ${fallback.name} (${fallback.id})`)
            voiceId = fallback.id
          }
        }
      }
    } catch (e) {
      console.warn('[session/start] Cartesia voice check skipped:', e)
    }

    if (!voiceId) {
      return NextResponse.json({ error: 'No valid voice found for this agent' }, { status: 400 })
    }

    const voiceConfig = { voice_id: voiceId, language: preset.language }

    // 4. Create session
    const session = createSession(agentId, preset, voiceConfig, agent)

    // 5. Build first message
    const agentName  = agent.agent_name  || 'your assistant'
    const clinicName = agent.clinic_name || ''
    const firstMessage = (agent.first_message || '').trim() ||
      (FIRST_MSG_FALLBACKS[preset.language] || FIRST_MSG_FALLBACKS.en)(agentName, clinicName)

    session.history.push({ role: 'assistant', content: firstMessage })

    // 6. Synthesize first message → base64 WAV
    const ttsResult = await synthesize(firstMessage, preset, voiceConfig)

    return NextResponse.json({
      sessionId:          session.session_id,
      firstMessage,
      firstMessageAudio:  ttsResult.audio.toString('base64'),
      preset: {
        language:     preset.language,
        languageName: LANG_CODE_TO_NAME[preset.language] || preset.language,
      },
    })
  } catch (err: any) {
    console.error('[session/start] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
