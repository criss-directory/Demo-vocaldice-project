import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Proxy Cartesia voice preview audio — browser <audio> can't send X-API-Key header directly
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const { voiceId } = await params
  const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
  if (!CARTESIA_API_KEY) {
    return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 })
  }

  try {
    // Fetch voice metadata to get preview_file_url
    const voiceRes = await fetch(
      `https://api.cartesia.ai/voices/${voiceId}?expand[]=preview_file_url`,
      {
        headers: {
          'X-API-Key': CARTESIA_API_KEY,
          'Cartesia-Version': '2024-06-10',
        },
      }
    )

    if (!voiceRes.ok) {
      return NextResponse.json({ error: 'Voice not found' }, { status: 404 })
    }

    const voice = await voiceRes.json()
    const previewUrl: string | undefined = voice.preview_file_url

    if (!previewUrl) {
      return NextResponse.json({ error: 'No preview available for this voice' }, { status: 404 })
    }

    // Fetch the actual audio with auth header (browser can't do this directly)
    const audioRes = await fetch(previewUrl, {
      headers: { 'X-API-Key': CARTESIA_API_KEY },
    })

    if (!audioRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch preview audio' }, { status: 502 })
    }

    const audioBuffer = await audioRes.arrayBuffer()
    const contentType = audioRes.headers.get('Content-Type') || 'audio/mpeg'

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
