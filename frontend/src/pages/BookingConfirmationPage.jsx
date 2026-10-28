import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getBooking } from '../services/api'
import { useToast } from '../components/ui/useToast'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Ticket3D } from '../components/booking/Ticket3D'
import {
  CopyIcon,
  PrinterIcon,
  TicketIcon,
  ShieldIcon
} from '../components/ui/Icons'

/**
 * Deterministic confetti particle definitions (max 36 pieces).
 * Pure and static to avoid impure calls during render.
 */
const CONFETTI_PIECES = Array.from({ length: 36 }, (_, i) => {
  const palette = ['#22d3ee', '#fbbf24', '#a78bfa', '#34d399', '#f43f5e', '#38bdf8']
  return {
    id: i,
    left: ((i * 17 + 23) % 94) + 3,
    color: palette[i % palette.length],
    size: 7 + (i % 6),
    delay: (i * 29) % 350,
    duration: 2000 + ((i * 73) % 1000),
    drift: ((i * 41) % 140) - 70,
    rotation: ((i * 67) % 480) - 240,
    shape: i % 3 === 0 ? 'circle' : 'rect'
  }
})

export default function BookingConfirmationPage() {

  const { id } = useParams()
  const location = useLocation()
  const { success: toastSuccess, error: toastError } = useToast()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isForbidden, setIsForbidden] = useState(false)
  const [error, setError] = useState(null)

  // 3D Flip state
  const [isFlipped, setIsFlipped] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)

  // Confetti celebration state (arriving from new booking flow only)
  const [showConfetti, setShowConfetti] = useState(() => {
    if (typeof window === 'undefined') return false
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return Boolean(location.state?.isNewBooking && !isReducedMotion)
  })

  useDocumentTitle(
    booking?.bookingReference
      ? `Booking ${booking.bookingReference} | TicketFlow`
      : 'Booking Confirmation | TicketFlow'
  )

  // Clear location.state so refresh does NOT re-trigger celebration
  useEffect(() => {
    if (location.state?.isNewBooking) {
      try {
        window.history.replaceState({}, document.title)
      } catch {
        // safe fallback
      }
    }

    if (showConfetti) {
      const timer = setTimeout(() => {
        setShowConfetti(false)
      }, 3400)
      return () => clearTimeout(timer)
    }
  }, [showConfetti, location.state])

  // Clear copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  // Load GET /bookings/:id with StrictMode abort support
  useEffect(() => {
    if (!id) return

    const controller = new AbortController()

    async function loadBooking() {
      try {
        setLoading(true)
        setError(null)
        setNotFound(false)
        setIsForbidden(false)

        const res = await getBooking(id, controller.signal)
        const bookingData = res?.booking || res

        if (!bookingData || !bookingData.bookingReference) {
          setNotFound(true)
        } else {
          setBooking(bookingData)
        }
      } catch (err) {
        if (err.name === 'AbortError') return

        if (err.status === 403 || err.message?.includes('403') || err.message?.toLowerCase().includes('forbidden')) {
          setIsForbidden(true)
        } else if (err.status === 404 || err.message?.includes('404') || err.message?.toLowerCase().includes('not found')) {
          setNotFound(true)
        } else {
          setError(err.message || 'Failed to retrieve booking receipt.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadBooking()

    return () => {
      controller.abort()
    }
  }, [id])

  // Copy reference handler
  async function handleCopyReference() {
    if (!booking?.bookingReference) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(booking.bookingReference)
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = booking.bookingReference
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopied(true)
      toastSuccess('Booking reference copied to clipboard!')

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopied(false)
      }, 2500)
    } catch {
      toastError('Failed to copy booking reference.')
    }
  }


  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-10) var(--space-4)' }}>
        <GlassCard style={{ maxWidth: '640px', margin: '0 auto', padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Skeleton width="64px" height={64} borderRadius="50%" />
            <Skeleton width="50%" height={32} />
            <Skeleton width="70%" height={20} />
            <Skeleton width="100%" height={380} borderRadius="var(--radius-lg)" style={{ marginTop: 12 }} />
            <Skeleton width="100%" height={48} borderRadius="var(--radius-sm)" style={{ marginTop: 16 }} />
          </div>
        </GlassCard>
      </div>
    )
  }

  // 2. 403 Forbidden State (Belongs to another user)
  if (isForbidden) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <EmptyState
          icon={<ShieldIcon size={56} color="var(--accent-violet)" />}
          title="Access Restricted"
          description="You do not have permission to view this booking. It belongs to another user account."
          action={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <Link to="/my-bookings" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="md">
                  View My Bookings
                </Button>
              </Link>
              <Link to="/" style={{ textDecoration: 'none' }}>
                <Button variant="ghost" size="md">
                  Browse Events
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  // 3. 404 Not Found State
  if (notFound) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <EmptyState
          icon={<TicketIcon size={56} color="var(--accent-cyan)" />}
          title="Booking Not Found"
          description={`We could not locate booking #${id}. Please check your reference code or explore your existing bookings.`}
          action={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <Link to="/my-bookings" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="md">
                  View My Bookings
                </Button>
              </Link>
              <Link to="/" style={{ textDecoration: 'none' }}>
                <Button variant="ghost" size="md">
                  Browse Events
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  // 4. Other Error State
  if (error || !booking) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <ErrorState
          title="Unable to Load Booking"
          message={error || 'An unexpected error occurred while fetching your booking.'}
          action={
            <>
              <Link to="/my-bookings" style={{ textDecoration: 'none' }}>
                <Button variant="primary">
                  Return to Bookings
                </Button>
              </Link>
              <Link to="/" style={{ textDecoration: 'none' }}>
                <Button variant="ghost">
                  Browse Events
                </Button>
              </Link>
            </>
          }
        />
      </div>
    )
  }

  const isCancelled = booking?.status === 'CANCELLED'

  return (
    <div className="booking-page-root container">
      {/* One-time Confetti Burst (DOM particles with CSS animation, max 36 pieces) */}
      {showConfetti && !isCancelled && (
        <div className="booking-confetti-container" aria-hidden="true">
          {CONFETTI_PIECES.map((p) => (
            <span
              key={p.id}
              className={`booking-confetti-particle particle-${p.shape}`}
              style={{
                '--p-left': `${p.left}%`,
                '--p-color': p.color,
                '--p-size': `${p.size}px`,
                '--p-delay': `${p.delay}ms`,
                '--p-dur': `${p.duration}ms`,
                '--p-drift': `${p.drift}px`,
                '--p-rot': `${p.rotation}deg`
              }}
            />
          ))}
        </div>
      )}

      {/* Main Glass Presentation Container */}
      <div className="booking-confirmation-content">
        
        {/* ============================================================ */}
        {/* Header Section: Success celebration OR Cancelled state        */}
        {/* ============================================================ */}
        {!isCancelled ? (
          <header className="booking-header booking-header-confirmed">
            {/* Self-drawing SVG checkmark via stroke-dashoffset */}
            <div className="booking-checkmark-wrap" aria-hidden="true">
              <svg className="booking-checkmark-svg" viewBox="0 0 64 64">
                <circle className="draw-circle" cx="32" cy="32" r="28" fill="none" />
                <path className="draw-check" fill="none" d="M19 33 l9 9 l17 -18" />
              </svg>
            </div>

            <h1 className="booking-title">You're booked!</h1>
            <p className="booking-subtitle">
              Your reservation is confirmed and guaranteed. Present your digital ticket at entry.
            </p>

            {/* Booking Reference with Copy button (toast on copy) */}
            <div className="booking-ref-banner">
              <span className="booking-ref-label">BOOKING REFERENCE</span>
              <div className="booking-ref-interactive">
                <span className="booking-ref-pill font-mono">{booking.bookingReference}</span>
                <button
                  type="button"
                  className="booking-ref-copy-btn"
                  onClick={handleCopyReference}
                  aria-label="Copy booking reference to clipboard"
                  title="Copy Reference"
                >
                  <CopyIcon size={15} />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </header>
        ) : (
          <header className="booking-header booking-header-cancelled">
            <div className="booking-cancelled-badge-wrap">
              <span className="booking-cancelled-indicator">CANCELLED</span>
            </div>
            <h1 className="booking-title title-cancelled">Booking Cancelled</h1>
            <p className="booking-subtitle">
              This reservation has been cancelled. The tickets associated with this booking are void.
            </p>
            <div className="booking-ref-banner">
              <span className="booking-ref-label">BOOKING REFERENCE</span>
              <div className="booking-ref-interactive">
                <span className="booking-ref-pill font-mono">{booking.bookingReference}</span>
                <button
                  type="button"
                  className="booking-ref-copy-btn"
                  onClick={handleCopyReference}
                  aria-label="Copy booking reference to clipboard"
                  title="Copy Reference"
                >
                  <CopyIcon size={15} />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* ============================================================ */}
        {/* The 3D Ticket Component                                      */}
        {/* ============================================================ */}
        <section className="booking-ticket-section" aria-label="Digital Ticket">
          <Ticket3D
            booking={booking}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped((prev) => !prev)}
            isCancelled={isCancelled}
          />
        </section>

        {/* ============================================================ */}
        {/* Actions Row                                                  */}
        {/* ============================================================ */}
        <nav className="booking-actions-row" aria-label="Booking Actions">
          <Button
            variant="outline"
            size="md"
            onClick={() => window.print()}
            className="booking-action-btn"
            title="Download or print a clean paper copy of your ticket"
          >
            <PrinterIcon size={16} />
            <span>Download / Print ticket</span>
          </Button>

          <Link to="/my-bookings" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="md" className="booking-action-btn">
              View my bookings
            </Button>
          </Link>

          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="md" className="booking-action-btn">
              Browse more events
            </Button>
          </Link>
        </nav>

      </div>
    </div>
  )
}
