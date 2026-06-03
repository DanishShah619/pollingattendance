import Poll from '@/model/Poll'
import { broadcast } from '@/lib/sse'

const activeTimers = new Map<string, NodeJS.Timeout>()

export async function closePollByTimer(pollId: string, sessionId: string) {
  try {
    const poll = await Poll.findById(pollId)
    if (!poll || !poll.isOpen) return
    
    poll.isOpen = false
    poll.closedAt = new Date()
    poll.closedBy = 'timer'
    await poll.save()
    
    // Broadcast via SSE
    await broadcast(sessionId, {
      type: 'poll:closed',
      data: {
        pollId,
        closedBy: 'timer',
        closedAt: poll.closedAt,
      }
    })
    console.log(`[Poll Scheduler] Poll ${pollId} closed automatically by timer.`)
  } catch (err) {
    console.error(`[Poll Scheduler] Failed to close poll ${pollId} by timer:`, err)
  }
}

export function schedulePollClose(pollId: string, sessionId: string, delayMs: number) {
  // Clear any existing timer for this poll
  if (activeTimers.has(pollId)) {
    clearTimeout(activeTimers.get(pollId)!)
  }
  
  const timer = setTimeout(async () => {
    activeTimers.delete(pollId)
    await closePollByTimer(pollId, sessionId)
  }, delayMs)
  
  activeTimers.set(pollId, timer)
}

export function cancelPollTimer(pollId: string) {
  if (activeTimers.has(pollId)) {
    clearTimeout(activeTimers.get(pollId)!)
    activeTimers.delete(pollId)
  }
}

export async function rescheduleOpenPolls() {
  try {
    const openPolls = await Poll.find({ isOpen: true, hasTimeLimit: true, expiresAt: { $ne: null } })
    console.log(`[Poll Scheduler] Rescheduling ${openPolls.length} open polls...`)
    
    const now = Date.now()
    for (const poll of openPolls) {
      if (!poll.expiresAt) continue
      const expiresAtTime = new Date(poll.expiresAt).getTime()
      
      if (expiresAtTime <= now) {
        // Expired while server was down
        await closePollByTimer(poll._id.toString(), poll.sessionId.toString())
      } else {
        // Reschedule
        const delay = expiresAtTime - now
        schedulePollClose(poll._id.toString(), poll.sessionId.toString(), delay)
        console.log(`[Poll Scheduler] Scheduled poll ${poll._id} to close in ${Math.round(delay / 1000)}s`)
      }
    }
  } catch (err) {
    console.error('[Poll Scheduler] Error in rescheduling open polls:', err)
  }
}
