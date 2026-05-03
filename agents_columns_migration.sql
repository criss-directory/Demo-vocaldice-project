-- ══════════════════════════════════════════════════════════════════
--  agents table — add missing columns
--  Run this in your Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- First message the agent speaks at the start of every call
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS first_message        TEXT,
  ADD COLUMN IF NOT EXISTS first_message_mode   TEXT DEFAULT 'Assistant speaks first';

-- Extra columns saved from the agent detail tabs
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS stt_model            TEXT DEFAULT 'saarika:v2',
  ADD COLUMN IF NOT EXISTS stt_language         TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS stt_silence_timeout  INTEGER DEFAULT 800,
  ADD COLUMN IF NOT EXISTS stt_noise_reducer    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sarvam_speaker       TEXT DEFAULT 'meera',
  ADD COLUMN IF NOT EXISTS llm_provider         TEXT DEFAULT 'groq',
  ADD COLUMN IF NOT EXISTS llm_model            TEXT DEFAULT 'llama-3.1-8b-instant',
  ADD COLUMN IF NOT EXISTS llm_temperature      NUMERIC DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS voice_speed          NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS greeting             TEXT;

-- Confirm columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'agents'
  AND column_name IN (
    'first_message', 'first_message_mode',
    'stt_model', 'stt_language', 'stt_silence_timeout', 'stt_noise_reducer',
    'sarvam_speaker', 'llm_provider', 'llm_model', 'llm_temperature',
    'voice_speed', 'slot_duration_minutes', 'greeting'
  )
ORDER BY column_name;
