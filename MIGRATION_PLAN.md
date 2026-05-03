# MIGRATION PLAN — Vocaldice Preset Architecture

> Implementation roadmap only. Nothing built yet.

---

## Pre-Flight Checklist (Before Any Stage)

Run these before Day 2 starts. Manual steps, 30 min total.

- [ ] Query Supabase: confirm `primary_language` values for Neha, Aanya, Priya, nainika
- [ ] Query Supabase: confirm `voice_id` values for all 4 agents (needed for preset mapping)
- [ ] Verify `src/app/dashboard/demo/page.tsx` — confirm it connects to port 3004 (Pipeline A)
- [ ] Decide on Cartesia voice UUIDs for each preset (founder voice testing)
- [ ] Note: Gemini 2.5 Flash API endpoint and model ID must be verified against actual Gemini docs before use

---

## Stage 1 — Foundation (Day 2)

**Goal:** Presets table exists and is seeded. Agents table has new columns. Nothing in the product changes yet.

### Step 1.1 — Create and seed `presets` table
**Effort:** 2h  
**Files:** New SQL file `presets_migration.sql`  
**Parallel with:** Nothing — this is the dependency for all other steps  

```sql
-- Create presets table (6 rows, one per language — STT + LLM + TTS provider only)
-- No voices table — voices are pulled live from Cartesia GET /voices?language=te
-- Voice IDs are stored directly on the agents row (plain TEXT, no FK)
```

**Test before moving on:**
- `SELECT * FROM presets` returns 6 rows
- `SELECT preset_id, language_name, stt_model, llm_model FROM presets` looks correct

---

### Step 1.2 — Add preset + voice columns to `agents` table
**Effort:** 1h  
**Files:** New SQL file `agents_preset_migration.sql`  
**Parallel with:** Run after Step 1.1 (preset FK references presets table; voice columns are plain TEXT)

```sql
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS primary_preset_id   TEXT REFERENCES presets(preset_id),
  ADD COLUMN IF NOT EXISTS primary_voice_id    TEXT,   -- Cartesia voice UUID (live from API)
  ADD COLUMN IF NOT EXISTS secondary_preset_id TEXT REFERENCES presets(preset_id),
  ADD COLUMN IF NOT EXISTS secondary_voice_id  TEXT,   -- nullable
  ADD COLUMN IF NOT EXISTS fallback_voice_id   TEXT;   -- English fallback voice UUID
```

**Test before moving on:**
- `SELECT primary_preset_id, primary_voice_id FROM agents` returns all NULLs (expected)
- `INSERT INTO agents (..., primary_preset_id, primary_voice_id) VALUES (..., 'telugu_v1', '07bc462a-...')` succeeds

---

### Step 1.3 — Build VoiceAgent Core skeleton (types and interfaces only)
**Effort:** 3h  
**Files:** `src/lib/voice-core/types.ts`, `src/lib/voice-core/index.ts` (stubs)  
**Parallel with:** Steps 1.1 and 1.2  

Implement: TypeScript types (`PresetConfig`, `VoiceSession`, `TurnResult`), function signatures with `throw new Error('not implemented')` bodies. No real logic yet. Goal is to establish the contract before wiring.

**Test before moving on:**
- TypeScript compiles with no errors (`npx tsc --noEmit`)

---

### Step 1.4 — Set up TypeScript build pipeline for voice-server
**Effort:** 2h  
**Files:** `tsconfig.voice-core.json` (new), `package.json`  
**Parallel with:** Step 1.3  

`voice-server.mjs` is plain ESM and cannot import TypeScript directly. Resolve this in Stage 1 — not Stage 3 — so the integration path is clear before any real logic is written.

- Add a dedicated `tsconfig.voice-core.json` that compiles `src/lib/voice-core/` to `dist/voice-core/`
- Add `build:core` script to `package.json`: `tsc --project tsconfig.voice-core.json`
- Add `dev:core` script using `tsc --watch` for development
- Update `voice-server.mjs` import paths to point to `dist/voice-core/index.js`
- Add `dist/` to `.gitignore`

**Test before moving on:**
- `npm run build:core` produces `dist/voice-core/` with `.js` and `.d.ts` files
- `voice-server.mjs` can `import { createSession } from './dist/voice-core/index.js'` without error

---

## Stage 2 — Pipeline B Migration (Day 3–4)

**Goal:** The "Test Call" flow in the dashboard uses VoiceAgent Core. Dual-read active. 4 existing agents backfilled and verified.

