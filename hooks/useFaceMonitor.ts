// hooks/useFaceMonitor.ts
import { useEffect, useRef, useState, useCallback } from 'react'
import { startContinuousDetection, type FaceDetectionResult } from '@/lib/face-detection/detect-facial-details'

// ============================================================================
// TYPES
// ============================================================================

export type FaceViolation = 
  | 'NO_FACE' 
  | 'MULTIPLE_FACES' 
  | 'LOOKING_AWAY' 
  | 'CAMERA_OFF'

interface UseFaceMonitorOptions {
  video: HTMLVideoElement | null
  isActive: boolean
  onViolation: (type: FaceViolation, message: string) => void
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Violation thresholds (ms)
  NO_FACE_THRESHOLD: 10_000,        // 10s - allows camera adjustments
  LOOKING_AWAY_THRESHOLD: 2_000,    // 2s - allows natural thinking gestures
  MULTIPLE_FACES_THRESHOLD: 0,      // Instant - deliberate cheating
  CAMERA_OFF_THRESHOLD: 0,          // Instant - hardware disconnect
  
  // System settings
  COOLDOWN_MS: 7_500,               // 7.5s between same violation type
  MAX_DETECTION_ERRORS: 5,          // Disable after repeated failures
  DETECTION_FPS: 5                  // Balance performance/responsiveness
} as const

const VIOLATION_MESSAGES = {
  NO_FACE: (duration: number) => 
    `Face not visible for ${Math.round(duration / 1000)} seconds. Please stay in camera view.`,
  MULTIPLE_FACES: (count: number) => 
    `Multiple people detected (${count} faces). Only the candidate is allowed.`,
  LOOKING_AWAY: (duration: number, direction: string) => 
    `Please keep your eyes on the screen (looking ${direction} for ${Math.round(duration / 1000)}s)`,
  CAMERA_OFF: 'Camera was disconnected or turned off'
} as const

// ============================================================================
// STATE TRACKER
// ============================================================================

class ViolationStateTracker {
  private states = new Map<FaceViolation, {
    startTime: number | null
    lastFiredTime: number
  }>()
  
  constructor() {
    const types: FaceViolation[] = ['NO_FACE', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'CAMERA_OFF']
    types.forEach(type => {
      this.states.set(type, { startTime: null, lastFiredTime: 0 })
    })
  }
  
  startTiming(type: FaceViolation): void {
    const state = this.states.get(type)
    if (state && state.startTime === null) {
      state.startTime = Date.now()
    }
  }
  
  resetTiming(type: FaceViolation): void {
    const state = this.states.get(type)
    if (state) {
      state.startTime = null
    }
  }
  
  getDuration(type: FaceViolation): number {
    const state = this.states.get(type)
    if (!state || state.startTime === null) return 0
    return Date.now() - state.startTime
  }
  
  shouldFire(type: FaceViolation, thresholdMs: number): boolean {
    const state = this.states.get(type)
    if (!state) return false
    
    const duration = this.getDuration(type)
    const timeSinceLastFire = Date.now() - state.lastFiredTime
    
    return (
      duration >= thresholdMs &&
      timeSinceLastFire >= CONFIG.COOLDOWN_MS
    )
  }
  
  markFired(type: FaceViolation): void {
    const state = this.states.get(type)
    if (state) {
      state.lastFiredTime = Date.now()
    }
  }
  
