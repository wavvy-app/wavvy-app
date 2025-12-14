import { useState, useCallback, useRef, useEffect } from 'react';

export type ViolationType = 
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'LOOKING_AWAY'
  | 'CAMERA_OFF'
  | 'TAB_SWITCH';

export interface Violation {
  type: ViolationType;
  timestamp: number;
  message: string;
}

export type StrikeSeverity = 'warning' | 'final' | 'terminal';

export interface StrikeNotification {
  severity: StrikeSeverity;
  title: string;
  body: string;
  dismissible: boolean;
  autoDismissMs: number | null;
}

interface UseStrikeSystemOptions {
  maxStrikes?: number;
  onTerminated?: () => void;
}

interface UseStrikeSystemReturn {
  strikes: number;
  maxStrikes: number;
  violations: Violation[];
  notification: StrikeNotification | null;
  isTerminated: boolean;
  addStrike: (violation: Violation) => void;
  dismissNotification: () => void;
  reset: () => void;
}

const NOTIFICATION_CONFIG = {
  TERMINATION_DELAY_MS: 3000
} as const;

const VIOLATION_TITLES: Record<ViolationType, string> = {
  TAB_SWITCH: 'Please stay in this window',
  NO_FACE: 'Please ensure you\'re visible',
  MULTIPLE_FACES: 'Multiple people detected',
  LOOKING_AWAY: 'Please stay focused on the screen',
  CAMERA_OFF: 'Camera connection issue'
};

function buildNotification(
  violation: Violation,
  currentStrikes: number,
  maxStrikes: number
): StrikeNotification {
  const isTerminal = currentStrikes >= maxStrikes;
  const isFinalWarning = currentStrikes === maxStrikes - 1;
  
  let severity: StrikeSeverity;
  if (isTerminal) {
    severity = 'terminal';
  } else if (isFinalWarning) {
    severity = 'final';
  } else {
    severity = 'warning';
  }
  
  const title = VIOLATION_TITLES[violation.type];
  
  let body: string;
  if (isTerminal) {
    body = `Your interview session has ended.\n\n${violation.message}`;
  } else if (isFinalWarning) {
    body = `FINAL WARNING: ${violation.message}\n\nOne more violation will terminate your interview.`;
  } else {
    const remaining = maxStrikes - currentStrikes;
    body = `${violation.message}\n\n${remaining} ${remaining === 1 ? 'warning' : 'warnings'} remaining.`;
  }
  
  const dismissible = !isTerminal;
  const autoDismissMs = null;
  
  return {
    severity,
    title,
    body,
    dismissible,
    autoDismissMs
  };
}

export function useStrikeSystem(
  options: UseStrikeSystemOptions = {}
): UseStrikeSystemReturn {
  
  const { maxStrikes = 3, onTerminated } = options;
  
  const [strikes, setStrikes] = useState(0);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [notification, setNotification] = useState<StrikeNotification | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);
  
  const terminationRef = useRef<NodeJS.Timeout | null>(null);
  
  const addStrike = useCallback((violation: Violation) => {
    if (isTerminated) return;
    
    setViolations(prev => [...prev, violation]);
    
    setStrikes(prevStrikes => {
      const newStrikes = prevStrikes + 1;
      const isTerminal = newStrikes >= maxStrikes;
      
      const notif = buildNotification(violation, newStrikes, maxStrikes);
      setNotification(notif);
      
      if (isTerminal) {
        setIsTerminated(true);
        
        if (terminationRef.current) {
          clearTimeout(terminationRef.current);
          terminationRef.current = null;
        }
        
        if (onTerminated) {
          terminationRef.current = setTimeout(() => {
            onTerminated();
            terminationRef.current = null;
          }, NOTIFICATION_CONFIG.TERMINATION_DELAY_MS);
        }
      }
      
      return newStrikes;
    });
  }, [isTerminated, maxStrikes, onTerminated]);
  
  const dismissNotification = useCallback(() => {
    if (notification?.dismissible) {
      setNotification(null);
    }
  }, [notification]);
  
  const reset = useCallback(() => {
    if (terminationRef.current) {
      clearTimeout(terminationRef.current);
      terminationRef.current = null;
    }
    
    setStrikes(0);
    setViolations([]);
    setNotification(null);
    setIsTerminated(false);
  }, []);
  
  useEffect(() => {
    return () => {
      if (terminationRef.current) {
        clearTimeout(terminationRef.current);
      }
    };
  }, []);
  
  return {
    strikes,
    maxStrikes,
    violations,
    notification,
    isTerminated,
    addStrike,
    dismissNotification,
    reset
  };
}

export default useStrikeSystem;