### Step 2.1 — Implement `preset-loader.ts` and `session.ts`
**Effort:** 3h  
**Files:** `src/lib/voice-core/preset-loader.ts`, `src/lib/voice-core/session.ts`  
**Parallel with:** Nothing — needed by all Pipeline B steps  

Implement: `loadPreset()` with 5-min cache, `getPresetForCall()` with language-matching logic, `createSession()`, dual-read fallback (`if agent.primary_preset_id is null, read from old columns`).

**Test before moving on:**
- Unit test: `loadPreset('telugu_v1_f')` returns correct object
- Unit test: `getPresetForCall(agentId, 'kn')` returns secondary preset when secondary is `kannada_v1_f`
- Unit test: `getPresetForCall(agentId, null)` returns primary preset

---

### Step 2.2 — Implement Core STT, LLM, TTS modules
**Effort:** 4h  
**Files:** `src/lib/voice-core/stt.ts`, `src/lib/voice-core/llm.ts`, `src/lib/voice-core/tts.ts`  
**Parallel with:** Step 2.1 (types already defined)  

Implement real logic:
- `stt.ts`: wrap Sarvam call, use `preset.stt_model` and `preset.stt_language_code`
- `llm.ts`: Gemini 2.5 Flash primary, Groq fallback (keep existing Groq code, add Gemini 2.5)
- `tts.ts`: Cartesia sonic-3 primary, Sarvam fallback (Gemini TTS stub only — not live in V1.0 for regional languages)

**Test before moving on:**
- Integration test: `stt.transcribe(testAudioBuffer, teluguPreset)` returns a transcript
- Integration test: `llm.getResponse(session, 'Book appointment', teluguPreset)` returns a string
- Integration test: `tts.synthesize('నమస్కారం', teluguPreset)` returns non-empty Buffer

---

### Step 2.3 — Wire `/api/webcall/transcribe` to Core
**Effort:** 2h  
**Files:** `src/app/api/webcall/transcribe/route.ts`  
**Parallel with:** Nothing until 2.2 complete  

Replace direct Sarvam fetch with `core.transcribe()`. Keep the same request/response shape — browser code doesn't change.

**Test before moving on:**
- Test Call in dashboard: STT works, transcript appears

---

### Step 2.4 — Wire `/api/webcall/respond` and `/api/webcall/speak` to Core
**Effort:** 2h  
**Files:** `src/app/api/webcall/respond/route.ts`, `src/app/api/webcall/speak/route.ts`  
**Parallel with:** Can run in parallel with 2.3  

**Test before moving on:**
- End-to-end Test Call: user speaks → transcript → response text → audio plays
- Verify latency is not regressed vs. current

---

### Step 2.5 — Backfill 5 existing agents to preset + voice IDs
**Effort:** 1h  
**Files:** New SQL file `agents_backfill.sql`  

```sql
-- Confirmed from Supabase query:
UPDATE agents SET primary_preset_id = 'telugu_v1',   primary_voice_id = '07bc462a-c644-49f1-baf7-82d5599131be' WHERE agent_name = 'Priya';
UPDATE agents SET primary_preset_id = 'telugu_v1',   primary_voice_id = '07bc462a-c644-49f1-baf7-82d5599131be' WHERE agent_name = 'Monisha';
UPDATE agents SET primary_preset_id = 'kannada_v1',  primary_voice_id = '7c6219d2-e8d2-462c-89d8-7ecba7c75d65' WHERE agent_name = 'Aanya';
UPDATE agents SET primary_preset_id = 'hindi_v1',    primary_voice_id = '47f3bbb1-e98f-4e0c-92c5-5f0325e1e206' WHERE agent_name = 'Neha';
UPDATE agents SET primary_preset_id = 'tamil_v1',    primary_voice_id = 'd2870b91-1b4c-47ab-81a8-3718d8e9c222' WHERE agent_name = 'Arun';
```

**Test before moving on:**
- Test Call with each of the 5 agents — all return audio correctly
- `SELECT agent_name, primary_preset_id, primary_voice_id FROM agents` — all 5 non-null

---

### Step 2.6 — Activate presets (`is_active = true`)
**Effort:** 30 min  
**Files:** Supabase SQL Editor  

Set `is_active = true` only for the presets that have been tested with real Cartesia voice IDs. Start with `telugu_v1_f` only. Add others as founder validates voices.

---

## Stage 3 — Latency Optimization (Day 5–7)

