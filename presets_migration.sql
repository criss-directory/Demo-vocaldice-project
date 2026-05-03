-- Vocaldice: Create presets table + seed 6 language presets
-- Run BEFORE agents_preset_migration.sql
-- Voices are NOT stored here — they are pulled live from Cartesia GET /voices

CREATE TABLE IF NOT EXISTS presets (
  preset_id         TEXT PRIMARY KEY,
  language          TEXT NOT NULL,
  language_code     TEXT NOT NULL,         -- UI badge: 'TE' | 'KN' | 'TA' | 'ML' | 'HI' | 'EN'
  language_name     TEXT NOT NULL,

  -- STT (locked by founder)
  stt_provider      TEXT NOT NULL DEFAULT 'sarvam',
  stt_model         TEXT NOT NULL DEFAULT 'saarika:v2.5',
  stt_language_code TEXT NOT NULL,         -- 'te-IN' | 'kn-IN' | 'ta-IN' | 'ml-IN' | 'hi-IN' | 'en-IN'

  -- LLM (locked by founder)
  llm_provider      TEXT NOT NULL DEFAULT 'gemini',
  llm_model         TEXT NOT NULL DEFAULT 'gemini-2.5-flash',

  -- TTS provider (locked; voice within it is user-chosen separately on the agent)
  tts_provider      TEXT NOT NULL DEFAULT 'cartesia',
  tts_model         TEXT NOT NULL DEFAULT 'sonic-3',

  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON presets TO anon, authenticated;

INSERT INTO presets (preset_id, language, language_code, language_name, stt_language_code) VALUES
  ('telugu_v1',    'te', 'TE', 'Telugu',    'te-IN'),
  ('kannada_v1',   'kn', 'KN', 'Kannada',   'kn-IN'),
  ('tamil_v1',     'ta', 'TA', 'Tamil',     'ta-IN'),
  ('malayalam_v1', 'ml', 'ML', 'Malayalam', 'ml-IN'),
  ('hindi_v1',     'hi', 'HI', 'Hindi',     'hi-IN'),
  ('english_in_v1','en', 'EN', 'English',   'en-IN')
ON CONFLICT (preset_id) DO NOTHING;
