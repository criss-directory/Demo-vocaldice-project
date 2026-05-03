# MIGRATION RISKS — Vocaldice Preset Architecture

> Risk identification only. No mitigations implemented yet.

---

## Risk 1: Schema Change Breaks Existing API Request Bodies

**What breaks:** Pipeline B (Next.js API routes) currently receives `voice_id`, `llm_provider`, `llm_model`, `language` directly in the request body from the browser. The browser reads these from the `agents` row in Supabase and passes them forward on each API call.

**New structure:** Browser will pass `session_id` (server-side session), and the session holds `preset_id` + `voice_id` separately. Old fields (`voice_id` in body, `llm_provider` in body) will be gone.

**Impact:** If agent rows no longer have old columns (after Phase 4 column drop), the browser will send `undefined` for those fields, and the API routes will fall through to hardcoded defaults.

**Trigger:** Phase 4 (dropping deprecated columns). Safe during Phases 1–3 because old columns still exist.

**Rollback:** Keep deprecated columns until all browser-facing code confirmed to pass `preset_id` + `voice_id` via server-side session.

---

## Risk 2: Existing 4 Test Agents (Neha, Aanya, Priya, nainika) Have No Preset ID

**What breaks:** After adding `primary_preset_id` column, these agents have it as `NULL`. Any code that does `agent.primary_preset_id` and calls `loadPreset()` will crash.

**Impact:** All calls via these agents will fail if the dual-read fallback is not in place.

**Confirmed agent config (queried from Supabase):**

| Agent | primary_language | voice_name | voice_id | Map to Preset |
|---|---|---|---|---|
| Priya | te | Sindhu — Conversational Partner | `07bc462a-...` | `telugu_v1_f` |
| Aanya | kn | Divya — Joyful Narrator | `7c6219d2-...` | `kannada_v1_f` |
| Neha | hi | Neha — Virtual Assistant | `47f3bbb1-...` | `hindi_v1_f` |
| Monisha | te | Sindhu — Conversational Partner | `07bc462a-...` | `telugu_v1_f` |
| Arun | ta | Arun — Lively Voice | `d2870b91-...` | `tamil_v1_m` |

All 5 agents are confirmed. Backfill SQL can be written as soon as presets table is seeded.

**Rollback:** Dual-read means old columns still serve if `primary_preset_id IS NULL`. Safe to revert backfill by setting `primary_preset_id = NULL`.

---

## Risk 3: Preset Seeding Before Agent Backfill

**What breaks:** If the backfill runs before the `presets` table is seeded, the FK constraint (`REFERENCES presets(preset_id)`) will reject the insert.

**Mitigation order:** presets table seeded → agents backfilled. Must be strictly sequential.

---

## Risk 4: `voice-server.mjs` Phase 2 Enablement

**Current state:** `CURRENT_PHASE = 1` — all AI code is bypassed. Real clinics cannot go live. Changing `CURRENT_PHASE = 2` activates the full STT → LLM → TTS pipeline.

**Risks when Phase 2 enabled:**

| Risk | Detail |
|---|---|
| Sarvam STT errors | Currently `language_code: 'unknown'` in voice-server.mjs. Valid values are `'te-IN'` etc. Unknown may still work (Sarvam auto-detect) but not guaranteed. |
| Groq rate limits | Phase 1 makes zero LLM calls. Phase 2 will fire Groq on every patient utterance. Free-tier Groq limits can be hit fast during testing. |
| TTS voice mismatch | voice-server.mjs TTS.synthesize has **hardcoded** voice ID `a0e99841-438c-4a64-b679-ae501e7d6091`. This ignores `agent.voice_id`. Must be fixed before Phase 2 is trusted. |
| No per-call timeout | If Sarvam/Groq/Cartesia hang, the call hangs forever. No timeout in the pipeline today. |
| Post-call analysis runs Groq hardcoded | `PostCallProcessor._analyze()` always calls Groq regardless of agent's preset. This will keep working but won't respect preset LLM after migration. |

**Rollback:** Set `CURRENT_PHASE = 1` in voice-server.mjs. Zero impact on web calls.

---

## Risk 5: Pipeline A Deletion (`voice-orchestrator.mjs`)

**Dependencies to verify before deleting:**
- Dashboard demo page (`src/app/dashboard/demo/`) — check if it connects to port 3004
- Any env var `NEXT_PUBLIC_VOICE_PORT=3004` references in frontend code
- `package.json dev:voice` script runs `voice-orchestrator.mjs` — used in `dev:all`

