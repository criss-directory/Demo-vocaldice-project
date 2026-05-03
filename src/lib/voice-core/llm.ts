import type { VoiceSession } from './types'

export interface LLMResult {
  response: string
  duration_ms: number
}

const VOICE_RULE = `

CRITICAL RULES FOR VOICE CALL:
1. You are on a LIVE PHONE CALL. Keep responses to 1-2 complete, short sentences. Always finish your sentence — never cut off mid-thought.
2. Be warm, professional, and natural — like a real medical receptionist.
3. Respond in the SAME language the user is speaking. Use native script naturally. The TTS engine supports native scripts fully.
4. Do not repeat greetings after the first message.
5. Stay focused on clinic tasks (appointments, queries, information) only.
6. NEVER use bullet points, numbering, or lists — speak in natural flowing sentences only.`

async function callGroq(
  systemPrompt: string,
  messages: { role: 'user' | 'model' | 'assistant'; content: string }[],
  model: string
): Promise<string> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY')

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
  ]

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model, messages: groqMessages, temperature: 0.2, max_tokens: 200 }),
  })

  const data = await res.json() as any
  if (!res.ok) throw new Error(`Groq failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`)
  return data?.choices?.[0]?.message?.content || ''
}

async function callGemini(
  systemPrompt: string,
  contents: { role: string; parts: { text: string }[] }[],
  model: string
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
          // thinkingConfig only valid for gemini-2.5-* models
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    }
  )

  const data = await res.json() as any
  if (!res.ok) throw new Error(`Gemini failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`)
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function getResponse(
  transcript: string,
  session: VoiceSession
): Promise<LLMResult> {
  const start       = Date.now()
  const provider    = session.preset.llm_provider || 'groq'
  const model       = session.preset.llm_model    || 'llama-3.1-8b-instant'
  const systemPrompt = (session.agent.system_prompt || '') + VOICE_RULE
  console.log(`[LLM_START] ${start} | provider: ${provider} | model: ${model} | streaming: NO (batch generateContent) | history_turns: ${session.history.length}`)

  // Build shared message list (role normalised for both providers)
  const history = session.history.map(m => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    content: m.content,
  }))
  // Append current user turn
  history.push({ role: 'user', content: transcript })

  let text = ''

  if (provider === 'groq') {
    text = await callGroq(systemPrompt, history, model)
  } else {
    // Gemini: build alternating role array, first must be 'user'
    const contents: { role: string; parts: { text: string }[] }[] = []
    let lastRole = ''
    for (const m of history) {
      const role = m.role === 'model' ? 'model' : 'user'
      if (role === lastRole) continue
      contents.push({ role, parts: [{ text: m.content }] })
      lastRole = role
    }
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] })
    }
    try {
      text = await callGemini(systemPrompt, contents, model)
    } catch (err: any) {
      // 429 quota exceeded — fall back to Groq so the call doesn't drop
      if (err.message?.includes('429') || err.message?.includes('quota')) {
        console.warn(`[LLM] Gemini quota hit — falling back to Groq: ${err.message.slice(0, 80)}`)
        text = await callGroq(systemPrompt, history, 'llama-3.1-8b-instant')
      } else {
        throw err
      }
    }
  }

  const response = text.trim() || "I'm sorry, I didn't catch that. Could you please repeat?"
  console.log(`[LLM_END] ${Date.now()} | duration_ms: ${Date.now() - start} | response_length: ${response.length} | streaming_used: false | provider_used: ${provider}`)
  return { response, duration_ms: Date.now() - start }
}