  reset(): void {
    this.states.forEach(state => {
      state.startTime = null
      state.lastFiredTime = 0
    })
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Face Monitor Hook
 * 
 * Monitors facial detection during interviews:
 * - No face detected (10s threshold)
 * - Multiple faces (instant violation)
 * - Looking away (2s threshold - DOWN/LEFT/RIGHT only, UP is safe)
 * - Camera disconnected (instant violation)
 * 
 * Philosophy:
 * - Clear thresholds with reasoning
 * - Cooldown prevents spam violations
 * - Graceful degradation on detection errors
 * 
 * @example
 * ```tsx
 * useFaceMonitor({
 *   video: videoRef.current,
 *   isActive: isRecording && !isTerminated,
 *   onViolation: (type, message) => {
 *     addStrike({ type, timestamp: Date.now(), message })
 *   }
 * })
 * ```
 */
export function useFaceMonitor(options: UseFaceMonitorOptions) {
  const { video, isActive, onViolation } = options
  
  // ========================================
  // STATE
  // ========================================
  
  const [currentDetection, setCurrentDetection] = useState<FaceDetectionResult | null>(null)
  const [cameraTrackActive, setCameraTrackActive] = useState(true)
  const [detectionEnabled, setDetectionEnabled] = useState(true)
  
  // ========================================
  // REFS
  // ========================================
  
  const stateTracker = useRef(new ViolationStateTracker())
  const stopDetectionRef = useRef<(() => void) | null>(null)
  const errorCountRef = useRef(0)
  
  // ========================================
  // VIOLATION HANDLER (with cooldown)
  // ========================================
  
  const fireViolation = useCallback((
    type: FaceViolation,
    message: string
  ) => {
    stateTracker.current.markFired(type)
    onViolation(type, message)
  }, [onViolation])
  
  // ========================================
  // EFFECT 1: START/STOP FACE DETECTION
  // ========================================
  
  useEffect(() => {
    if (!video || !isActive || !detectionEnabled) {
      stopDetectionRef.current?.()
      stopDetectionRef.current = null
      stateTracker.current.reset()
      return
    }
    
    startContinuousDetection(
      video,
      {
        onDetection: (result) => {
          setCurrentDetection(result)
          errorCountRef.current = 0
        },
        onError: (error) => {
          console.error('Face detection error:', error)
          errorCountRef.current++
          
          if (errorCountRef.current >= CONFIG.MAX_DETECTION_ERRORS) {
            console.warn('Face detection disabled after repeated errors')
            setDetectionEnabled(false)
            fireViolation(
              'CAMERA_OFF',
              'Face detection unavailable. Please ensure camera is working.'
            )
          }
        }
      },
      CONFIG.DETECTION_FPS
    )
      .then(cleanup => {
        stopDetectionRef.current = cleanup
      })
      .catch(err => {
        console.error('Failed to start face detection:', err)
        setDetectionEnabled(false)
      })
    
    return () => {
      stopDetectionRef.current?.()
      stopDetectionRef.current = null
    }
  }, [video, isActive, detectionEnabled, fireViolation])
  
  // ========================================
  // EFFECT 2: MONITOR CAMERA HARDWARE
  // ========================================
  
  useEffect(() => {
    if (!video || !isActive) return
    
    const stream = video.srcObject as MediaStream
    if (!stream) return
    
    const track = stream.getVideoTracks()[0]
    if (!track) return
    
    const updateCameraStatus = () => {
      const isActive = track.readyState === 'live' && track.enabled
      setCameraTrackActive(isActive)
      
      if (!isActive) {
        const tracker = stateTracker.current
        if (tracker.shouldFire('CAMERA_OFF', CONFIG.CAMERA_OFF_THRESHOLD)) {
          fireViolation('CAMERA_OFF', VIOLATION_MESSAGES.CAMERA_OFF)
        }
      } else {
        stateTracker.current.resetTiming('CAMERA_OFF')
      }
    }
    
    track.addEventListener('ended', updateCameraStatus)
    track.addEventListener('mute', updateCameraStatus)
    updateCameraStatus()
    
    return () => {
      track.removeEventListener('ended', updateCameraStatus)
      track.removeEventListener('mute', updateCameraStatus)
    }
  }, [video, isActive, fireViolation])
  
  // ========================================
  // EFFECT 3: PROCESS DETECTION RESULTS
  // ========================================
  
  useEffect(() => {
    if (!isActive || !currentDetection || !detectionEnabled) {
      return
    }
    
    const tracker = stateTracker.current
    const { faceCount, faces } = currentDetection
    
    // ----------------------------------------
    // CHECK 1: NO FACE DETECTED
    // ----------------------------------------
    
    if (faceCount === 0 && cameraTrackActive) {
      tracker.startTiming('NO_FACE')
      
      if (tracker.shouldFire('NO_FACE', CONFIG.NO_FACE_THRESHOLD)) {
        const duration = tracker.getDuration('NO_FACE')
        fireViolation('NO_FACE', VIOLATION_MESSAGES.NO_FACE(duration))
      }
    } else {
      tracker.resetTiming('NO_FACE')
    }
    
    // ----------------------------------------
    // CHECK 2: MULTIPLE FACES DETECTED
    // ----------------------------------------
    
    if (faceCount > 1) {
      tracker.startTiming('MULTIPLE_FACES')
      
      if (tracker.shouldFire('MULTIPLE_FACES', CONFIG.MULTIPLE_FACES_THRESHOLD)) {
        fireViolation('MULTIPLE_FACES', VIOLATION_MESSAGES.MULTIPLE_FACES(faceCount))
      }
    } else {
      tracker.resetTiming('MULTIPLE_FACES')
    }
    
    // ----------------------------------------
    // CHECK 3: LOOKING AWAY
    // ----------------------------------------
    
    if (faceCount === 1) {
      const face = faces[0]
      
      // Suspicious poses: DOWN (phone), LEFT/RIGHT (second monitor)
      // LOOKING_UP is SAFE (natural thinking gesture)
      const isSuspicious = 
        face.headPose === 'LOOKING_DOWN' ||
        face.headPose === 'LOOKING_LEFT' ||
        face.headPose === 'LOOKING_RIGHT'
      
      if (isSuspicious) {
        tracker.startTiming('LOOKING_AWAY')
        
        if (tracker.shouldFire('LOOKING_AWAY', CONFIG.LOOKING_AWAY_THRESHOLD)) {
          const duration = tracker.getDuration('LOOKING_AWAY')
          const direction = face.headPose.replace('LOOKING_', '').toLowerCase()
          fireViolation('LOOKING_AWAY', VIOLATION_MESSAGES.LOOKING_AWAY(duration, direction))
        }
      } else {
        tracker.resetTiming('LOOKING_AWAY')
      }
    } else {
      tracker.resetTiming('LOOKING_AWAY')
    }
    
  }, [currentDetection, isActive, cameraTrackActive, detectionEnabled, fireViolation])
  
  // ========================================
  // RETURN PUBLIC API
  // ========================================
  
  return {
    detection: currentDetection,
    cameraActive: cameraTrackActive,
    detectionEnabled,
    
    getViolationDuration: (type: FaceViolation) => 
      stateTracker.current.getDuration(type),
    
    reset: () => {
      stateTracker.current.reset()
      errorCountRef.current = 0
      setCurrentDetection(null)
    }
  }
}

export default useFaceMonitor