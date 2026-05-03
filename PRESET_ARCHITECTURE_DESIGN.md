# PRESET ARCHITECTURE DESIGN — Vocaldice

> Design only. No code changed. Decisions locked in Day 1 + Day 2 review.

---

## Core Principle

**Presets lock the stack (STT + LLM). Voices are user-chosen.**

Clinics never touch STT provider, STT model, or LLM model — those are founder-controlled per language. But within a language, the clinic picks any available Cartesia voice (male or female) as their agent's personality.

---

## 1. New `presets` Table

One row per language. Stores the locked STT + LLM stack. **No voice ID here** — voices are in a separate table.

```sql
CREATE TABLE presets (
  preset_id         TEXT PRIMARY KEY,     -- 'telugu_v1' | 'kannada_v1' | etc.
  language          TEXT NOT NULL,        -- 'te' | 'kn' | 'ta' | 'ml' | 'hi' | 'en'
  language_code     TEXT NOT NULL,        -- UI badge: 'TE' | 'KN' | 'TA' | 'ML' | 'HI' | 'EN'
  language_name     TEXT NOT NULL,        -- 'Telugu' | 'Kannada' | 'Tamil' | etc.

  -- STT (locked by founder)
  stt_provider      TEXT NOT NULL DEFAULT 'sarvam',
  stt_model         TEXT NOT NULL DEFAULT 'saarika:v2.5',
  stt_language_code TEXT NOT NULL,        -- 'te-IN' | 'kn-IN' | 'ta-IN' | 'ml-IN' | 'hi-IN' | 'en-IN'

  -- LLM (locked by founder)
  llm_provider      TEXT NOT NULL DEFAULT 'gemini',
  llm_model         TEXT NOT NULL DEFAULT 'gemini-2.5-flash',

  -- TTS provider (locked, but voice within it is user-chosen)
  tts_provider      TEXT NOT NULL DEFAULT 'cartesia',
  tts_model         TEXT NOT NULL DEFAULT 'sonic-3',

  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON presets TO anon, authenticated;
```

### V1.0 Seed — 6 Presets (one per language)

| preset_id | language | language_code | stt_language_code | llm_model |
|---|---|---|---|---|
| `telugu_v1` | te | TE | te-IN | gemini-2.5-flash |
| `kannada_v1` | kn | KN | kn-IN | gemini-2.5-flash |
| `tamil_v1` | ta | TA | ta-IN | gemini-2.5-flash |
| `malayalam_v1` | ml | ML | ml-IN | gemini-2.5-flash |
| `hindi_v1` | hi | HI | hi-IN | gemini-2.5-flash |
| `english_in_v1` | en | EN | en-IN | gemini-2.5-flash |

> Note on Gemini model ID: verify exact API model string (`gemini-2.5-flash` or `gemini-flash-latest`) against Google AI Studio docs before seeding. The API model ID must match exactly what the Gemini REST endpoint accepts.

---

## 2. Voice List — Live from Cartesia API (No voices table)

Voices are pulled live from Cartesia's `GET /voices` endpoint. **No Supabase `voices` table needed.** Cartesia is the source of truth — new voices appear automatically when Cartesia adds them.

### How it works

```
Wizard loads language "Telugu"
→ Browser calls GET /api/voices?language=te
→ Our Next.js route calls Cartesia:
    GET https://api.cartesia.ai/voices
      ?language=te
      &expand[]=preview_file_url
      &limit=100
    Header: Authorization: Bearer sk_car_...
    Header: Cartesia-Version: 2026-03-01
→ Cartesia returns all voices for Telugu with gender + preview URL
→ Our route maps and returns to browser
```

### Cartesia Voice object (from API)

```json
{
  "id": "07bc462a-c644-49f1-baf7-82d5599131be",
  "name": "Sindhu",
  "description": "Conversational Partner",
  "language": "te",
  "gender": "feminine",           // "masculine" | "feminine" | "gender_neutral"
  "is_public": true,
  "preview_file_url": "https://..."  // requires Authorization header — proxied
}
```

### Gender mapping for UI badges

| Cartesia value | UI badge | Color |
|---|---|---|
| `feminine` | `[F]` | Rose/pink |
| `masculine` | `[M]` | Blue |
| `gender_neutral` | `[N]` | Gray |

### Preview audio — requires proxy

Cartesia's `preview_file_url` requires the API key in the Authorization header. Browser `<audio>` tags cannot send custom headers, so we proxy it:

```
User clicks "Preview" on a voice card
→ Browser calls GET /api/voices/{voice_id}/preview
→ Our route fetches preview_file_url from Cartesia with auth header
→ Streams audio bytes back to browser
→ Browser plays it
```

