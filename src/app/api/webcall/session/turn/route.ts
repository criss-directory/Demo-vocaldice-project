import { NextRequest } from 'next/server'
import { getSession } from '@/lib/voice-core/session'
import { runTurnStream } from '@/lib/voice-core/pipeline-stream'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const apiReceived = Date.now()
  console.log(`[API_TURN_RECEIVED] ${apiReceived}`)

  const formData  = await req.formData()
  const sessionId = formData.get('sessionId') as string | null
  const audioFile = formData.get('audio') as Blob | null

  if (!sessionId) {
    return new Response(
      'data: ' + JSON.stringify({ type: 'error', error: 'Missing sessionId' }) + '\n\n',
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }
  if (!audioFile) {
    return new Response(
      'data: ' + JSON.stringify({ type: 'error', error: 'Missing audio' }) + '\n\n',
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const session = getSession(sessionId)
  if (!session) {
    return new Response(
      'data: ' + JSON.stringify({ type: 'error', error: 'Session expired or not found' }) + '\n\n',
      { status: 410, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
  const beforeCore = Date.now()
  console.log(`[API_TURN_BEFORE_CORE] ${beforeCore} | api_overhead_ms: ${beforeCore - apiReceived} | audio_bytes: ${audioBuffer.length}`)

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      let closed = false
      const send = (event: object) => {
        if (closed) return
        try {
          controller.enqueue(enc.encode('data: ' + JSON.stringify(event) + '\n\n'))
        } catch {
          closed = true
        }
      }
      try {
        await runTurnStream(session, audioBuffer, send)
        const afterCore = Date.now()
        console.log(`[API_TURN_AFTER_CORE] ${afterCore} | core_total_ms: ${afterCore - beforeCore}`)
      } catch (err: any) {
        console.error('[session/turn] Stream error:', err)
        send({ type: 'error', error: err.message })
      } finally {
        console.log(`[API_TURN_RESPONSE_SENT] ${Date.now()} | total_from_received: ${Date.now() - apiReceived}ms`)
        if (!closed) controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
