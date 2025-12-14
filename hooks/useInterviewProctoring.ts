import { useCallback } from 'react';
import { useStrikeSystem, type ViolationType, type Violation, type StrikeNotification } from './useStrikeSystem';
import { useBrowserGuard, type BrowserViolation, type BrowserAction } from './useBrowserGuard';
import { useFaceMonitor, type FaceViolation } from './useFaceMonitor';

interface UseInterviewProctoringOptions {
  video: HTMLVideoElement | null;
  isActive: boolean;
  onTerminated: () => void;
  maxStrikes?: number;
  onActionBlocked?: (action: BrowserAction, message: string) => void;
  interviewId?: string;
  candidateId?: string;
  onViolationLogged?: (violation: Violation) => void | Promise<void>;
}

interface UseInterviewProctoringReturn {
  strikes: number;
  maxStrikes: number;
  violations: Violation[];
  isTerminated: boolean;
  notification: StrikeNotification | null;
  dismissNotification: () => void;
  reset: () => void;
  addStrike: (violation: Violation) => void;
  interviewId?: string;
  candidateId?: string;
}

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
  } = options;
  
  const strikeSystem = useStrikeSystem({
    maxStrikes,
    onTerminated
  });
  
  const { addStrike, isTerminated } = strikeSystem;
  
  const handleViolation = useCallback((
    type: BrowserViolation | FaceViolation,
    message: string
  ) => {
    if (isTerminated) return;
    
    const violation: Violation = {
      type: type as ViolationType,
      timestamp: Date.now(),
      message
    };
    
    addStrike(violation);
    
    if (onViolationLogged) {
      Promise.resolve(onViolationLogged(violation)).catch((error) => {
        console.error('Failed to log violation to backend:', error);
      });
    }
  }, [addStrike, isTerminated, onViolationLogged]);
  
  useBrowserGuard({
    isActive: isActive && !isTerminated,
    onViolation: handleViolation,
    onActionBlocked: onActionBlocked
  });
  
  useFaceMonitor({
    video,
    isActive: isActive && !isTerminated,
    onViolation: handleViolation
  });
  
  return {
    strikes: strikeSystem.strikes,
    maxStrikes: strikeSystem.maxStrikes,
    violations: strikeSystem.violations,
    isTerminated: strikeSystem.isTerminated,
    notification: strikeSystem.notification,
    dismissNotification: strikeSystem.dismissNotification,
    reset: strikeSystem.reset,
    addStrike: strikeSystem.addStrike,
    interviewId,
    candidateId
  };
}

export default useInterviewProctoring;