# ARCHITECTURE AUDIT — Vocaldice

> Investigation only. No code changed.

---

## 1. Backend Framework + Language

| Layer | Stack |
|---|---|
| Web API | Next.js 16.2.0 API routes — TypeScript (`src/app/api/`) |
| Telephony server | Node.js (ESM) + Express + ws — JavaScript (`voice-server.mjs`, port 5050) |
| Web demo orchestrator | Node.js (ESM) + ws — JavaScript (`voice-orchestrator.mjs`, port 3004) |
| Database | Supabase (Postgres + Auth) |

There are **two independent voice pipelines** running in parallel. They share APIs but differ in architecture.

---

## 2. Entry Points

### Pipeline A — Web Call (browser demo, port 3004)
**File:** `voice-orchestrator.mjs`

Browser opens a WebSocket to `ws://localhost:3004`. On `init` message, the server creates a `Session`, connects to Cartesia via WebSocket, and starts the voice loop.

```
Browser → WS:init → voice-orchestrator.mjs
                  → Cartesia WS (streaming TTS)
Browser sends STT transcript text → voice-orchestrator processes with Gemini SDK
```

### Pipeline B — Web Call via Next.js API routes (production flow)
**Entry:** Browser JS calls three sequential API routes:

```
POST /api/webcall/transcribe  ← audio blob → Sarvam STT
POST /api/webcall/respond     ← transcript → Groq/Gemini LLM
POST /api/webcall/speak       ← LLM text → Cartesia TTS → WAV bytes
```

### Pipeline C — Phone Call via Vobiz (telephony, port 5050)
**Entry:** Vobiz dials in → `POST /answer` → XML response → bidirectional WebSocket `/stream`

```
Vobiz → POST /answer → XML with ws://host/stream
Vobiz → WS /stream → voice-server.mjs (μ-law 8kHz bidirectional)
```

> **Status: Pipeline C is Phase 1 only** (`CURRENT_PHASE = 1`). Real AI pipeline (Phase 2) is implemented but not enabled.

---

## 3. Pipeline Trace (Pipeline B — the active production web call)

### 3a. Audio Capture (Browser → Server)
```
Browser MediaRecorder → audio/webm blob
→ POST /api/webcall/transcribe
  FormData: { file: <blob>, language_code, stt_model, stt_noise_reducer }
```
File: `src/app/api/webcall/transcribe/route.ts`

### 3b. STT Call (Sarvam)
```ts
// src/app/api/webcall/transcribe/route.ts
const proxyData = new FormData()
proxyData.append('file', file, 'audio.webm')
proxyData.append('language_code', languageCode)   // e.g. 'te-IN'
proxyData.append('model', sttModel)               // 'saarika:v2.5'
proxyData.append('with_disfluences', ...)

await fetch('https://api.sarvam.ai/speech-to-text', {
  method: 'POST',
  headers: { 'api-subscription-key': SARVAM_API_KEY },
  body: proxyData
})
// Returns: { transcript, language_code }
```

### 3c. LLM Call (Groq — current default)
```ts
// src/app/api/webcall/respond/route.ts
// provider = 'groq' (LLM_PROVIDER env var), model = 'llama-3.1-8b-instant'

await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'system', content: systemPrompt + VOICE_RULE }, ...conversationHistory],
    temperature: 0.2,
    max_tokens: 500,
    stream: true   // only on Groq streaming path
  })
})
```

**System prompt structure:**
1. Clinic-specific prompt from `agents.system_prompt` (generated at agent creation from `src/lib/promptTemplates.ts`)
2. Appended `VOICE_RULE` block (hardcoded 6 rules — keep short, same language, no lists, etc.)

### 3d. TTS Call (Cartesia)
```ts
// src/app/api/webcall/speak/route.ts
await fetch('https://api.cartesia.ai/tts/bytes', {
  method: 'POST',
  headers: { 'X-API-Key': CARTESIA_API_KEY, 'Cartesia-Version': '2024-06-10' },
  body: JSON.stringify({
    model_id: 'sonic-3',
    transcript: text,
    voice: { mode: 'id', id: voice_id },   // per-agent Cartesia voice ID
    output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 22050 },
    language: cartesiaLangCode,            // mapped from agent language
  })
})
// Returns: WAV bytes → streamed back to browser
```