No credits consumed — preview URLs are free to fetch per Cartesia docs.

---

## 3. Modified `agents` Table

### Add (migration step)

```sql
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS primary_preset_id   TEXT REFERENCES presets(preset_id),
  ADD COLUMN IF NOT EXISTS primary_voice_id    TEXT,   -- Cartesia voice UUID (no FK — live from API)
  ADD COLUMN IF NOT EXISTS secondary_preset_id TEXT REFERENCES presets(preset_id),
  ADD COLUMN IF NOT EXISTS secondary_voice_id  TEXT,   -- Cartesia voice UUID (nullable)
  ADD COLUMN IF NOT EXISTS fallback_voice_id   TEXT;   -- Cartesia voice UUID for English fallback
  -- voice columns are plain TEXT — Cartesia is the source of truth, no local voices table
```

**What each field means:**
- `primary_preset_id` — locks STT+LLM for primary language (e.g. `telugu_v1`)
- `primary_voice_id` — the Cartesia voice the clinic chose for primary language (e.g. Sindhu)
- `secondary_preset_id` — STT+LLM for secondary language (nullable)
- `secondary_voice_id` — Cartesia voice for secondary language (nullable)
- `fallback_voice_id` — English fallback voice (default: the `english_in_v1` female voice; customizable)

### Deprecate (keep until Phase 4, then drop)

```
voice_id, voice_name, llm_provider, llm_model, llm_temperature,
stt_model, stt_language, sarvam_speaker, languages, primary_language
```

### Keep permanently

```
id, user_id, name, agent_name, clinic_name, clinic_address, clinic_phone,
doctor_names, specialties, working_hours, use_cases, faqs, system_prompt,
first_message, first_message_mode, greeting, status, phone_number,
stt_silence_timeout, stt_noise_reducer, voice_speed, slot_duration_minutes,
post_call_config, created_at, updated_at
```

---

## 4. VoiceAgent Core Service

### File Structure

```
src/lib/voice-core/
  index.ts          — public API
  types.ts          — PresetConfig, VoiceConfig, VoiceSession, TurnResult
  preset-loader.ts  — loadPreset(), loadVoice(), getConfigsForCall()
  session.ts        — createSession(), VoiceSession class
  pipeline.ts       — runTurn() orchestration
  stt.ts            — Sarvam transcribe()
  llm.ts            — Gemini getResponse()
  tts.ts            — Cartesia synthesize()
```

### Public Interface

```ts
// Load preset (STT+LLM config) and voice (Cartesia ID) for this agent + detected language
export function getConfigsForCall(
  agentId: string,
  detectedLanguage: string | null
): Promise<{ preset: PresetConfig; voice: VoiceConfig }>

// Create a new session for one call
export function createSession(
  agentId: string,
  preset: PresetConfig,
  voice: VoiceConfig,
  agent: AgentRow
): VoiceSession

// Run one full turn: audio → STT → LLM → TTS
export function runTurn(
  session: VoiceSession,
  audio: Buffer
): Promise<TurnResult>
```

### Preset + Voice Loading

```ts
// Language detection logic:
// 1. detectedLanguage matches secondary preset language → use secondary preset + secondary_voice_id
// 2. detectedLanguage is 'en' → use english_in_v1 preset + fallback_voice_id
// 3. Otherwise → use primary preset + primary_voice_id

async function getConfigsForCall(agentId, detectedLanguage) {
  const agent = await loadAgent(agentId)           // cached
  const preset = await resolvePreset(agent, detectedLanguage)
  const voiceId = resolveVoiceId(agent, detectedLanguage)
  const voice = await loadVoice(voiceId)           // cached
  return { preset, voice }
}
```

### Server-Side Session Storage (Pipeline B)

Pipeline B (web calls via Next.js API routes) uses server-side sessions — browser sends `session_id` per turn, not full conversation history.

```
POST /api/webcall/session/start   → creates session, returns session_id
POST /api/webcall/transcribe      → body: { file, session_id }
POST /api/webcall/respond         → body: { transcript, session_id }
POST /api/webcall/speak           → body: { text, session_id }
POST /api/webcall/session/end     → cleanup, save call log
```

Sessions stored in server-side `Map<session_id, VoiceSession>`, expire after 30 min inactivity. No Redis needed for V1.0.

### Pipeline C (Telephony)

`voice-server.mjs` holds `VoiceSession` in `CallSession` for full call duration. `resolveAgent()` calls `core.getConfigsForCall()` at call start, caches result in session.

---

## 5. API Endpoints

### `GET /api/presets`

Returns all active presets (language stacks). Used when wizard loads.

