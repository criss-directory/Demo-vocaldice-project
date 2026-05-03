import type { VoiceSession, TurnResult } from './types'
import { transcribe } from './stt'
import { getResponse } from './llm'
import { synthesize } from './tts'
import { resolvePresetAndVoice, loadPreset } from './preset-loader'

export async function runTurn(
  session: VoiceSession,
  audio: Buffer
): Promise<TurnResult> {
  const turnStart = Date.now()
  console.log(`[TURN_START] ${turnStart} | pipeline: pipeline.ts (OLD non-streaming) | sessionId: ${session.session_id} | agent: ${session.agent.agent_name}`)

  // ── STT ──────────────────────────────────────────────────────────────────────
  const sttResult = await transcribe(
    audio,
    session.preset,
    session.agent.stt_noise_reducer
  )

  // ── Language switching ────────────────────────────────────────────────────────
  // If this is the first confident detection, lock it and switch preset/voice if needed
  const detectedLang = sttResult.language_code // e.g. 'te-IN'
  if (!session.detected_language && detectedLang) {
    session.detected_language = detectedLang
    const { presetId, voiceId } = resolvePresetAndVoice(session.agent, detectedLang)
    if (presetId !== session.preset.preset_id) {
      session.preset = await loadPreset(presetId)
    }
    session.voice = { voice_id: voiceId, language: session.preset.language }
  }

  console.log(`[TURN_AFTER_STT] ${Date.now()} | elapsed_from_start: ${Date.now() - turnStart}ms | transcript: "${sttResult.transcript.slice(0, 60)}"`)

  // ── History update (user turn) ────────────────────────────────────────────────
  session.history.push({ role: 'user', content: sttResult.transcript })

  // ── LLM ──────────────────────────────────────────────────────────────────────
  const llmResult = await getResponse(sttResult.transcript, session)
  console.log(`[TURN_AFTER_LLM] ${Date.now()} | elapsed_from_start: ${Date.now() - turnStart}ms`)

  // ── History update (assistant turn) ──────────────────────────────────────────
  session.history.push({ role: 'assistant', content: llmResult.response })

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const speed = session.agent.voice_speed ?? 1.0
  const ttsResult = await synthesize(llmResult.response, session.preset, session.voice, speed)
  console.log(`[TURN_AFTER_TTS] ${Date.now()} | elapsed_from_start: ${Date.now() - turnStart}ms`)

  session.last_active = Date.now()
  console.log(`[TURN_END] ${Date.now()} | total_turn_ms: ${Date.now() - turnStart}`)

  return {
    transcript:        sttResult.transcript,
    response:          llmResult.response,
    detected_language: detectedLang,
    tts_audio:         ttsResult.audio,
    latency: {
      stt_ms: sttResult.duration_ms,
      llm_ms: llmResult.duration_ms,
      tts_ms: ttsResult.duration_ms,
    },
  }
}
