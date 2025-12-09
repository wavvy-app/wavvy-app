// hooks/useInterviewProctoring.ts
import { useCallback } from 'react'
import { useStrikeSystem, type ViolationType, type Violation, type StrikeNotification } from './useStrikeSystem'
import { useBrowserGuard, type BrowserViolation, type BrowserAction } from './useBrowserGuard'
import { useFaceMonitor, type FaceViolation } from './useFaceMonitor'

// ============================================================================
// TYPES
// ============================================================================

interface UseInterviewProctoringOptions {
  video: HTMLVideoElement | null
  isActive: boolean
  onTerminated: () => void
  maxStrikes?: number
  
  // Optional: UI feedback for browser actions only (grace period, clipboard blocking)
  onActionBlocked?: (action: BrowserAction, message: string) => void
  
  // Optional: Backend violation logging
  interviewId?: string
  candidateId?: string
  onViolationLogged?: (violation: Violation) => void | Promise<void>
}

interface UseInterviewProctoringReturn {
  // Strike state
  strikes: number
  maxStrikes: number
  violations: Violation[]
  isTerminated: boolean
  
  // Notification (unified from strike system)
  notification: StrikeNotification | null
  
  // Actions
  dismissNotification: () => void
  reset: () => void
  addStrike: (violation: Violation) => void
  
  // Metadata
  interviewId?: string
  candidateId?: string
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Interview Proctoring Hook
 * 
 * Unified proctoring system combining:
 * - Browser monitoring (tab switches, clipboard)
 * - Face detection (no face, multiple faces, looking away, camera off)
 * - Strike system (3-strike progressive warnings)
 * 
 * Feedback system:
 * 1. **Browser Actions** (onActionBlocked): Non-penalty feedback
 *    - Tab switch grace period (first switch)
 *    - Clipboard blocking (copy/paste/cut prevention)
 * 
 * 2. **Violations** (onViolation): Penalty-triggering events
 *    - Subsequent tab switches
 *    - Face violations (10s no face, 2s looking away, multiple faces, camera off)
 * 
 * @example
 * ```tsx
 * // Basic usage (violations only)
 * const proctoring = useInterviewProctoring({
 *   video: videoRef.current,
 *   isActive: isRecording,
 *   onTerminated: () => router.push('/interview-terminated')
 * })
 * 
 * // With browser action feedback (recommended for production)
 * const proctoring = useInterviewProctoring({
 *   video: videoRef.current,
 *   isActive: isRecording,
 *   onTerminated: () => router.push('/interview-terminated'),
 *   
 *   // Show toasts for browser actions (no strikes)
 *   onActionBlocked: (action, message) => {
 *     if (action === 'TAB_SWITCH_GRACE') {
 *       toast.warning(message, { duration: 4000 })
 *     } else {
 *       // Clipboard actions
 *       toast.error(message, { duration: 2000 })
 *     }
 *   },
 *   
 *   // Log violations to backend
 *   interviewId: interview.id,
 *   candidateId: user.id,
 *   onViolationLogged: async (violation) => {
 *     await fetch('/api/violations', {
 *       method: 'POST',
 *       body: JSON.stringify({
 *         interviewId: interview.id,
 *         violation
 *       })
 *     })
 *   }
 * })
 * 
 * // Render strike notifications
 * {proctoring.notification?.visible && (
 *   <StrikeModal
 *     severity={proctoring.notification.severity}
 *     title={proctoring.notification.title}
 *     body={proctoring.notification.body}
 *     dismissible={proctoring.notification.dismissible}
 *     onDismiss={proctoring.dismissNotification}
 *   />
 * )}
 * ```
 */
export function useInterviewProctoring(
  options: UseInterviewProctoringOptions
): UseInterviewProctoringReturn {
  
  const {
    video,
    isActive,
    onTerminated,
    maxStrikes = 3,
    onActionBlocked,
    interviewId,
    candidateId,
    onViolationLogged
  } = options
  
  // ========================================
  // STRIKE SYSTEM (Central Violation Tracker)
  // ========================================
  
  const strikeSystem = useStrikeSystem({
    maxStrikes,
    onTerminated
  })
  
  const { addStrike, isTerminated } = strikeSystem
  
  // ========================================
  // VIOLATION HANDLER (Adds Strikes)
  // ========================================
  
  /**
   * Central violation handler for penalty-triggering events
   * 
   * Flow:
   * 1. Guard: Don't add violations after termination
   * 2. Create violation object
   * 3. Add strike to system (triggers notification)
   * 4. Log to backend (non-blocking, fire-and-forget)
   */
  const handleViolation = useCallback((
    type: BrowserViolation | FaceViolation,
    message: string
  ) => {
    if (isTerminated) return
    
    const violation: Violation = {
      type: type as ViolationType,
      timestamp: Date.now(),
      message
    }
    
    // Add strike (triggers notification)
    addStrike(violation)
    
    // Optional: Log to backend (non-blocking)
    if (onViolationLogged) {
      Promise.resolve(onViolationLogged(violation)).catch((error) => {
        console.error('Failed to log violation to backend:', error)
      })
    }
  }, [addStrike, isTerminated, onViolationLogged])
  
  // ========================================
  // BROWSER MONITORING
  // ========================================
  
  useBrowserGuard({
    isActive: isActive && !isTerminated,
    onViolation: handleViolation,
    onActionBlocked: onActionBlocked
  })
  
  // ========================================
  // FACE MONITORING
  // ========================================
  
  useFaceMonitor({
    video,
    isActive: isActive && !isTerminated,
    onViolation: handleViolation
  })
  
  // ========================================
  // RETURN COORDINATED API
  // ========================================
  
  return {
    // Strike state
    strikes: strikeSystem.strikes,
    maxStrikes: strikeSystem.maxStrikes,
    violations: strikeSystem.violations,
    isTerminated: strikeSystem.isTerminated,
    
    // Notification (unified structure from strike system)
    notification: strikeSystem.notification,
    
    // Actions
    dismissNotification: strikeSystem.dismissNotification,
    reset: strikeSystem.reset,
    addStrike: strikeSystem.addStrike,
    
    // Metadata
    interviewId,
    candidateId
  }
}

export default useInterviewProctoring