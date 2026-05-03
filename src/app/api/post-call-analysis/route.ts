import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface TranscriptMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface PostCallConfig {
  variables: { key: string; label: string; enabled: boolean }[]
  options: {
    call_summary: boolean
    full_conversation: boolean
    sentiment_analysis: boolean
    extracted_information: boolean
  }
}

function buildTranscriptText(transcript: TranscriptMessage[]): string {
  return transcript
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'Caller'}: ${m.content}`)
    .join('\n')
}

function buildExtractionPrompt(transcript: TranscriptMessage[], config: PostCallConfig): string {
  const enabledVars = config.variables.filter(v => v.enabled)
  const fieldsList = enabledVars.map(v => `- "${v.key}": ${v.label}`).join('\n')
  const opts = config.options
  const sections: string[] = []

  if (opts.extracted_information && enabledVars.length > 0) {
    sections.push(`Extract the following caller information (use null if not mentioned):\n${fieldsList}`)
  }
  sections.push(`IMPORTANT: If the caller booked or requested an appointment, you MUST extract "appointment_date" (YYYY-MM-DD format or words like "tomorrow") and "appointment_time" (e.g., "4:00 PM"). If they did not, set these two fields to null.`)
  if (opts.call_summary) {
    sections.push(`Provide a "call_summary": a concise 2-3 sentence summary of what was discussed.`)
  }
  if (opts.sentiment_analysis) {
    sections.push(`Provide "sentiment": the caller's overall sentiment — one of: "Positive", "Neutral", "Negative".`)
  }

  const transcriptText = buildTranscriptText(transcript)
  return `You are analyzing a medical clinic call transcript. ${sections.join(' ')}

Return ONLY a valid JSON object with the requested fields. No markdown, no explanation.

TRANSCRIPT:
${transcriptText}

JSON response:`
}

async function runGroqAnalysis(prompt: string): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

async function runGeminiAnalysis(prompt: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  return JSON.parse(content)
}

// ── Date/Time Resolution ──────────────────────────────────────────────────────

function resolveDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()

  // Use IST time (UTC+5:30)
  const nowUtc = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const now = new Date(nowUtc.getTime() + istOffset)

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => {
    const adj = new Date(d.getTime() + istOffset)
    return `${adj.getUTCFullYear()}-${pad(adj.getUTCMonth() + 1)}-${pad(adj.getUTCDate())}`
  }

  if (lower === 'today') return fmt(now)
  if (lower === 'tomorrow') {
    const t = new Date(now); t.setUTCDate(t.getUTCDate() + 1); return fmt(t)
  }
  if (lower === 'day after tomorrow') {
    const t = new Date(now); t.setUTCDate(t.getUTCDate() + 2); return fmt(t)
  }

  // "next monday/tuesday/..." etc
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const nextMatch = lower.match(/^next\s+(\w+)$/)
  if (nextMatch) {
    const target = weekdays.indexOf(nextMatch[1])
    if (target !== -1) {
      const t = new Date(now)
      const current = t.getUTCDay()
      const diff = (target - current + 7) % 7 || 7
      t.setUTCDate(t.getUTCDate() + diff)
      return fmt(t)
    }
  }

  // Named weekday without "next"
  const dayMatch = lower.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/)
  if (dayMatch) {
    const target = weekdays.indexOf(dayMatch[1])
    const t = new Date(now)
    const current = t.getUTCDay()
    const diff = (target - current + 7) % 7 || 7
    t.setUTCDate(t.getUTCDate() + diff)
    return fmt(t)
  }

  // "13th april", "april 13", "13 april 2026", etc.
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const dateMonthMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/)
  if (dateMonthMatch) {
    const day = parseInt(dateMonthMatch[1])
    const month = months.indexOf(dateMonthMatch[2])
    const year = dateMonthMatch[3] ? parseInt(dateMonthMatch[3]) : now.getUTCFullYear()
    if (month !== -1 && day >= 1 && day <= 31) {
      return `${year}-${pad(month + 1)}-${pad(day)}`
    }
  }

  // "april 13", "april 13th"
  const monthDayMatch = lower.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/)
  if (monthDayMatch) {
    const month = months.indexOf(monthDayMatch[1])
    const day = parseInt(monthDayMatch[2])
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : now.getUTCFullYear()
    if (month !== -1 && day >= 1 && day <= 31) {
      return `${year}-${pad(month + 1)}-${pad(day)}`
    }
  }

  // Already ISO-formatted YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()

  return null
}

