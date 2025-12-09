// hooks/useStrikeSystem.ts
import { useState, useCallback, useRef, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type ViolationType = 
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'LOOKING_AWAY'
  | 'CAMERA_OFF'
  | 'TAB_SWITCH'

export interface Violation {
  type: ViolationType
  timestamp: number
  message: string
}

export type StrikeSeverity = 'warning' | 'final' | 'terminal'

export interface StrikeNotification {
  severity: StrikeSeverity
  title: string
  body: string
  dismissible: boolean
  autoDismissMs: number | null
}

interface UseStrikeSystemOptions {
  maxStrikes?: number
  onTerminated?: () => void
}

interface UseStrikeSystemReturn {
  // State
  strikes: number
  maxStrikes: number
  violations: Violation[]
  notification: StrikeNotification | null
  isTerminated: boolean
  
  // Actions
  addStrike: (violation: Violation) => void
  dismissNotification: () => void
  reset: () => void
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const NOTIFICATION_CONFIG = {
  // Auto-dismiss removed - user must acknowledge strikes manually
  // This ensures they actually see and understand the warning
  // Time lost to dismissal is part of the penalty (fair consequence)
  TERMINATION_DELAY_MS: 3000  // Only terminal strike auto-advances
} as const

const VIOLATION_TITLES: Record<ViolationType, string> = {
  TAB_SWITCH: 'Please stay in this window',
  NO_FACE: 'Please ensure you\'re visible',
  MULTIPLE_FACES: 'Multiple people detected',
  LOOKING_AWAY: 'Please stay focused on the screen',
  CAMERA_OFF: 'Camera connection issue'
}

// ============================================================================
// NOTIFICATION BUILDER (Pure function - easy to test)
// ============================================================================

function buildNotification(
  violation: Violation,
  currentStrikes: number,
  maxStrikes: number
): StrikeNotification {
  const isTerminal = currentStrikes >= maxStrikes
  const isFinalWarning = currentStrikes === maxStrikes - 1
  
  // Determine severity
  let severity: StrikeSeverity
  if (isTerminal) {
    severity = 'terminal'
  } else if (isFinalWarning) {
    severity = 'final'
  } else {
    severity = 'warning'
  }
  
  // Build title
  const title = VIOLATION_TITLES[violation.type]
  
  // Build body based on severity
  let body: string
  if (isTerminal) {
    body = `Your interview session has ended.\n\n${violation.message}`
  } else if (isFinalWarning) {
    body = `FINAL WARNING: ${violation.message}\n\nOne more violation will terminate your interview.`
  } else {
    const remaining = maxStrikes - currentStrikes
    body = `${violation.message}\n\n${remaining} ${remaining === 1 ? 'warning' : 'warnings'} remaining.`
  }
  
  // Determine behavior
  const dismissible = !isTerminal
  const autoDismissMs = null  // All strikes require manual dismissal
  
  return {
    severity,
    title,
    body,
    dismissible,
    autoDismissMs
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Strike System Hook
 * 
 * Implements 3-strike violation tracking with progressive warnings:
 * - Strike 1-2: Dismissible warnings (user must manually close)
 * - Strike 3: Terminal modal (triggers termination after 3s)
 * 
 * Design Philosophy:
 * - No auto-dismiss: Users must acknowledge strikes
 * - Time spent dismissing modals is part of the penalty
 * - Ensures clear communication and understanding
 * - Prevents "I didn't see the warning" confusion
 * 
 * @example
 * ```tsx
 * const {
 *   strikes,
 *   notification,
 *   addStrike,
 *   dismissNotification
 * } = useStrikeSystem({
 *   maxStrikes: 3,
 *   onTerminated: () => router.push('/terminated')
 * })
 * 
 * // Add violation
 * addStrike({
 *   type: 'TAB_SWITCH',
 *   timestamp: Date.now(),
 *   message: 'Tab switching detected'
 * })
 * 
 * // Show notification (user must dismiss)
 * {notification && (
 *   <StrikeNotificationModal
 *     notification={notification}
 *     onDismiss={dismissNotification}
 *   />
 * )}
 * ```
 */
export function useStrikeSystem(
  options: UseStrikeSystemOptions = {}
): UseStrikeSystemReturn {
  
  const { maxStrikes = 3, onTerminated } = options
  
  // ========================================
  // STATE
  // ========================================
  
  const [strikes, setStrikes] = useState(0)
  const [violations, setViolations] = useState<Violation[]>([])
  const [notification, setNotification] = useState<StrikeNotification | null>(null)
  const [isTerminated, setIsTerminated] = useState(false)
  
  // ========================================
  // REFS (Timers)
  // ========================================
  
  const terminationRef = useRef<NodeJS.Timeout | null>(null)
  
  // ========================================
  // ADD STRIKE
  // ========================================
  
  const addStrike = useCallback((violation: Violation) => {
    // Prevent strikes after termination
    if (isTerminated) return
    
    // Log violation
    setViolations(prev => [...prev, violation])
    
    // Increment strikes and handle consequences
    setStrikes(prevStrikes => {
      const newStrikes = prevStrikes + 1
      const isTerminal = newStrikes >= maxStrikes
      
      // Build and show notification
      const notif = buildNotification(violation, newStrikes, maxStrikes)
      setNotification(notif)
      
      // Note: No auto-dismiss timer - user must manually dismiss
      // This ensures acknowledgment and prevents missing warnings
      
      // Handle termination
      if (isTerminal) {
        setIsTerminated(true)
        
        // Clear any existing termination timer
        if (terminationRef.current) {
          clearTimeout(terminationRef.current)
          terminationRef.current = null
        }
        
        // Trigger onTerminated callback after delay
        if (onTerminated) {
          terminationRef.current = setTimeout(() => {
            onTerminated()
            terminationRef.current = null
          }, NOTIFICATION_CONFIG.TERMINATION_DELAY_MS)
        }
      }
      
      return newStrikes
    })
  }, [isTerminated, maxStrikes, onTerminated])
  
  // ========================================
  // DISMISS NOTIFICATION
  // ========================================
  
  const dismissNotification = useCallback(() => {
    // Only dismissible notifications can be dismissed
    if (notification?.dismissible) {
      setNotification(null)
    }
  }, [notification])
  
  // ========================================
  // RESET SYSTEM
  // ========================================
  
  const reset = useCallback(() => {
    // Clear termination timer
    if (terminationRef.current) {
      clearTimeout(terminationRef.current)
      terminationRef.current = null
    }
    
    // Reset state
    setStrikes(0)
    setViolations([])
    setNotification(null)
    setIsTerminated(false)
  }, [])
  
  // ========================================
  // CLEANUP ON UNMOUNT
  // ========================================
  
  useEffect(() => {
    return () => {
      if (terminationRef.current) {
        clearTimeout(terminationRef.current)
      }
    }
  }, [])
  
  // ========================================
  // RETURN API
  // ========================================
  
  return {
    // State
    strikes,
    maxStrikes,
    violations,
    notification,
    isTerminated,
    
    // Actions
    addStrike,
    dismissNotification,
    reset
  }
}

export default useStrikeSystem