// VoiceAgent Core — type contracts
// Implementations live in the sibling files; this file defines the shape only.

export interface PresetConfig {
  preset_id: string
  language: string          // 'te' | 'kn' | 'ta' | 'ml' | 'hi' | 'en'
  language_code: string     // 'TE' | 'KN' etc. (UI badge)
  language_name: string     // 'Telugu' | 'Kannada' etc.

  stt_provider: string      // 'sarvam'
  stt_model: string         // 'saarika:v2.5'
  stt_language_code: string // 'te-IN' | 'kn-IN' etc.

  llm_provider: string      // 'gemini'
  llm_model: string         // 'gemini-2.5-flash'

  tts_provider: string      // 'cartesia'
  tts_model: string         // 'sonic-3'
}

export interface VoiceConfig {
  voice_id: string   // Cartesia voice UUID
  language: string   // 'te' | 'kn' etc.
}

export interface AgentRow {
  id: string
  user_id: string | null
  agent_name: string
  clinic_name: string | null
  system_prompt: string
  first_message: string
  first_message_mode: string
  voice_speed: number
  stt_silence_timeout: number
  stt_noise_reducer: boolean

  // Preset architecture columns (nullable for legacy agents on old schema)
  primary_preset_id:   string | null
  primary_voice_id:    string | null
  secondary_preset_id: string | null
  secondary_voice_id:  string | null
  fallback_voice_id:   string | null

  // Legacy columns (used as fallback when preset columns are null)
  voice_id:       string | null
  llm_provider:   string | null
  llm_model:      string | null
  stt_model:      string | null
  stt_language:   string | null
  primary_language: string | null
}

export interface TurnResult {
  transcript: string        // what the user said
  response: string          // what the agent replied
  detected_language: string // language Sarvam detected (e.g. 'te-IN')
  tts_audio: Buffer         // WAV bytes from Cartesia
  latency: {
    stt_ms: number
    llm_ms: number
    tts_ms: number
  }
}

export interface VoiceSession {
  session_id: string
  agent_id: string
  preset: PresetConfig
  voice: VoiceConfig
  agent: AgentRow
  history: { role: 'user' | 'assistant'; content: string }[]
  detected_language: string | null  // locked after first confident detection
  created_at: number                // Date.now() — for 30-min TTL check
  last_active: number               // Date.now() — updated each turn
}
