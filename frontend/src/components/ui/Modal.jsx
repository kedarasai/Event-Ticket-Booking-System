import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from './Icons'

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer = null,
  maxWidth = '540px',
  closeOnBackdrop = true,
  closeOnEsc = true
}) {
  const modalRef = useRef(null)
  const previousActiveElementRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Store element that had focus before opening
    previousActiveElementRef.current = document.activeElement

    // Scroll lock on body
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the modal container or the first focusable element inside it
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length > 0) {
          focusables[0].focus()
        } else {
          modalRef.current.focus()
        }
      }
    }, 50)

    // Keyboard handlers (ESC & Focus Trap)
    const handleKeyDown = (event) => {
      if (closeOnEsc && event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )

        if (focusables.length === 0) {
          event.preventDefault()
          return
        }

        const firstElement = focusables[0]
        const lastElement = focusables[focusables.length - 1]

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow

      // Restore focus to original element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus()
      }
    }
  }, [isOpen, onClose, closeOnEsc])

  if (!isOpen) return null

  const modalRoot = document.getElementById('modal-root') || document.body

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose?.()
    }
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="presentation"
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-dialog-title' : undefined}
        tabIndex="-1"
        className="modal-content"
        style={{ maxWidth }}
      >
        <div className="modal-header">
          {title && (
            <h2 id="modal-dialog-title" className="modal-title">
              {title}
            </h2>
          )}
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    modalRoot
  )
}
