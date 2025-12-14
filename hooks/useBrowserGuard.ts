import { useEffect, useRef, useCallback } from 'react';

export type BrowserViolation = 'TAB_SWITCH';

export type BrowserAction = 
  | 'TAB_SWITCH_GRACE'
  | 'COPY_BLOCKED'
  | 'PASTE_BLOCKED'
  | 'CUT_BLOCKED';

interface UseBrowserGuardOptions {
  isActive: boolean;
  onViolation: (type: BrowserViolation, message: string) => void;
  onActionBlocked?: (action: BrowserAction, message: string) => void;
}

const CONFIG = {
  TAB_SWITCH_COOLDOWN_MS: 7500,
  TAB_SWITCH_GRACE_ENABLED: true,
  CLIPBOARD_BLOCKING_ENABLED: true
} as const;

const VIOLATION_MESSAGES = {
  TAB_SWITCH: 'Tab switching detected. Please stay in the interview window.'
} as const;

const ACTION_MESSAGES = {
  TAB_SWITCH_GRACE: '⚠️ Please stay on the interview tab',
  COPY_BLOCKED: '❌ Copying is not allowed during the interview',
  PASTE_BLOCKED: '❌ Pasting is not allowed during the interview',
  CUT_BLOCKED: '❌ Cutting is not allowed during the interview'
} as const;

export function useBrowserGuard(options: UseBrowserGuardOptions): void {
  const { isActive, onViolation, onActionBlocked } = options;
  
  const lastViolationTime = useRef<number>(0);
  const hasSeenTabWarning = useRef<boolean>(false);
  
  const triggerViolation = useCallback((
    type: BrowserViolation,
    message: string
  ) => {
    const now = Date.now();
    
    if (now - lastViolationTime.current < CONFIG.TAB_SWITCH_COOLDOWN_MS) {
      return;
    }
    
    lastViolationTime.current = now;
    onViolation(type, message);
  }, [onViolation]);
  
  const handleVisibilityChange = useCallback(() => {
    if (!document.hidden) return;
    
    if (CONFIG.TAB_SWITCH_GRACE_ENABLED && !hasSeenTabWarning.current) {
      hasSeenTabWarning.current = true;
      
      if (onActionBlocked) {
        onActionBlocked('TAB_SWITCH_GRACE', ACTION_MESSAGES.TAB_SWITCH_GRACE);
      }
      
    } else {
      triggerViolation('TAB_SWITCH', VIOLATION_MESSAGES.TAB_SWITCH);
    }
  }, [triggerViolation, onActionBlocked]);
  
  const handleClipboardEvent = useCallback((e: ClipboardEvent) => {
    if (!CONFIG.CLIPBOARD_BLOCKING_ENABLED) return;
    
    e.preventDefault();
    
    const actionType: BrowserAction = 
      e.type === 'copy' ? 'COPY_BLOCKED' :
      e.type === 'cut' ? 'CUT_BLOCKED' :
      'PASTE_BLOCKED';
    
    if (onActionBlocked) {
      onActionBlocked(actionType, ACTION_MESSAGES[actionType]);
    }
    
  }, [onActionBlocked]);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!CONFIG.CLIPBOARD_BLOCKING_ENABLED) return;
    
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    
    if (modifier && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      
      const actionType: BrowserAction = 
        e.key.toLowerCase() === 'c' ? 'COPY_BLOCKED' :
        e.key.toLowerCase() === 'x' ? 'CUT_BLOCKED' :
        'PASTE_BLOCKED';
      
      if (onActionBlocked) {
        onActionBlocked(actionType, ACTION_MESSAGES[actionType]);
      }
    }
  }, [onActionBlocked]);
  
  useEffect(() => {
    if (!isActive) {
      hasSeenTabWarning.current = false;
      lastViolationTime.current = 0;
      return;
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleClipboardEvent);
    document.addEventListener('paste', handleClipboardEvent);
    document.addEventListener('cut', handleClipboardEvent);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleClipboardEvent);
      document.removeEventListener('paste', handleClipboardEvent);
      document.removeEventListener('cut', handleClipboardEvent);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, handleVisibilityChange, handleClipboardEvent, handleKeyDown]);
}

export default useBrowserGuard;