**Fallback chain:**
1. Cartesia sonic-3 (primary)
2. Cartesia sonic-3 with `language: 'en'` (if voice doesn't support the language)
3. Sarvam bulbul:v2 (emergency, Indian languages only)

### 3e. Audio Playback (Server → Browser)
Cartesia WAV bytes are streamed directly from the Next.js route response (`res.body` pass-through). Browser decodes and plays via Web Audio API.

---

## 4. Sequential vs. Parallel

**All sequential.** No parallelism anywhere in any pipeline.

```
User speaks → [silence] → STT (full round-trip) → LLM (full round-trip) → TTS (full round-trip) → playback
```

Total latency = STT latency + LLM latency + TTS latency + network overhead × 3.

---

## 5. Streaming Flags

| Path | Streaming? | Detail |
|---|---|---|
| `/api/webcall/respond` Groq | YES | `stream: true` — SSE pass-through to browser |
| `/api/webcall/respond` Gemini | NO | Full response, no streaming |
| `/api/webcall/speak` Cartesia | Partial | `res.body` piped through (bytes stream), but full TTS generation before first byte |
| `voice-server.mjs` Groq/Gemini | NO | `max_tokens: 300`, awaits full response |
| `voice-orchestrator.mjs` Gemini | NO | `chat.sendMessage()` awaits full response |
| `voice-orchestrator.mjs` Cartesia | YES | WebSocket streaming — sends chunks as they arrive |

---

## 6. Sarvam Streaming Mode

**Not used.** All Sarvam STT calls use the standard `POST /speech-to-text` endpoint — full audio uploaded, full transcript returned. No streaming/real-time transcription.

---

## 7. Cartesia Streaming Mode

- **voice-server.mjs (telephony):** Non-streaming. `POST /tts/bytes` → full buffer → chunked playback (160 bytes per Vobiz frame).
- **voice-orchestrator.mjs (web demo):** WebSocket streaming — `wss://api.cartesia.ai/tts/websocket`. Audio chunks sent as they arrive. First audio byte latency is lower.
- **`/api/webcall/speak` (web production):** `POST /tts/bytes` — full buffer returned, then streamed to browser.

---

## 8. Agent Config — Where Loaded From

**Web calls (Pipeline B):** Agent config is passed by the browser as JSON in each API request body (`llm_provider`, `llm_model`, `system_prompt`, `voice_id`, `language`, etc.). The browser reads from Supabase on page load.

**Telephony (Pipeline C):** `resolveAgent()` in `voice-server.mjs` queries Supabase at call start:
```
vobiz_numbers → agent_id → agents table → full agent row cached in CallSession
```
Fallback: first agent in DB if no phone number mapping found.

---

## 9. Database Schema — Agent Config

### `agents` table (from `supabase_migration.sql` + `agents_columns_migration.sql`)

```sql
id                  uuid PK
user_id             uuid → auth.users

-- Identity
name                text
agent_name          text DEFAULT 'Priya'
clinic_name         text
clinic_address      text
clinic_phone        text

-- Doctors & Schedule  
doctor_names        text
specialties         text[]
working_hours       text

-- Voice & Language (KEY MIGRATION TARGETS)
languages           text[]   DEFAULT '{en}'         -- e.g. ['te', 'en']
primary_language    text     DEFAULT 'en'
voice_id            text                            -- Cartesia voice UUID
voice_name          text                            -- human label e.g. "Sindhu"

-- STT config (per-agent)
stt_model           text     DEFAULT 'saarika:v2'
stt_language        text     DEFAULT 'unknown'
stt_silence_timeout integer  DEFAULT 800
stt_noise_reducer   boolean  DEFAULT false
sarvam_speaker      text     DEFAULT 'meera'        -- Sarvam TTS fallback speaker

-- LLM config (per-agent)
llm_provider        text     DEFAULT 'groq'
llm_model           text     DEFAULT 'llama-3.1-8b-instant'
llm_temperature     numeric  DEFAULT 0.2

-- Behavior
use_cases           text[]
faqs                jsonb
system_prompt       text
first_message       text
first_message_mode  text     DEFAULT 'Assistant speaks first'
greeting            text

-- Other
voice_speed         numeric  DEFAULT 1.0
slot_duration_minutes integer DEFAULT 30
status              text     DEFAULT 'ready'
phone_number        text
post_call_config    jsonb    (referenced in voice-server.mjs, not in migration file — likely added manually)
```

### Other tables

**`call_logs`** — stores every call with transcript, analysis, duration, status.

**`vobiz_numbers`** — maps phone number → agent_id + user_id for incoming telephony calls.

**`appointments`** — auto-created from post-call analysis when appointment detected in transcript.

---

## 10. Caching Layers

**None.** Zero caching anywhere:
- No Redis / in-memory cache for agent configs
- No response caching for common queries
- Cartesia audio not cached (same text synthesized fresh every call)
- Supabase queries run on every request / call start
- No CDN caching for API responses

---

## Key Findings for Preset Migration

1. **`voice_id`, `llm_provider`, `llm_model`, `stt_model`, `stt_language`, `sarvam_speaker`** are the per-agent fields that will be replaced by a `preset_id` foreign key.

2. **`languages` and `primary_language`** will be derived from the preset (presets are language-specific).

3. **Two separate voice code paths** exist (voice-server.mjs vs API routes) — both need to be updated to resolve preset instead of individual provider fields.

4. **`voice-server.mjs` Phase 1** is hardcoded (no DB). Phase 2 is the first real migration target for preset lookup.

5. **Post-call analysis** still uses Groq hardcoded — needs to be updated to use `llm_provider` from preset.