```json
{
  "presets": [
    { "preset_id": "telugu_v1", "language": "te", "language_code": "TE", "language_name": "Telugu" },
    { "preset_id": "kannada_v1", "language": "kn", "language_code": "KN", "language_name": "Kannada" }
  ]
}
```

### `GET /api/voices?language=te`

Returns all active voices for a language. Used by wizard voice picker and voice picker modal.

```json
{
  "voices": [
    {
      "voice_id": "07bc462a-...",
      "voice_name": "Sindhu",
      "voice_label": "Sindhu — Telugu Female",
      "language_code": "TE",
      "gender": "F",
      "quality_rating": "excellent",
      "expected_latency_ms": 1400,
      "preview_audio_url": "https://..."
    },
    {
      "voice_id": "...",
      "voice_name": "Ravi",
      "voice_label": "Ravi — Telugu Male",
      "language_code": "TE",
      "gender": "M",
      ...
    }
  ]
}
```

### `GET /api/voices/:voice_id/preview`

Serves or redirects to the 5-second preview audio for "Preview Voice" button.

---

## 6. Wizard — "Choose Voice Engines" Step

### Section 1: Primary Language

1. Dropdown: Telugu / Kannada / Tamil / Malayalam / Hindi / English
2. On select → fetch `GET /api/voices?language=te` → render voice card grid

**Voice card:**
```
┌─────────────────────────────────────────┐
│  [TE] [F]  Sindhu                       │
│  Sindhu — Telugu Female                 │
│  ~1.4s avg  ●●●●● Excellent             │
│  [▶ Preview]              [Select →]   │
└─────────────────────────────────────────┘
```

Badge rules:
- `[TE]` / `[KN]` / `[TA]` / `[ML]` / `[HI]` / `[EN]` — teal/cyan pill
- `[F]` — rose/pink pill
- `[M]` — blue pill
- Latency: green <1.5s, yellow 1.5–2s, red >2s

Grid: 3 cards per row desktop, 1 per row mobile.

On "Select": saves `primary_preset_id = 'telugu_v1'` and `primary_voice_id = voice.voice_id` to wizard state.

### Section 2: Secondary Language (Optional)

Same flow, but:
- Dropdown excludes the primary language already selected
- "Skip" button available
- On select: loads voices for that language
- On "Select": saves `secondary_preset_id` and `secondary_voice_id`

### Section 3: English Fallback

- Hidden by default. Shows: "English fallback: auto-set to default English voice"
- Toggle "Customize" → expands to English voice card grid
- On "Select": saves `fallback_voice_id`
- If skipped: `fallback_voice_id` = default English female voice ID

---

## 7. Agent Edit Page — Voice Engines Section

Three cards replace the current four provider cards:

```
PRIMARY VOICE ENGINE
┌─────────────────────────────────────────────────────┐
│  [TE] [F]  Sindhu — Telugu Female                   │
│  ~1.4s avg · Excellent                              │
│  Sarvam STT · Gemini Flash · Cartesia TTS           │
│                                        [Change →]  │
└─────────────────────────────────────────────────────┘

SECONDARY VOICE ENGINE  (if set)
┌─────────────────────────────────────────────────────┐
│  [KN] [F]  Divya — Kannada Female                   │
│  ~1.6s avg · Excellent                              │
│  Used when patient speaks Kannada      [Change →]  │
└─────────────────────────────────────────────────────┘

ENGLISH FALLBACK
┌─────────────────────────────────────────────────────┐
│  [EN] [F]  Maya — English Indian Female             │
│  ~1.1s avg · Excellent                              │
│  Auto-used when patient speaks English [Change →]  │
└─────────────────────────────────────────────────────┘
```

"Change →" opens Voice Picker Modal filtered to that language.

---

## 8. Voice Picker Modal

Opens on "Change →". Language is fixed — user picks a different voice within the same language.

1. Header: "Choose Telugu Voice" (language fixed)
2. Voice card grid (all active voices for that language, M + F)
3. "Preview" → plays `preview_audio_url`
4. "Select" → saves new `voice_id` to agent, modal closes, card refreshes

User CANNOT change language from this modal. To change language, they edit the primary/secondary language setting above the card.

---

## 9. Runtime: Language Detection + Config Switching

```
Turn 1: No detected language → use primary preset + primary_voice_id
        Sarvam returns language_code 'kn-IN' → detectedLanguage = 'kn'

Turn 2: detectedLanguage = 'kn'
        secondary_preset matches 'kn'? Yes → switch to secondary preset + secondary_voice_id
        Session locks to secondary for remainder of call

Fallback: detectedLanguage = 'en' (any turn)
        → switch to english_in_v1 preset + fallback_voice_id
```

Language switch happens once on first confident detection. Session locks after that.
