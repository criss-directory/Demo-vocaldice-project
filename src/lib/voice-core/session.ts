import { randomUUID } from 'crypto'
import type { VoiceSession, PresetConfig, VoiceConfig, AgentRow } from './types'

// Server-side session store for Pipeline B (web calls)
// Sessions expire after 30 min inactivity — no Redis needed for V1.0
const SESSION_TTL_MS = 30 * 60 * 1000

const globalForSessions = globalThis as unknown as {
  __voiceSessions: Map<string, VoiceSession> | undefined
}

const sessions = globalForSessions.__voiceSessions ?? new Map<string, VoiceSession>()
if (process.env.NODE_ENV !== 'production') {
  globalForSessions.__voiceSessions = sessions
}

export function createSession(
  agentId: string,
  preset: PresetConfig,
  voice: VoiceConfig,
  agent: AgentRow
): VoiceSession {
  const session: VoiceSession = {
    session_id: randomUUID(),
    agent_id: agentId,
    preset,
    voice,
    agent,
    history: [],
    detected_language: null,
    created_at: Date.now(),
    last_active: Date.now(),
  }
  sessions.set(session.session_id, session)
  return session
}

export function getSession(sessionId: string): VoiceSession | null {
  const t = Date.now()
  const session = sessions.get(sessionId)
  if (!session) {
    console.log(`[SESSION_LOOKUP] ${t} | sessionId: ${sessionId} | found: false | total_sessions: ${sessions.size}`)
    return null
  }
  const age = t - session.last_active
  if (age > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    console.log(`[SESSION_LOOKUP] ${t} | sessionId: ${sessionId} | found: false (expired) | age_ms: ${age}`)
    return null
  }
  console.log(`[SESSION_LOOKUP] ${t} | sessionId: ${sessionId} | found: true | age_ms: ${age} | history_turns: ${session.history.length}`)
  session.last_active = t
  return session
}

export function endSession(sessionId: string): void {
  sessions.delete(sessionId)
}

// Purge expired sessions — call on an interval or at session start
export function purgeExpired(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.last_active > SESSION_TTL_MS) sessions.delete(id)
  }
}
