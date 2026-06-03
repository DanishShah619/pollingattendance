import { useEffect, useRef } from 'react'

export interface SSECallbacks {
  onAttendance?: (data: any) => void
  onPollNew?: (data: any) => void
  onPollUpdate?: (data: any) => void
  onPollClosed?: (data: any) => void
  /** Fired when the teacher ends the session — lets students clear activeSession without a refresh */
  onSessionEnded?: (data: any) => void
}

/**
 * Hook to manage the lifecycle of the Server-Sent Events stream for a lecture session.
 *
 * Design notes:
 * - The EventSource is only created when `sessionId` is a non-empty string.
 * - Callbacks are stored in a ref so the EventSource effect never needs to
 *   re-run just because a callback closure changes. This avoids closing and
 *   re-opening the SSE connection on every parent re-render.
 * - The ref is assigned directly in the render body (not inside a useEffect)
 *   which guarantees it is always current before any effect reads it.
 */
export function useSessionSSE(
  sessionId: string | null | undefined,
  callbacks: SSECallbacks
) {
  // Assign synchronously so the value is always up-to-date before effects run.
  // This is safe because refs are mutable and don't trigger re-renders.
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    if (!sessionId) return

    const eventSource = new EventSource(`/api/sse/${sessionId}`)

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)

        // Skip the initial connection confirmation heartbeat
        if (payload.connected) return

        const cb = callbacksRef.current

        switch (payload.type) {
          case 'attendance':
            cb.onAttendance?.(payload.data)
            break
          case 'poll:new':
            cb.onPollNew?.(payload.data)
            break
          case 'poll:update':
            cb.onPollUpdate?.(payload.data)
            break
          case 'poll:closed':
            cb.onPollClosed?.(payload.data)
            break
          case 'session:ended':
            cb.onSessionEnded?.(payload.data)
            break
          default:
            console.log('[SSE] Unhandled event type:', payload.type)
        }
      } catch {
        // Heartbeat comments (": heartbeat\n\n") and other non-JSON frames
        // are expected and intentionally ignored.
      }
    }

    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error for session:', sessionId, err)
    }

    return () => {
      console.log('[SSE] Closing connection for session:', sessionId)
      eventSource.close()
    }
  }, [sessionId]) // ← Only re-connect when the session ID itself changes.
}
