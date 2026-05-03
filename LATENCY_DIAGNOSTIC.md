# Latency Diagnostic Report

**Date:** 2026-05-02  
**Status:** COMPLETE — 10 turns measured across 3 sessions (Telugu, Hindi, Kannada)  
**Active pipeline:** `pipeline-stream.ts` (SSE streaming, sentence-level TTS)

---

## Per-Turn Breakdown (measured values)

### Session 1 — Agent: Monisha (Telugu, `gemini-2.5-flash`)

#### Turn 1 — 4 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 4 |
| STT (Sarvam `saarika:v2.5`) | 1,242 |
| LLM to first sentence | 1,170 |
| TTS sentence 1 (26 chars) | 805 |
| **→ First audio to browser** | **3,221** |
| TTS sentence 2 (58 chars) | 1,174 |
| TTS sentence 3 (47 chars) | 855 |
| TTS sentence 4 (44 chars) | 923 |
| Total TTS (sequential) | 3,757 |
| **TOTAL TURN** | **6,183** |

#### Turn 2 — 3 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 3 |
| STT | 906 |
| LLM to first sentence | 1,466 |
| TTS sentence 1 (101 chars ⚠️) | 1,891 |
| **→ First audio to browser** | **4,265** |
| TTS sentence 2 (54 chars) | 1,100 |
| TTS sentence 3 (26 chars) | 674 |
| Total TTS | 3,665 |
| **TOTAL TURN** | **6,048** |

#### Turn 3 — 2 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 3 |
| STT | 1,047 |
| LLM to first sentence | 1,446 |
| TTS sentence 1 (24 chars) | 705 |
| **→ First audio to browser** | **3,204** |
| TTS sentence 2 (39 chars) | 1,014 |
| Total TTS | 1,719 |
| **TOTAL TURN** | **4,226** |

---

### Session 2 — Agent: Neha (Hindi, `gemini-2.5-flash`)

#### Turn 1 — 3 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 5 |
| STT | 1,324 |
| LLM to first sentence | 863 |
| TTS sentence 1 (18 chars) | 857 |
| **→ First audio to browser** | **3,048** |
| TTS sentence 2 (34 chars) | 1,015 |
| TTS sentence 3 (46 chars) | 1,182 |
| Total TTS | 3,054 |
| **TOTAL TURN** | **5,251** |

#### Turn 2 — 2 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 3 |
| STT | 1,115 |
| LLM to first sentence | 1,274 |
| TTS sentence 1 (72 chars ⚠️) | 1,404 |
| **→ First audio to browser** | **3,795** |
| TTS sentence 2 (38 chars) | 883 |
| Total TTS | 2,287 |
| **TOTAL TURN** | **4,683** |

#### Turn 3 — 3 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 5 |
| STT | 1,220 |
| LLM to first sentence | 921 |
| TTS sentence 1 (18 chars) | 850 |
| **→ First audio to browser** | **2,994** |
| TTS sentence 2 (74 chars ⚠️) | 1,788 |
| TTS sentence 3 (36 chars) | 794 |
| Total TTS | 3,432 |
| **TOTAL TURN** | **5,582** |

#### Turn 4 — 4 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 3 |
| STT | 1,070 |
| LLM to first sentence | 1,100 |
| TTS sentence 1 (8 chars — "धन्यवाद!") | 589 |
| **→ First audio to browser** | **2,763** |
| TTS sentence 2 (79 chars) | 1,752 |
| TTS sentence 3 (30 chars) ⚠️ anomaly | 1,984 |
| TTS sentence 4 (81 chars) | 1,284 |
| Total TTS | 5,609 |
| **TOTAL TURN** | **7,794** |

#### Turn 5 — 3 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 5 |
| STT | 1,238 |
| LLM to first sentence | 1,493 |
| TTS sentence 1 (41 chars) | 1,049 |
| **→ First audio to browser** | **3,783** |
| TTS sentence 2 (33 chars) ⚠️ anomaly | 2,076 |
| TTS sentence 3 (27 chars) | 709 |
| Total TTS | 3,834 |
| **TOTAL TURN** | **6,576** |

#### Turn 6 — 1 sentence
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 2 |
| STT | 938 |
| LLM to first sentence | 1,310 |
| TTS sentence 1 (66 chars) | 1,181 |
| **→ First audio to browser** | **3,431** |
| Total TTS | 1,181 |
| **TOTAL TURN** | **3,435** |

---

### Session 3 — Agent: Aanya (Kannada, `gemini-2.5-flash`)