**Goal:** Hit sub-2s latency on Pipeline B before any real clinic goes live on telephony. Real patients must never experience pre-optimized latency.

> **Rule: Measure first.** Log `stt_ms`, `llm_ms`, `tts_ms` for 10 web calls after Stage 2 completes. Keep this as the baseline for comparison.

### Step 3.1 — End-to-end LLM streaming for Pipeline B
**Effort:** 3h  
**Files:** `src/lib/voice-core/llm.ts`, `src/app/api/webcall/respond/route.ts`  

Gemini streaming with SSE. First token reaches browser before full response is complete. Dashboard call UI starts rendering text immediately.

**Parallel with:** Step 3.2

---

### Step 3.2 — Switch Pipeline B TTS to Cartesia WebSocket streaming
**Effort:** 4h  
**Files:** `src/lib/voice-core/tts.ts`, `src/app/api/webcall/speak/route.ts`  

Send audio to browser as first Cartesia chunk arrives. Remove full-buffer-then-stream behavior.

---

### Step 3.3 — LLM-to-TTS sentence pipelining
**Effort:** 6h  
**Files:** `src/lib/voice-core/pipeline.ts`  

When LLM streams, detect sentence boundaries (`. `, `? `, `! `). Send each complete sentence to TTS immediately. First audio chunk arrives ~300ms earlier.

**Sequential after:** 3.1 and 3.2 complete

---

### Step 3.4 — Measure and confirm gate
**Effort:** 2h  

Run 10 calls after Step 3.3. Compare `stt_ms + llm_ms + tts_ms` to Stage 2 baseline. Document in `LATENCY_REPORT.md`.

**Gate: average total turn must be under 2500ms before proceeding to Stage 4.**

---

## Stage 4 — Pipeline C Activation (Day 8–10)

**Goal:** Vobiz phone calls work end-to-end with real AI. Latency already proven in Stage 3 before real patients are involved.

### Step 4.1 — Fix hardcoded voice ID in `voice-server.mjs`
**Effort:** 1h  
**Files:** `voice-server.mjs` — `TTS.synthesize()`  

Replace hardcoded `id: 'a0e99841-438c-4a64-b679-ae501e7d6091'` with `session.preset.tts_voice_id`.

**Test before moving on:**
- Verify hardcoded ID is gone from code

---

### Step 4.2 — Wire `voice-server.mjs` to VoiceAgent Core
**Effort:** 4h  
**Files:** `voice-server.mjs` — `resolveAgent()`, `runAIPipeline()`, `sendTTSResponse()`  

TS-to-mjs is already solved in Step 1.4. Import from `dist/voice-core/index.js`.

`resolveAgent()`: call `core.getPresetForCall(agentId, null)`, store `session.preset`.  
`runAIPipeline()`: replace individual STT/LLM/TTS calls with `core.runTurn(session.voiceSession, wavBuffer)`.

**Test before moving on:**
- Local test with ngrok + Vobiz: incoming call → greeting → user speaks → AI responds → audio plays

---

### Step 4.3 — Enable Phase 2
**Effort:** 15 min  
**Files:** `voice-server.mjs` — line 34  

```js
const CURRENT_PHASE = 2  // was 1
```

**Test before moving on:**
- Live phone call → full AI pipeline runs → call log saved in Supabase

---

### Step 4.4 — Migrate post-call analysis to preset LLM
**Effort:** 2h  
**Files:** `voice-server.mjs` — `PostCallProcessor._analyze()`  

Replace hardcoded Groq with `preset.llm_provider / preset.llm_model`. For Gemini: remove `response_format: { type: 'json_object' }` (not supported by Gemini) — rely on prompt-only JSON enforcement.

**Test before moving on:**
- Call log `analysis` field populated after call. Appointment created if booking mentioned.

---

## Stage 5 — UI + Cleanup (Day 10–12)

**Goal:** Voice picker built, agent edit page updated, Pipeline A deleted, old columns dropped.

### Step 5.1 — Build `GET /api/presets` endpoint
**Effort:** 1h  
**Files:** `src/app/api/presets/route.ts` (new file)

---

### Step 5.2 — Build `GET /api/presets/:preset_id/preview` endpoint
**Effort:** 1h  
**Files:** `src/app/api/presets/[preset_id]/preview/route.ts` (new file)  
**Parallel with:** Step 5.1

---

### Step 5.3 — Build voice picker UI components
**Effort:** 6h  
**Files:** New components in `src/components/VoicePicker/`  