**Check:** Read `src/app/dashboard/demo/page.tsx` to confirm it connects to port 3004 before deleting. If it does, Pipeline B must fully replace it first.

**Rollback:** File still exists in git history. Restore from git.

---

## Risk 6: VoiceAgent Core Refactor Breaks Pipeline B (Working Production)

**Pipeline B currently works.** The three API routes (`/transcribe`, `/respond`, `/speak`) are independently functional. Introducing the Core as a shared abstraction adds an indirection layer.

**Specific risks:**

| Risk | Detail |
|---|---|
| TypeScript module import in `.mjs` | `voice-server.mjs` is plain ESM JavaScript. Importing a TypeScript Core module requires either compiling it first or keeping the Core as `.mjs` too. |
| Session reconstruction in Pipeline B | Pipeline B is stateless per HTTP request. The Core's `VoiceSession` holds conversation history — Pipeline B currently passes the full history in the request body each time. This pattern must be preserved, not converted to server-side session storage. |
| Dual-read logic adds branching | Every Core call must handle the "preset present" vs "preset null, fall back to old columns" case. Each branch must be tested. |
| Gemini 2.5 Flash not yet in LLM module | Current code uses `gemini-2.0-flash`. Adding Gemini 2.5 Flash requires updating model IDs and verifying the API endpoint format is unchanged. |

**Rollback:** Core is an additive module — old API route code stays unchanged until Core is proven. Core can be introduced alongside existing code, not replacing it in one shot.

---

## Risk 7: Gemini TTS (Hindi + English Presets)

`hindi_v1_f` and `english_in_v1_f` use Gemini TTS as primary. Gemini TTS (`gemini-3.1-flash-tts`) is currently in **preview** — breaking changes possible. No Gemini TTS code exists anywhere in the codebase today.

**Impact:** If Gemini TTS is unreachable or API format changes, Hindi and English voice agents are dead. Fallback to Cartesia must work or callers hear silence.

**Risk:** Two new unknowns in one preset (new LLM model AND new TTS provider). Should be the last preset to go live, not the first.

---

## Risk 8: Post-Call Analysis LLM Migration

`PostCallProcessor._analyze()` in `voice-server.mjs` hardcodes Groq `llama-3.1-8b-instant` regardless of agent's LLM config. After preset migration, this should use the preset's LLM, but:

- Analysis runs **after call ends** (async), not during the call
- If Gemini 2.5 Flash is used for analysis, response format must still return valid JSON (currently forced via Groq's `response_format: { type: 'json_object' }` — Gemini does not have this flag)
- Analysis prompt already requests JSON only, but without the format enforcement, parsing may fail

**Rollback:** Analysis is fire-and-forget after call end. Failures are logged but don't affect the caller experience. Safe to migrate last.

---

## Risk 9: Cartesia Voice IDs in Preset Seed Data

The `presets` table has a `tts_voice_id` column. If the founder enters an incorrect Cartesia voice UUID (e.g. typo, or a voice that doesn't support that language), every call using that preset will fail at TTS.

**Impact:** All calls for that language go to fallback or fail entirely.

**Mitigation:** Test each voice ID via `/api/presets/:preset_id/preview` before marking the preset `is_active = true`. Seed with `is_active = false`, flip to true after preview test passes.

---

## Risk 10: `english_fallback_preset_id` Default

The new column has `DEFAULT 'english_in_v1_f'`. If this preset doesn't exist in the `presets` table when the `agents` migration runs, the FK constraint will fail for any new agent insert.

**Mitigation:** Preset seeding must complete before the `agents` column migration runs. Strict order.

---

## Rollback Summary Per Phase

| Phase | What was done | Rollback action |
|---|---|---|
| 1: Add columns | `primary_preset_id`, `secondary_preset_id`, `english_fallback_preset_id` added to agents | `ALTER TABLE agents DROP COLUMN ...` — safe, data still in old columns |
| 2: Backfill agents | Set preset IDs for 4 existing agents | `UPDATE agents SET primary_preset_id = NULL WHERE ...` |
| 3: Dual-read code | Core reads preset if set, falls back to old columns | Revert Core to previous code — old columns still populated |
| 4: Drop columns | Old provider columns removed | Restore from last backup / schema migration rollback script |
| Pipeline A deletion | `voice-orchestrator.mjs` deleted | `git checkout voice-orchestrator.mjs` |
| Phase 2 enable | `CURRENT_PHASE = 2` in voice-server.mjs | Set `CURRENT_PHASE = 1` — instant rollback |