#### Turn 1 — 3 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 6 |
| STT | 1,342 |
| LLM to first sentence | 1,434 |
| TTS sentence 1 (19 chars) | 807 |
| **→ First audio to browser** | **3,584** |
| TTS sentence 2 (46 chars) | 1,057 |
| TTS sentence 3 (35 chars) | 763 |
| Total TTS | 2,627 |
| **TOTAL TURN** | **5,416** |

#### Turn 2 — 2 sentences
| Phase | Duration (ms) |
|-------|---------------|
| API overhead | 4 |
| STT | 978 |
| LLM to first sentence | 1,481 |
| TTS sentence 1 (88 chars ⚠️) | 1,352 |
| **→ First audio to browser** | **3,813** |
| TTS sentence 2 (29 chars) | 753 |
| Total TTS | 2,105 |
| **TOTAL TURN** | **4,572** |

#### Turn 3 — partial (log truncated)
| Phase | Duration (ms) |
|-------|---------------|
| STT | 1,171 |
| LLM to first sentence | 1,172 |
| TTS sentence 1 (11 chars) | 599 |
| **→ First audio to browser** | **2,946** |

---

## Summary Statistics (10 complete turns)

| Metric | Min | Avg | Max |
|--------|-----|-----|-----|
| STT duration | 906 | 1,147 | 1,342 |
| LLM → first sentence | 863 | 1,239 | 1,493 |
| TTS sentence 1 | 589 | 969 | 1,891 |
| **Time to first audio** | **2,763** | **3,369** | **4,265** |
| Total TTS (all sentences) | 1,181 | 2,907 | 5,609 |
| **Total turn time** | **3,435** | **5,413** | **7,794** |
| Sentences per response | 1 | 2.7 | 4 |
| API overhead | 2 | 4 | 6 |

---

## Critical Finding: The Gap Between First Audio and Turn Completion

The streaming pipeline IS working correctly. The browser receives sentence 1 audio at ~3.4s average. However the **total turn time averages 5.4s** because sentences 2–4 are TTS'd sequentially AFTER sentence 1 is sent. The server holds the SSE stream open until all sentences are done.

```
Turn timeline (Turn 1, Monisha — visual):
0ms    ──── STT upload + processing (1242ms) ────►
1242ms ──── LLM streaming (1170ms to first sentence) ──►
2415ms ──── TTS sentence 1 (805ms) ────►
3221ms ──── ✓ BROWSER HEARS SENTENCE 1
3221ms ──── TTS sentence 2 (1174ms) ────►         ← while user is listening to s1
4397ms ──── TTS sentence 3 (855ms) ────►
5255ms ──── TTS sentence 4 (923ms) ────►
6183ms ──── Stream closes, browser can start next turn
```

The user hears audio at 3.2s but the NEXT recording can't start until 6.2s — because the browser's `callSessionTurn` only returns when the SSE stream closes AND all audio finishes playing.

---

## Streaming Status

- **Gemini streaming: YES** — `streamGenerateContent?alt=sse`, confirmed working
- **Cartesia streaming: NO** — `/tts/bytes` batch, first byte == last byte
- **Sarvam streaming: NO** — batch endpoint, full audio uploaded per turn

---

## Code Anomalies Found

### 1. CRITICAL: LLM generating 3–4 sentences despite "1-2 sentence" instruction
The VOICE_RULE says `1-2 short sentences` but Gemini is consistently producing 3-4 sentences (avg 2.7). Each extra sentence adds ~1s sequential TTS. Turn 4 had 4 sentences → 7.8s total turn.

### 2. HIGH: First sentence sometimes too long (hitting mid-sentence boundary)
Turn 2, sentence 1 = 101 chars → 1,891ms TTS (worst case). The sentence-end regex fires on `।` or `.` mid-clause, producing a fragment that's too long. Large sentence 1 = slow first audio.

### 3. HIGH: Browser blocks next recording until ALL audio played + stream closed
`processTurn()` calls `await callSessionTurn()` which awaits `Promise.all([readStream(), playStream()])`. `readStream()` doesn't finish until the SSE stream closes (after ALL sentences TTS'd). So even though the user hears sentence 1 at 3.2s, the next recording doesn't start until ~6s + audio playback time (~5–8s of audio). The actual inter-turn gap perceived by the user is probably **12–15 seconds**.

### 4. MEDIUM: TTS latency anomalies on short text
Turn 4 sentence 3 (30 chars): 1,984ms. Turn 5 sentence 2 (33 chars): 2,076ms. These are ~3x slower than expected for their length. Cartesia appears to occasionally spike. No retry logic exists.

### 5. MEDIUM: Session 410 errors during hot-reload
Multiple turns got `found: false | total_sessions: 0` — the in-memory `Map` is reset every time Next.js hot-reloads a module during development. Not a production issue but breaks testing flow.

