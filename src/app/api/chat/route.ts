import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are Priya, a female AI receptionist for a medical clinic in South India. You speak concisely and helpfully in the patient's language (Telugu, Tamil, Kannada, Malayalam, Hindi or English). You help patients with: appointment booking, clinic enquiries, doctor availability, and general health information. When booking appointments, ask: patient name, preferred doctor, and preferred date/time. Keep replies under 80 words. Be warm and professional.`

export async function POST(req: NextRequest) {
  const { transcript, history = [], systemPrompt } = await req.json()
  if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY || process.env.Google_gemini_API_Key
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key' }, { status: 500 })

  const messages = [
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: transcript }] },
  ]

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt || SYSTEM_PROMPT }] },
      contents: messages,
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Gemini error:', err)
    return NextResponse.json({ error: 'LLM failed', detail: err }, { status: 500 })
  }

  const data = await res.json()
  const response = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I\'m sorry, I didn\'t catch that. Could you please repeat?'
  return NextResponse.json({ response })
}
