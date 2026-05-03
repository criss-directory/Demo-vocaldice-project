import { NextRequest, NextResponse } from 'next/server'
import { getSession, endSession } from '@/lib/voice-core/session'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const LANG_CODE_TO_NAME: Record<string, string> = {
  te: 'Telugu', kn: 'Kannada', ta: 'Tamil', ml: 'Malayalam', hi: 'Hindi', en: 'English',
}

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      accessToken = '',
      duration    = 0,
      endedBy     = 'User',
      recordingUrl = '',
    } = await req.json()

    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const session = getSession(sessionId)
    if (!session) {
      // Already ended or expired — return 200 (idempotent)
      return NextResponse.json({ callLogId: null, duration })
    }

    // Build transcript from server-held history
    const msgs = session.history
    const transcriptText = msgs
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'Caller'}: ${m.content}`)
      .join('\n')
    const transcriptJson = msgs.map((m, i) => ({
      role: m.role, content: m.content, timestamp: String(i), index: i,
    }))

    const detectedLang = (session.detected_language || session.preset.language)
      .replace(/-[A-Za-z]{2,}$/, '').toLowerCase()

    let callLogId: string | null = null
    if (msgs.length > 1) { // don't save if only first message (no real conversation)
      try {
        const supabase = createClient(
          (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'),
          (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'),
          accessToken
            ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
            : {}
        )

        const { data: logRow, error: logErr } = await supabase
          .from('call_logs')
          .insert({
            agent_id:         session.agent_id,
            agent_name:       session.agent.agent_name || 'Agent',
            call_date:        new Date(session.created_at).toISOString(),
            call_type:        'Web Call',
            from_number:      'Web Call',
            to_number:        'Assistant',
            duration_seconds: Math.round(duration),
            status:           'completed',
            ended_by:         endedBy,
            cost:             0,
            language:         LANG_CODE_TO_NAME[detectedLang] || 'English',
            transcript:       transcriptText,
            transcript_json:  transcriptJson,
            recording_url:    recordingUrl,
            analysis:         {},
          })
          .select('id')
          .single()

        if (logErr) {
          console.error('[session/end] call_logs insert failed:', logErr.message)
        } else {
          callLogId = logRow?.id ?? null
        }
      } catch (e: any) {
        console.error('[session/end] DB error:', e.message)
      }
    }

    endSession(sessionId)
    return NextResponse.json({ callLogId, duration })
  } catch (err: any) {
    console.error('[session/end] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
