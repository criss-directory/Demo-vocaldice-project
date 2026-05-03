import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const fd = await req.formData()
  const audio = fd.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No Sarvam API key' }, { status: 500 })

  const body = new FormData()
  body.append('file', audio, audio.name || 'audio.webm')
  body.append('model', 'saarika:v2')
  body.append('language_code', 'unknown')

  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST', headers: { 'api-subscription-key': apiKey }, body,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Sarvam STT error:', err)
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json({ transcript: data.transcript, language_code: data.language_code })
}
