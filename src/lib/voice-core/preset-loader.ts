import { createClient } from '@supabase/supabase-js'
import type { PresetConfig, VoiceConfig, AgentRow } from './types'

const presetCache = new Map<string, { cfg: PresetConfig; ts: number }>()
const agentCache  = new Map<string, { row: AgentRow; ts: number }>()
const AGENT_TTL_MS  = 60_000
const PRESET_TTL_MS = 5 * 60_000

// preset_id prefix → ISO 639-1 language code
const PRESET_LANG: Record<string, string> = {
  telugu_v1:    'te',
  kannada_v1:   'kn',
  tamil_v1:     'ta',
  malayalam_v1: 'ml',
  hindi_v1:     'hi',
  english_in_v1:'en',
}

function getSupabase(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Use service role key for server-side queries if available — bypasses RLS cleanly.
  // Falls back to anon key (requires policies to allow SELECT).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key,
    accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}
  )
}

export async function loadPreset(presetId: string): Promise<PresetConfig> {
  const cached = presetCache.get(presetId)
  if (cached && Date.now() - cached.ts < PRESET_TTL_MS) return cached.cfg

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('presets')
    .select('*')
    .eq('preset_id', presetId)
    .eq('is_active', true)
    .single()

  if (error || !data) throw new Error(`Preset not found: ${presetId} — ${error?.message}`)
  presetCache.set(presetId, { cfg: data as PresetConfig, ts: Date.now() })
  return data as PresetConfig
}

export async function loadAgent(agentId: string, accessToken?: string): Promise<AgentRow> {
  const cached = agentCache.get(agentId)
  if (cached && Date.now() - cached.ts < AGENT_TTL_MS) return cached.row

  const supabase = getSupabase(accessToken)
  const { data, error } = await supabase
    .from('agents')
    .select([
      'id', 'user_id', 'agent_name', 'clinic_name',
      'system_prompt', 'first_message', 'first_message_mode',
      'voice_speed', 'stt_silence_timeout', 'stt_noise_reducer',
      'primary_preset_id', 'primary_voice_id',
      'secondary_preset_id', 'secondary_voice_id', 'fallback_voice_id',
      'voice_id', 'llm_provider', 'llm_model', 'stt_model', 'stt_language', 'primary_language',
    ].join(', '))
    .eq('id', agentId)
    .single()

  if (error || !data) throw new Error(`Agent not found: ${agentId} — ${error?.message}`)
  const row = data as unknown as AgentRow
  agentCache.set(agentId, { row, ts: Date.now() })
  return row
}

export async function getConfigsForCall(
  agentId: string,
  detectedLanguage: string | null
): Promise<{ preset: PresetConfig; voice: VoiceConfig }> {
  const agent = await loadAgent(agentId)
  const { presetId, voiceId } = resolvePresetAndVoice(agent, detectedLanguage)
  const preset = await loadPreset(presetId)
  return { preset, voice: { voice_id: voiceId, language: preset.language } }
}

export function resolvePresetAndVoice(
  agent: AgentRow,
  detectedLanguage: string | null
): { presetId: string; voiceId: string } {
  const lang = detectedLanguage ? detectedLanguage.split('-')[0].toLowerCase() : null

  // Helper to map accidental short-codes (te_v1) to full DB preset names
  const sanitizePreset = (preset: string) => {
    const map: Record<string, string> = {
      te_v1: 'telugu_v1', kn_v1: 'kannada_v1', ta_v1: 'tamil_v1',
      ml_v1: 'malayalam_v1', hi_v1: 'hindi_v1', en_v1: 'english_in_v1',
      mr_v1: 'marathi_v1', gu_v1: 'gujarati_v1', bn_v1: 'bengali_v1',
      pa_v1: 'punjabi_v1', or_v1: 'odia_v1'
    }
    return map[preset] || preset
  }

  // English caller → use English fallback voice
  if (lang === 'en' && agent.fallback_voice_id) {
    return { presetId: 'english_in_v1', voiceId: agent.fallback_voice_id }
  }

  // Detected language matches secondary preset
  if (lang && agent.secondary_preset_id && agent.secondary_voice_id) {
    const sanitizedSec = sanitizePreset(agent.secondary_preset_id)
    const secLang = PRESET_LANG[sanitizedSec]
    if (secLang === lang) {
      return { presetId: sanitizedSec, voiceId: agent.secondary_voice_id }
    }
  }

  // Primary preset (normal path)
  if (agent.primary_preset_id && agent.primary_voice_id) {
    return { presetId: sanitizePreset(agent.primary_preset_id), voiceId: agent.primary_voice_id }
  }

  // Legacy fallback for agents on old schema
  const legacyPreset = agent.primary_language ? sanitizePreset(`${agent.primary_language}_v1`) : 'english_in_v1'
  const legacyVoice  = agent.voice_id || ''
  return { presetId: legacyPreset, voiceId: legacyVoice }
}