### 6. LOW: Controller already closed error (first attempt only)
The very first logged attempt shows `Invalid state: Controller is already closed`. This was the concurrent TTS race condition (before the `await onToken` fix). The successful turns after it don't have this error — the fix works.

---

## Root Cause Analysis

### Why users still feel ~6s latency

The user experiences this timeline per conversation turn:

| Phase | Time | Notes |
|-------|------|-------|
| Stop speaking | 0ms | |
| VAD silence timeout | +700ms | Fixed from 1500ms |
| Audio upload + STT | +1,147ms | Unavoidable with batch Sarvam |
| LLM first sentence | +1,239ms | Gemini 2.5 Flash streaming |
| TTS sentence 1 | +969ms | Cartesia batch |
| **User hears first word** | **~4,000ms** | |
| Remaining audio plays | +3,000–8,000ms | 2–4 more sentences |
| Next recording starts | +after all audio | |

**The user does NOT feel 6s before hearing audio** — they feel ~4s. But they feel 10–15s between the end of their speech and when they can speak again (because the agent reads out a 3-4 sentence response that was never necessary).

---

## Top 3 Hypotheses for Remaining Latency

### 1. LLM over-generates (3–4 sentences instead of 1–2): adds ~2–4s per turn
The VOICE_RULE is not being enforced. Gemini 2.5 Flash ignores "1-2 sentences" and writes conversational clinic responses that are naturally 3-4 sentences. Each adds ~1s sequential TTS delay to total turn time.

**Evidence:** Average 2.7 sentences/turn. Turn 6 (1 sentence) finished in 3.4s. All other turns with 3+ sentences took 5–8s.

### 2. First sentence TTS latency is high (~1s average): Cartesia batch is slow
Average TTS for sentence 1 = 969ms. In streaming mode this would be ~80–150ms to first byte. Every turn delays first audio by ~1s purely due to Cartesia batch.

**Evidence:** All 10 turns show TTS s1 between 589ms–1,891ms with no early delivery.

### 3. Browser blocks next turn until full stream + full playback complete
After the agent speaks, the browser must wait for: (a) SSE stream to close + (b) all audio chunks to play. For a 3-sentence response this is 6s server time + 5–8s playback = user can't speak again for 11–14s total. This makes the conversation feel extremely slow even though first audio is at 3–4s.

---

## Recommended Fix Order

### Fix 1 — Force 1-sentence LLM responses (implement in VOICE_RULE)
**Impact:** Cuts total turn time from avg 5.4s → ~3.2s. Eliminates the chain of sequential TTS calls.  
**Change:** In `pipeline-stream.ts`, update `VOICE_RULE` rule #1 to:  
> "CRITICAL: Respond in EXACTLY ONE sentence. Never more. The sentence must be complete."  
**Risk:** Very low. May reduce response quality for complex queries, but for a receptionist use case one sentence per turn is standard.

### Fix 2 — Start next recording as soon as sentence 1 plays, not after stream closes
**Impact:** User can speak again ~3s earlier per turn (overlapping agent speech with listening readiness).  
**Change:** In `callSessionTurn`, signal `processTurn` to start recording after sentence 1 audio begins playing, while remaining chunks play in the background. Complex frontend change.  
**Risk:** Medium — requires careful state management to avoid mic recording during agent speech.

### Fix 3 — Cartesia WebSocket streaming (first byte ~80ms instead of ~900ms)
**Impact:** Saves ~800ms on time to first audio (3.4s → 2.6s).  
**Change:** Replace `tts.ts` `/tts/bytes` with Cartesia WebSocket API. Stream raw PCM bytes to browser as they arrive.  
**Risk:** High — significant code rewrite, requires WebSocket connection management.

### Fix 4 (optional) — Parallel TTS for sentences 2+ while sentence 1 plays
**Impact:** Saves ~1–3s off total turn time without changing perceived first-audio latency.  
**Change:** In `pipeline-stream.ts`, after sending sentence 1 audio, fire TTS for sentence 2 concurrently while sentence 1 is being played by the browser.  
**Risk:** Low server-side. Will use 2 concurrent Cartesia connections — within free tier limit of 2 (careful).

---

## Recommendation

**Start with Fix 1 only.** It requires a 3-word change to the system prompt and will immediately cut 2–4 seconds from every turn. Test with 1-sentence responses first. If quality suffers, fall back to a 2-sentence cap with hard enforcement (`max_tokens: 60`).

The current 5.4s average drops to ~3.2s with Fix 1 alone, which is the 3s target. Fix 2 and Fix 3 can be evaluated later.
