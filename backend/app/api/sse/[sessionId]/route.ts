import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { subscribeLocal } from '@/lib/sse'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    
    // ── 1. Authenticate user from cookie ──────────────────────────────────────
    const user = await getAuthUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // ── 2. Create stream with keep-alive ──────────────────────────────────────
    const encoder = new TextEncoder()
    const sseStream = new ReadableStream({
      start(controller) {
        // Enqueue initial greeting message
        controller.enqueue(encoder.encode('data: {"connected":true}\n\n'))

        // Subscribe to local Redis message events
        const unsubscribe = subscribeLocal(sessionId, (message: string) => {
          try {
            controller.enqueue(encoder.encode(message))
          } catch (err) {
            console.error('[SSE Route] Enqueue failed, clearing subscription:', err)
            cleanup()
          }
        })

        // Heartbeat interval (30s) to prevent browser/gateway timeout
        const heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch (err) {
            cleanup()
          }
        }, 30000)

        function cleanup() {
          clearInterval(heartbeatTimer)
          unsubscribe()
          try {
            controller.close()
          } catch {}
        }

        // Listen for client abort/close
        req.signal.addEventListener('abort', () => {
          console.log(`[SSE Route] Client aborted connection for session: ${sessionId}`)
          cleanup()
        })
      },
    })

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  } catch (error: any) {
    console.error('[SSE Route] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