- `VoiceCard.tsx` — TE/F badge, voice name, latency, quality, preview button, select button
- `VoicePickerGrid.tsx` — grid of VoiceCards, filtered by language
- `VoicePickerModal.tsx` — wraps grid in modal, handles "Select" → update agent

**Parallel with:** Steps 5.1 and 5.2

---

### Step 5.4 — Update agent edit page
**Effort:** 4h  
**Files:** `src/app/dashboard/agents/[id]/AgentDetailTabs.tsx`  

Replace the four provider cards with three voice engine cards (primary / secondary / fallback). Each "Change" button opens `VoicePickerModal`.

**Sequential after:** Step 5.3

---

### Step 5.5 — Update agent setup wizard
**Effort:** 4h  
**Files:** `src/components/OnboardingWizard.tsx` (or wherever wizard lives)  

Replace language/voice step with three-section voice engine picker.

**Sequential after:** Step 5.3

---

### Step 5.6 — Verify Pipeline A dependencies and delete it
**Effort:** 1h  
**Files:** `voice-orchestrator.mjs`, `src/app/dashboard/demo/page.tsx`, `package.json`  

Pre-condition: confirm demo page has been updated to use Pipeline B.  
Delete `voice-orchestrator.mjs`.  
Remove `dev:voice` and `dev:all` scripts from `package.json` or update `dev:all` to omit voice-orchestrator.

---

### Step 5.7 — Drop deprecated columns from `agents`
**Effort:** 30 min  
**Files:** New SQL file `agents_cleanup_migration.sql`  

Pre-condition: all agents have `primary_preset_id` set. No production code reads `voice_id`, `llm_provider`, `llm_model`, `stt_model`, `stt_language`, `sarvam_speaker`, `languages`, `primary_language` from the agents table.

```sql
ALTER TABLE agents
  DROP COLUMN voice_id,
  DROP COLUMN voice_name,
  DROP COLUMN llm_provider,
  DROP COLUMN llm_model,
  DROP COLUMN llm_temperature,
  DROP COLUMN stt_model,
  DROP COLUMN stt_language,
  DROP COLUMN sarvam_speaker,
  DROP COLUMN languages,
  DROP COLUMN primary_language;
```

**Test before executing:**
- Search entire codebase for `agent.voice_id`, `agent.llm_provider`, etc. — must return 0 results
- Search for `req.body.voice_id`, `req.body.llm_provider` etc. — must return 0 results

---

## Parallelism Summary

```
Stage 1:  1.1 → 1.2 (seq, FK dep) | 1.3 || 1.4 (parallel with 1.1+1.2)
Stage 2:  2.1 → 2.2 (seq) → 2.3 || 2.4 (parallel) → 2.5 → 2.6
Stage 3:  3.1 || 3.2 (parallel) → 3.3 → 3.4 (gate — must pass before Stage 4)
Stage 4:  4.1 → 4.2 → 4.3 → 4.4 (fully sequential — telephony can't be parallel tested)
Stage 5:  5.1 || 5.2 || 5.3 (parallel) → 5.4 || 5.5 (parallel) → 5.6 → 5.7
```

---

## Effort Estimate Summary

| Stage | Steps | Est. Hours | Realistic Days |
|---|---|---|---|
| Stage 1: Foundation | 4 steps | 8h | Days 1–2 |
| Stage 2: Pipeline B | 6 steps | 12h | Days 3–5 |
| Stage 3: Latency Optimization | 4 steps | 15h | Days 6–8 |
| Stage 4: Pipeline C Activation | 4 steps | 7h | Days 9–11 |
| Stage 5: UI + Cleanup | 7 steps | 17h | Days 12–16 |
| **Total** | **25 steps** | **~59h** | **~16 days** |

> 16 days is realistic for a solo founder using AI assist with debugging cycles and surprises. This is well within the 30-day V1.0 target. Don't treat Day 12 as a deadline.

---

## Test Criteria — Gate for Each Stage

| Stage | Gate |
|---|---|
| Stage 1 | `SELECT * FROM presets` returns 6 rows. `agents` has 3 new columns. `npm run build:core` succeeds. |
| Stage 2 | Test Call works for all 4 agents. All return audio. Latency ≤ current baseline. |
| Stage 3 | Average total turn latency < 2500ms over 10 test calls. No Pipeline B regressions. |
| Stage 4 | Real phone call works end-to-end. Call log saved in Supabase. Appointment created if booked. |
| Stage 5 | Voice picker opens, preview plays, voice change saves. Old columns absent from schema. Pipeline A deleted. |
