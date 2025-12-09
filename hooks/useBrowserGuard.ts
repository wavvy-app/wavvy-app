// hooks/useBrowserGuard.ts
import { useEffect, useRef, useCallback } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type BrowserViolation = 'TAB_SWITCH'

export type BrowserAction = 
  | 'TAB_SWITCH_GRACE'    // First tab switch (grace period)
  | 'COPY_BLOCKED'        // Copy attempt blocked
  | 'PASTE_BLOCKED'       // Paste attempt blocked
  | 'CUT_BLOCKED'         // Cut attempt blocked

interface UseBrowserGuardOptions {
  isActive: boolean
  onViolation: (type: BrowserViolation, message: string) => void
  onActionBlocked?: (action: BrowserAction, message: string) => void
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  TAB_SWITCH_COOLDOWN_MS: 7500,
  TAB_SWITCH_GRACE_ENABLED: true,
  CLIPBOARD_BLOCKING_ENABLED: true
} as const

const VIOLATION_MESSAGES = {
  TAB_SWITCH: 'Tab switching detected. Please stay in the interview window.'
} as const

const ACTION_MESSAGES = {
  TAB_SWITCH_GRACE: '⚠️ Please stay on the interview tab',
  COPY_BLOCKED: '❌ Copying is not allowed during the interview',
  PASTE_BLOCKED: '❌ Pasting is not allowed during the interview',
  CUT_BLOCKED: '❌ Cutting is not allowed during the interview'
} as const

// ============================================================================
// HOOK
// ============================================================================

/**
 * Browser Guard Hook
 * 
 * Monitors browser-level behaviors during interviews:
 * - Tab switching with grace period (first switch = no penalty)
 * - Copy/paste/cut prevention (blocked with user feedback)
 * 
 * Philosophy:
 * - First tab switch: Grace period warning (no strike, optional feedback)
 * - Subsequent switches: Trigger violation (adds strike)
 * - Clipboard actions: Blocked with optional user feedback (no strikes)
 * - Cooldown prevents spam violations
 * 
 * Modern UX Principles:
 * - Transparency: User knows what's monitored
 * - Immediate feedback: Every action gets response
 * - Progressive disclosure: Grace → Warning → Strike
 * 
 * @example
 * ```tsx
 * // Basic usage (detection only)
 * useBrowserGuard({
 *   isActive: isRecording && !isTerminated,
 *   onViolation: (type, message) => {
 *     addStrike({ type, timestamp: Date.now(), message })
 *   }
 * })
 * 
 * // With UI feedback (recommended for production)
 * useBrowserGuard({
 *   isActive: isRecording && !isTerminated,
 *   onViolation: (type, message) => {
 *     addStrike({ type, timestamp: Date.now(), message })
 *   },
 *   onActionBlocked: (action, message) => {
 *     // Show toast/notification to user
 *     if (action === 'TAB_SWITCH_GRACE') {
 *       toast.warning(message, { duration: 4000 })
 *     } else {
 *       toast.error(message, { duration: 3000 })
 *     }
 *   }
 * })
 * ```
 */
export function useBrowserGuard(options: UseBrowserGuardOptions): void {
  const { isActive, onViolation, onActionBlocked } = options
  
  // ========================================
  // REFS (Persistent state across renders)
  // ========================================
  
  const lastViolationTime = useRef<number>(0)
  const hasSeenTabWarning = useRef<boolean>(false)
  
  // ========================================
  // VIOLATION HANDLER (with cooldown)
  // ========================================
  
  const triggerViolation = useCallback((
    type: BrowserViolation,
    message: string
  ) => {
    const now = Date.now()
    
    // Apply cooldown to prevent spam
    if (now - lastViolationTime.current < CONFIG.TAB_SWITCH_COOLDOWN_MS) {
      return
    }
    
    lastViolationTime.current = now
    onViolation(type, message)
  }, [onViolation])
  
  // ========================================
  // EVENT HANDLERS
  // ========================================
  
  const handleVisibilityChange = useCallback(() => {
    if (!document.hidden) return
    
    // Tab switched away from interview
    if (CONFIG.TAB_SWITCH_GRACE_ENABLED && !hasSeenTabWarning.current) {
      // First time: Grace period - no strike
      hasSeenTabWarning.current = true
      
      // Optional: Notify user (modern UX practice)
      if (onActionBlocked) {
        onActionBlocked('TAB_SWITCH_GRACE', ACTION_MESSAGES.TAB_SWITCH_GRACE)
      }
      
    } else {
      // Subsequent times: Trigger violation (will add strike)
      triggerViolation('TAB_SWITCH', VIOLATION_MESSAGES.TAB_SWITCH)
    }
  }, [triggerViolation, onActionBlocked])
  
  const handleClipboardEvent = useCallback((e: ClipboardEvent) => {
    if (!CONFIG.CLIPBOARD_BLOCKING_ENABLED) return
    
    // Block the clipboard action
    e.preventDefault()
    
    // Determine action type
    const actionType: BrowserAction = 
      e.type === 'copy' ? 'COPY_BLOCKED' :
      e.type === 'cut' ? 'CUT_BLOCKED' :
      'PASTE_BLOCKED'
    
    // Optional: Notify user why action was blocked (modern UX practice)
    if (onActionBlocked) {
      onActionBlocked(actionType, ACTION_MESSAGES[actionType])
    }
    
    // Note: We DON'T trigger violation because:
    // 1. Action was blocked (they couldn't actually do it)
    // 2. Accidental Ctrl+C is common and shouldn't penalize
    // 3. False positives would frustrate candidates
    
  }, [onActionBlocked])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!CONFIG.CLIPBOARD_BLOCKING_ENABLED) return
    
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const modifier = isMac ? e.metaKey : e.ctrlKey
    
    // Block clipboard keyboard shortcuts
    if (modifier && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      
      // Determine action type
      const actionType: BrowserAction = 
        e.key.toLowerCase() === 'c' ? 'COPY_BLOCKED' :
        e.key.toLowerCase() === 'x' ? 'CUT_BLOCKED' :
        'PASTE_BLOCKED'
      
      // Optional: Notify user
      if (onActionBlocked) {
        onActionBlocked(actionType, ACTION_MESSAGES[actionType])
      }
    }
  }, [onActionBlocked])
  
  // ========================================
  // EFFECT: SETUP LISTENERS
  // ========================================
  
  useEffect(() => {
    if (!isActive) {
      // Reset state when monitoring stops
      hasSeenTabWarning.current = false
      lastViolationTime.current = 0
      return
    }
    
    // Attach event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('copy', handleClipboardEvent)
    document.addEventListener('paste', handleClipboardEvent)
    document.addEventListener('cut', handleClipboardEvent)
    document.addEventListener('keydown', handleKeyDown)
    
    // Cleanup on unmount or when isActive changes
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('copy', handleClipboardEvent)
      document.removeEventListener('paste', handleClipboardEvent)
      document.removeEventListener('cut', handleClipboardEvent)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, handleVisibilityChange, handleClipboardEvent, handleKeyDown])
}

export default useBrowserGuard