function resolveTime(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Strip time ranges: "3:00 PM - 4:00 PM" → "3:00 PM", "3 to 4 PM" → "3"
  // Take only the part before " - ", " to ", or " – "
  const stripped = raw
    .replace(/\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')  // "3:00 PM - 4:00 PM" → "3:00 PM"
    .replace(/\s+to\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')       // "3 to 4 PM" → "3"
    .trim()

  const lower = stripped.toLowerCase().trim()
  const pad = (n: number) => String(n).padStart(2, '0')

  // "HH:MM" or "H:MM"
  const colonMatch = lower.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/)
  if (colonMatch) {
    let h = parseInt(colonMatch[1])
    const m = parseInt(colonMatch[2])
    const ampm = colonMatch[3]
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    return `${pad(h)}:${pad(m)}`
  }

  // "4 o'clock", "4 o clock" — assume pm if 1-7, else am
  const oclockMatch = lower.match(/^(\d{1,2})\s*o['\s]?clock(?:\s*(am|pm))?$/)
  if (oclockMatch) {
    let h = parseInt(oclockMatch[1])
    const ampm = oclockMatch[2]
    if (ampm === 'pm' || (!ampm && h >= 1 && h <= 7)) h = h < 12 ? h + 12 : h
    if (ampm === 'am' && h === 12) h = 0
    return `${pad(h)}:00`
  }

  // "4 pm", "4pm", "4 am", "16", etc.
  const simpleMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (simpleMatch) {
    let h = parseInt(simpleMatch[1])
    const m = simpleMatch[2] ? parseInt(simpleMatch[2]) : 0
    const ampm = simpleMatch[3]
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    if (!ampm && h < 8) h += 12 // assume PM for ambiguous single-digit hours 1-7
    return `${pad(h)}:${pad(m)}`
  }

  // "noon"
  if (lower === 'noon') return '12:00'
  if (lower === 'midnight') return '00:00'

  return null
}

// ── Conflict Check & Appointment Creation ────────────────────────────────────

async function createAppointmentIfBooked(params: {
  supabase: any
  userId: string
  agentId: string
  callLogId: string
  analysis: any
  transcript: TranscriptMessage[]
  callDurationSeconds: number
  callType: string
  slotDurationMinutes: number
}) {
  const { supabase, userId, agentId, callLogId, analysis, transcript, callDurationSeconds, callType, slotDurationMinutes } = params

  const rawDate = analysis.appointment_date ?? analysis.date ?? null
  const rawTime = analysis.appointment_time ?? analysis.time ?? null
  const patientName = analysis.caller_name ?? analysis.name ?? 'Unknown'
  const doctor = analysis.doctor ?? ''
  const department = analysis.department ?? ''
  const patientPhone = analysis.phone_number ?? analysis.caller_number ?? ''

  // Only create an appointment if both date and time were extracted
  if (!rawDate || !rawTime) {
    console.log('[Appointment] Skipping — no date/time extracted from analysis')
    return
  }

  const appointmentDate = resolveDate(rawDate)
  const appointmentTime = resolveTime(rawTime)

  if (!appointmentDate || !appointmentTime) {
    console.log('[Appointment] Skipping — could not resolve date/time from:', rawDate, rawTime)
    return
  }

  // Build slot end time for conflict detection
  const [startH, startM] = appointmentTime.split(':').map(Number)
  const startMins = startH * 60 + startM
  const endMins = startMins + slotDurationMinutes

  // Check for conflicts: same doctor, same date, overlapping slot
  let conflictNote = ''
  if (doctor) {
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('appointment_time, slot_duration')
      .eq('user_id', userId)
      .eq('doctor', doctor)
      .eq('appointment_date', appointmentDate)
      .neq('status', 'no_show')

    if (conflicts && conflicts.length > 0) {
      const hasConflict = conflicts.some((c: any) => {
        const [cH, cM] = (c.appointment_time as string).split(':').map(Number)
        const cStart = cH * 60 + cM
        const cEnd = cStart + (c.slot_duration || slotDurationMinutes)
        return startMins < cEnd && endMins > cStart
      })

      if (hasConflict) {
        conflictNote = `⚠️ Note: Original requested slot ${rawTime} had a conflict. This was the next available slot or booking logged as-is for staff review.`
        console.log('[Appointment] Conflict detected for doctor:', doctor, 'at', appointmentTime, 'on', appointmentDate)
      }
    }
  }

  const transcriptText = transcript.map(m =>
    `${m.role === 'assistant' ? 'LLM' : 'User'}: ${m.content}`
  ).join('\n')

  // Insert appointment
  const { error } = await supabase.from('appointments').insert({
    user_id: userId,
    agent_id: agentId,
    call_log_id: callLogId,
    patient_name: patientName,
    patient_phone: patientPhone,
    doctor: doctor || null,
    department: department || null,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    slot_duration: slotDurationMinutes,
    status: 'scheduled',
    call_summary: (analysis.call_summary || '') + (conflictNote ? '\n\n' + conflictNote : ''),
    transcript: transcriptText,
    call_duration_seconds: callDurationSeconds,
    call_type: callType,
    raw_analysis: analysis,
  })

  if (error) {
    console.error('[Appointment] Insert failed:', error)
  } else {
    console.log('[Appointment] Created for', patientName, 'on', appointmentDate, 'at', appointmentTime)
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json()
    const { callLogId, transcript, postCallConfig, agentId, llmProvider, callDurationSeconds, callType } = body

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    const defaultOptions = { call_summary: true, full_conversation: false, sentiment_analysis: true, extracted_information: true }
    const config: PostCallConfig = {
      variables: postCallConfig?.variables || [],
      options: { ...defaultOptions, ...(postCallConfig?.options || {}) },
    }

    const prompt = buildExtractionPrompt(transcript, config)

    let analysis: any = {}
    try {
      if (llmProvider === 'gemini') {
        analysis = await runGeminiAnalysis(prompt)
      } else {
        analysis = await runGroqAnalysis(prompt)
      }
    } catch (e) {
      console.error('[PostCall] LLM analysis failed, trying fallback:', e)
      try {
        analysis = await runGeminiAnalysis(prompt)
      } catch (e2) {
        console.error('[PostCall] Fallback also failed:', e2)
        analysis = { error: 'Analysis failed' }
      }
    }

    // Save analysis back to call log
    if (callLogId) {
      await supabase
        .from('call_logs')
        .update({ analysis, summary: analysis.call_summary || '' })
        .eq('id', callLogId)
        .eq('agent_id', agentId)
    }

    // Fetch agent slot duration
    let slotDurationMinutes = 30
    if (agentId) {
      const { data: agentRow } = await supabase
        .from('agents')
        .select('slot_duration_minutes')
        .eq('id', agentId)
        .single()
      if (agentRow?.slot_duration_minutes) slotDurationMinutes = agentRow.slot_duration_minutes
    }

    // Auto-create appointment if booking was made
    await createAppointmentIfBooked({
      supabase,
      userId: user.id,
      agentId: agentId || '',
      callLogId: callLogId || '',
      analysis,
      transcript,
      callDurationSeconds: callDurationSeconds || 0,
      callType: callType || 'Web Call',
      slotDurationMinutes,
    })

    return NextResponse.json({ success: true, analysis })
  } catch (err) {
    console.error('Post-call analysis error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
