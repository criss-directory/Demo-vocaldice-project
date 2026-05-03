import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

  const apiKey = process.env.CARTESIA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No Cartesia API key' }, { status: 500 })

  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-06-10', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: 'sonic-english',
      transcript: text,
      voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
      output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Cartesia TTS error:', err)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }

  const audio = await res.arrayBuffer()
  return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(audio.byteLength) } })
}
