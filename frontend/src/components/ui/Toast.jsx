import { useState, useRef, useEffect, useCallback } from 'react'
import { CheckIcon, AlertIcon, XIcon } from './Icons'
import { ToastContext } from './ToastContext'

let toastCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(({ type = 'info', title = '', message = '', duration = 4500 }) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, type, title, message, duration }])
    return id
  }, [])

  const success = useCallback((message, title = 'Success') => {
    return addToast({ type: 'success', title, message })
  }, [addToast])

  const error = useCallback((message, title = 'Error') => {
    return addToast({ type: 'error', title, message })
  }, [addToast])

  const warning = useCallback((message, title = 'Warning') => {
    return addToast({ type: 'warning', title, message })
  }, [addToast])

  const info = useCallback((message, title = 'Notice') => {
    return addToast({ type: 'info', title, message })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      <div
        className="toast-container"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }) {
  const [isPaused, setIsPaused] = useState(false)
  const remainingTimeRef = useRef(toast.duration)
  const startTimeRef = useRef(0)
  const timerRef = useRef(null)

  const startTimer = useCallback(() => {
    if (remainingTimeRef.current <= 0) {
      onRemove(toast.id)
      return
    }

    startTimeRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      onRemove(toast.id)
    }, remainingTimeRef.current)
  }, [toast.id, onRemove])

  useEffect(() => {
    if (!isPaused) {
      startTimer()
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPaused, startTimer])

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const elapsed = Date.now() - startTimeRef.current
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed)
    setIsPaused(true)
  }

  const handleMouseLeave = () => {
    setIsPaused(false)
  }

  const icon = {
    success: <CheckIcon size={18} color="var(--success)" />,
    error: <AlertIcon size={18} color="var(--danger)" />,
    warning: <AlertIcon size={18} color="var(--gold)" />,
    info: <AlertIcon size={18} color="var(--accent-cyan)" />
  }[toast.type] || <AlertIcon size={18} color="var(--accent-cyan)" />

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="status"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 2 }}>
        {icon}
      </div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        {toast.message && <div className="toast-message">{toast.message}</div>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
