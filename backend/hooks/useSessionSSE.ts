import { useEffect, useRef } from 'react'

export interface SSECallbacks {
  onAttendance?: (data: any) => void
  onPollNew?: (data: any) => void
  onPollUpdate?: (data: any) => void
  onPollClosed?: (data: any) => void
}

/**
 * Hook to manage the lifecycle of the Server-Sent Events stream for a lecture session.
 * Handled safely with a ref wrapper to prevent redundant EventSource restarts on re-renders.
 */
export function useSessionSSE(
  sessionId: string | null | undefined,
  callbacks: SSECallbacks
) {
  const callbacksRef = useRef(callbacks)

  // Sync callbacks to ref
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  useEffect(() => {
    if (!sessionId) return

    const eventSource = new EventSource(`/api/sse/${sessionId}`)

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        
        // Skip connecting confirmation payload
        if (payload.connected) return

        const currentCallbacks = callbacksRef.current

        switch (payload.type) {
          case 'attendance':
            currentCallbacks.onAttendance?.(payload.data)
            break
          case 'poll:new':
            currentCallbacks.onPollNew?.(payload.data)
            break
          case 'poll:update':
            currentCallbacks.onPollUpdate?.(payload.data)
            break
          case 'poll:closed':
            currentCallbacks.onPollClosed?.(payload.data)
            break
          default:
            console.log('[SSE Client Hook] Unhandled payload type:', payload.type)
        }
      } catch (err) {
        // Heartbeats and non-JSON comments are expected and ignored
      }
    }

    eventSource.onerror = (err) => {
      console.error('[SSE Client Hook] EventSource encountered connection issue:', err)
    }

    return () => {
      console.log(`[SSE Client Hook] Closing connection for session: ${sessionId}`)
      eventSource.close()
    }
  }, [sessionId])
}
