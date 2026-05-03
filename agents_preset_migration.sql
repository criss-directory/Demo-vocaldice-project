-- Vocaldice: Add preset + voice columns to agents table + backfill existing agents
-- Run AFTER presets_migration.sql (primary_preset_id references presets table)
-- Voice columns are plain TEXT — Cartesia is source of truth, no local voices table

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS primary_preset_id   TEXT REFERENCES presets(preset_id),
  ADD COLUMN IF NOT EXISTS primary_voice_id    TEXT,   -- Cartesia voice UUID
  ADD COLUMN IF NOT EXISTS secondary_preset_id TEXT REFERENCES presets(preset_id),
  ADD COLUMN IF NOT EXISTS secondary_voice_id  TEXT,   -- nullable
  ADD COLUMN IF NOT EXISTS fallback_voice_id   TEXT;   -- English fallback Cartesia voice UUID

-- Backfill 5 confirmed existing agents
-- Voice IDs confirmed from Supabase query on 2026-04-27

UPDATE agents SET
  primary_preset_id = 'telugu_v1',
  primary_voice_id  = '07bc462a-c644-49f1-baf7-82d5599131be'  -- Sindhu (Conversational Partner)
WHERE agent_name = 'Priya';

UPDATE agents SET
  primary_preset_id = 'telugu_v1',
  primary_voice_id  = '07bc462a-c644-49f1-baf7-82d5599131be'  -- Sindhu (Conversational Partner)
WHERE agent_name = 'Monisha';

UPDATE agents SET
  primary_preset_id = 'kannada_v1',
  primary_voice_id  = '7c6219d2-e8d2-462c-89d8-7ecba7c75d65'  -- Divya (Joyful Narrator)
WHERE agent_name = 'Aanya';

UPDATE agents SET
  primary_preset_id = 'hindi_v1',
  primary_voice_id  = '47f3bbb1-e98f-4e0c-92c5-5f0325e1e206'  -- Neha (Virtual Assistant)
WHERE agent_name = 'Neha';

UPDATE agents SET
  primary_preset_id = 'tamil_v1',
  primary_voice_id  = 'd2870b91-1b4c-47ab-81a8-3718d8e9c222'  -- Arun (Lively Voice)
WHERE agent_name = 'Arun';

-- Verify backfill (run manually after migration):
-- SELECT agent_name, primary_preset_id, primary_voice_id FROM agents
-- WHERE agent_name IN ('Priya', 'Monisha', 'Aanya', 'Neha', 'Arun');
