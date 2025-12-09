// components/proctoring/ProctoringNotification.tsx
'use client'

import { useEffect } from 'react'
import type { StrikeNotification } from '@/hooks/useStrikeSystem'

interface ProctoringNotificationProps {
  notification: StrikeNotification | null
  onDismiss?: () => void
}

/**
 * ProctoringNotification
 *
 * - Renders a toast for warning/final severities
 * - Renders a blocking modal for terminal severity
 * - Uses `dismissible` and `autoDismissMs` behavior from the hook
 */
export default function ProctoringNotification({
  notification,
  onDismiss
}: ProctoringNotificationProps) {
  if (!notification) return null

  const { severity, title, body, dismissible } = notification
  const isTerminal = severity === 'terminal'

  // Allow Escape to dismiss only when dismissible and non-terminal
  useEffect(() => {
    if (!dismissible || !onDismiss) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dismissible, onDismiss])

  // Shared content
  const content = (
    <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 px-5 py-4">
      <div className="flex items-start gap-3">
        {/* Icon by severity */}
        <div className="mt-1 text-2xl">
          {severity === 'warning' && '⚠️'}
          {severity === 'final' && '⚠️'}
          {severity === 'terminal' && '❌'}
        </div>

        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-800 whitespace-pre-line">
            {body}
          </p>

          {isTerminal && (
            <p className="mt-3 text-xs text-gray-600">
              Your interview data has been saved. If you believe this is an
              error, please contact support or your recruiter.
            </p>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full
                       text-gray-500 hover:text-gray-800 hover:bg-gray-100
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )

  // Toast (non-blocking) for warning/final
  if (!isTerminal) {
    return (
      <div
        aria-live="polite"
        className="fixed inset-x-0 top-4 z-40 flex justify-center pointer-events-none"
      >
        <div className="pointer-events-auto">{content}</div>
      </div>
    )
  }

  // Modal (blocking) for terminal
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {content}
    </div>
  )
}
