import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getMyBookings, cancelBooking } from '../services/api'
import { useToast } from '../components/ui/useToast'
import { GlassCard } from '../components/ui/GlassCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PosterArt } from '../components/events/PosterArt'
import {
  CalendarIcon,
  PinIcon,
  TicketIcon,
  CopyIcon,
  ArrowRightIcon
} from '../components/ui/Icons'

/**
 * Format event date in Indian locale with date and time
 */
function formatEventDate(dateStr) {
  if (!dateStr) return 'Date TBA'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date(dateStr))
  } catch {
    return new Date(dateStr).toLocaleDateString()
  }
}

/**
 * Format currency in INR
 */
function formatPrice(amount) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(amount) || 0)
  } catch {
    return `₹${amount || 0}`
  }
}

/**
 * MyBookingsPage (/my-bookings)
 * Personal bookings dashboard featuring summary metrics, segmented filter tabs,
 * rich glass cards with PosterArt generative thumbnails, copyable references,
 * cancellation modal with seat release confirmation, and full keyboard accessibility.
 */
export default function MyBookingsPage() {
  useDocumentTitle('My Bookings | TicketFlow')

  const toast = useToast()

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  // Cancel modal state
  const [bookingToCancel, setBookingToCancel] = useState(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Copy feedback state
  const [copiedRef, setCopiedRef] = useState(null)
  const copyTimerRef = useRef(null)

  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Fetch bookings with StrictMode abort controller
  useEffect(() => {
    const controller = new AbortController()
    let isCancelled = false

    getMyBookings(controller.signal)
      .then((res) => {
        if (isCancelled) return
        const list = res?.bookings || (Array.isArray(res) ? res : [])
        // Sort newest first by creation timestamp / ID
        const sorted = [...list].sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : a.bookingId
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : b.bookingId
          return timeB - timeA
        })
        setBookings(sorted)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (isCancelled || err.name === 'AbortError') return
        setError(err.message || 'Unable to load your bookings. Please try again.')
        setLoading(false)
      })

    return () => {
      isCancelled = true
      controller.abort()
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [refreshTrigger])

  const refetchBookings = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshTrigger((k) => k + 1)
  }, [])

  // Compute summary stats
  const stats = useMemo(() => {
    const now = new Date()
    let upcoming = 0
    let past = 0
    let cancelled = 0

    for (const b of bookings) {
      if (b.status === 'CANCELLED') {
        cancelled++
      } else if (b.event?.eventDate && new Date(b.event.eventDate) >= now) {
        upcoming++
      } else {
        past++
      }
    }

    return {
      total: bookings.length,
      upcoming,
      past,
      cancelled
    }
  }, [bookings])

  // Filter options for SegmentedControl
  const filterOptions = useMemo(() => [
    { value: 'all', label: `All (${stats.total})` },
    { value: 'upcoming', label: `Upcoming (${stats.upcoming})` },
    { value: 'past', label: `Past (${stats.past})` },
    { value: 'cancelled', label: `Cancelled (${stats.cancelled})` }
  ], [stats])

  // Filtered list based on active tab
  const filteredBookings = useMemo(() => {
    const now = new Date()
    return bookings.filter((b) => {
      if (activeFilter === 'all') return true
      if (activeFilter === 'cancelled') return b.status === 'CANCELLED'

      const isUpcoming = b.status === 'CONFIRMED' && b.event?.eventDate && new Date(b.event.eventDate) >= now
      if (activeFilter === 'upcoming') return isUpcoming

      const isPast = b.status === 'CONFIRMED' && (!b.event?.eventDate || new Date(b.event.eventDate) < now)
      if (activeFilter === 'past') return isPast

      return true
    })
  }, [bookings, activeFilter])

  // Copy reference code handler
  const handleCopy = (refStr) => {
    if (!refStr) return
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(refStr)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = refStr
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopiedRef(refStr)
      toast.success(`Copied ${refStr} to clipboard`, 'Copied')

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopiedRef(null)
      }, 2000)
    } catch {
      toast.error('Failed to copy reference code')
    }
  }

  // Open cancellation modal
  const handleOpenCancel = (booking) => {
    setBookingToCancel(booking)
    setCancelModalOpen(true)
  }

  // Confirm cancellation
  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return

    try {
      setIsCancelling(true)
      await cancelBooking(bookingToCancel.bookingId)

      toast.success(
        `Booking ${bookingToCancel.bookingReference} has been cancelled.`,
        'Booking Cancelled'
      )

      // Smooth in-place transition to CANCELLED without full page reload
      setBookings((prev) =>
        prev.map((b) =>
          b.bookingId === bookingToCancel.bookingId
            ? { ...b, status: 'CANCELLED' }
            : b
        )
      )

      setCancelModalOpen(false)
      setBookingToCancel(null)
    } catch (err) {
      if (err.status === 409) {
        toast.warning('This booking has already been cancelled.', 'Already Cancelled')
      } else if (err.status === 403) {
        toast.error('You do not have permission to cancel this booking.', 'Access Forbidden')
      } else if (err.status === 404) {
        toast.error('Booking not found.', 'Not Found')
      } else {
        toast.error(err.message || 'Failed to cancel booking.', 'Cancellation Failed')
      }

      // Refresh list on conflict / error as required by API contract
      refetchBookings()
      setCancelModalOpen(false)
      setBookingToCancel(null)
    } finally {
      setIsCancelling(false)
    }
  }

  // Empty state configuration based on active filter
  const emptyConfig = useMemo(() => {
    if (bookings.length === 0) {
      return {
        title: 'No bookings yet',
        description: "You haven't reserved any tickets yet. Explore upcoming concerts, comedy, theatre, and sports experiences!",
        action: (
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="md" icon={<ArrowRightIcon size={18} />}>
              Browse Events
            </Button>
          </Link>
        )
      }
    }

    switch (activeFilter) {
      case 'upcoming':
        return {
          title: 'No Upcoming Bookings',
          description: "You don't have any upcoming events scheduled. Ready to catch a live show?",
          action: (
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md" icon={<ArrowRightIcon size={18} />}>
                Browse Events
              </Button>
            </Link>
          )
        }
      case 'past':
        return {
          title: 'No Past Bookings',
          description: 'You have no completed or attended events on record.',
          action: (
            <Button variant="secondary" size="md" onClick={() => setActiveFilter('upcoming')}>
              View Upcoming Events
            </Button>
          )
        }
      case 'cancelled':
        return {
          title: 'No Cancelled Bookings',
          description: 'You do not have any cancelled reservations.',
          action: (
            <Button variant="ghost" size="md" onClick={() => setActiveFilter('all')}>
              View All Bookings
            </Button>
          )
        }
      default:
        return {
          title: 'No bookings match your filter',
          description: 'Try selecting a different filter tab above.',
          action: (
            <Button variant="ghost" size="md" onClick={() => setActiveFilter('all')}>
              Reset Filters
            </Button>
          )
        }
    }
  }, [bookings.length, activeFilter])

  return (
    <div className="my-bookings-page container">
      <div className="my-bookings-container">

        {/* ============================================================ */}
        {/* Header & Summary Statistics                                  */}
        {/* ============================================================ */}
        <header className="my-bookings-header">
          <div className="my-bookings-title-row">
            <div>
              <Badge variant="accent" style={{ marginBottom: 'var(--space-2)' }}>
                User Dashboard
              </Badge>
              <h1 className="my-bookings-heading">My Bookings</h1>
            </div>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm" icon={<TicketIcon size={16} />}>
                Browse Events
              </Button>
            </Link>
          </div>

          {/* Summary Row */}
          <div className="my-bookings-summary-row" aria-label="Bookings Summary">
            <div className="summary-stat-box">
              <span className="summary-stat-label">Total Bookings</span>
              <span className="summary-stat-value">{stats.total}</span>
            </div>
            <div className="summary-stat-box">
              <span className="summary-stat-label">Upcoming</span>
              <span className="summary-stat-value highlight-cyan">{stats.upcoming}</span>
            </div>
            <div className="summary-stat-box">
              <span className="summary-stat-label">Past Events</span>
              <span className="summary-stat-value">{stats.past}</span>
            </div>
            <div className="summary-stat-box">
              <span className="summary-stat-label">Cancelled</span>
              <span className="summary-stat-value highlight-muted">{stats.cancelled}</span>
            </div>
          </div>

          {/* Filter Tabs (SegmentedControl) */}
          <div className="my-bookings-filter-bar">
            <SegmentedControl
              label="Filter bookings by status"
              options={filterOptions}
              value={activeFilter}
              onChange={setActiveFilter}
            />
          </div>
        </header>

        {/* ============================================================ */}
        {/* Main Content: Loading, Error, Empty, or Bookings List        */}
        {/* ============================================================ */}
        {loading ? (
          <div className="my-bookings-list" aria-busy="true" aria-label="Loading bookings">
            {[1, 2, 3].map((n) => (
              <GlassCard key={n} className="my-booking-card" style={{ pointerEvents: 'none' }}>
                <Skeleton width="96px" height="96px" borderRadius="var(--radius-md)" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
                  <Skeleton width="50%" height={24} />
                  <Skeleton width="75%" height={16} />
                  <Skeleton width="35%" height={20} borderRadius="var(--radius-full)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                  <Skeleton width="100%" height={36} borderRadius="var(--radius-sm)" />
                </div>
              </GlassCard>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Bookings"
            message={error}
            retryLabel="Retry"
            onRetry={refetchBookings}
          />
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            title={emptyConfig.title}
            description={emptyConfig.description}
            action={emptyConfig.action}
          />
        ) : (
          <div className="my-bookings-list" role="feed" aria-label="My Bookings List">
            {filteredBookings.map((b, index) => {
              const now = new Date()
              const isCancelled = b.status === 'CANCELLED'
              const isPast = !isCancelled && b.event?.eventDate && new Date(b.event.eventDate) < now
              const isUpcoming = !isCancelled && b.event?.eventDate && new Date(b.event.eventDate) >= now

              return (
                <GlassCard
                  key={b.bookingId}
                  className={`my-booking-card ${isCancelled ? 'is-cancelled' : ''}`.trim()}
                  style={{ '--item-idx': index }}
                  data-booking-id={b.bookingId}
                  data-status={b.status}
                >
                  {/* PosterArt Generative Thumbnail */}
                  <div className="my-booking-thumb" aria-hidden="true">
                    <PosterArt
                      title={b.event?.title || 'Live Event'}
                      category={b.event?.category || 'Concert'}
                      height={96}
                    />
                  </div>

                  {/* Booking Information & Metadata */}
                  <div className="my-booking-info">
                    <div className="my-booking-top-row">
                      <h2 className="my-booking-title">
                        {b.event?.title || 'Live Event'}
                      </h2>

                      {/* Status Badge */}
                      {isCancelled ? (
                        <Badge variant="danger">Cancelled</Badge>
                      ) : isPast ? (
                        <Badge variant="neutral">Past Event</Badge>
                      ) : (
                        <Badge variant="success">Confirmed</Badge>
                      )}
                    </div>

                    {/* Date/Time and Venue */}
                    <div className="my-booking-meta">
                      <span className="my-booking-meta-item">
                        <CalendarIcon size={14} color="var(--accent-violet)" />
                        <span>{formatEventDate(b.event?.eventDate)}</span>
                      </span>
                      <span className="my-booking-meta-item">
                        <PinIcon size={14} color="var(--gold)" />
                        <span>{b.event?.venue || 'Venue TBA'}</span>
                      </span>
                    </div>

                    {/* Seat Chips */}
                    <div className="my-booking-seats-row">
                      {Array.isArray(b.seats) && b.seats.length > 0 ? (
                        b.seats.map((s) => (
                          <span key={s.seatId || s.seatNumber} className={`my-booking-seat-chip ${s.tier ? `tier-${s.tier.toLowerCase()}` : ''}`}>
                            <TicketIcon size={12} color={s.tier === 'VIP' ? 'var(--gold)' : s.tier === 'PREMIUM' ? 'var(--accent-violet)' : 'var(--accent-cyan)'} />
                            <span>{s.seatNumber}</span>
                            {s.tier && <span className="my-booking-seat-tier">{s.tier}</span>}
                          </span>
                        ))
                      ) : (
                        (b.seatNumbers || []).map((seatNum) => (
                          <span key={seatNum} className="my-booking-seat-chip">
                            <TicketIcon size={12} color="var(--gold)" />
                            {seatNum}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Reference and Total Price */}
                    <div className="my-booking-bottom-row">
                      <div className="my-booking-ref-wrap">
                        <span>REF:</span>
                        <span className="my-booking-ref-code">{b.bookingReference}</span>
                        <button
                          type="button"
                          className="my-booking-copy-btn"
                          onClick={() => handleCopy(b.bookingReference)}
                          aria-label={`Copy booking reference ${b.bookingReference}`}
                          title="Copy reference code"
                        >
                          <CopyIcon size={14} />
                          <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>
                            {copiedRef === b.bookingReference ? 'Copied!' : 'Copy'}
                          </span>
                        </button>
                      </div>

                      <div className="my-booking-price-total">
                        {formatPrice(b.totalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="my-booking-actions">
                    <Link to={`/booking/${b.bookingId}`}>
                      <Button variant="secondary" size="sm" className="my-booking-view-btn">
                        View ticket
                      </Button>
                    </Link>

                    {/* Danger Cancel button ONLY on CONFIRMED upcoming bookings */}
                    {isUpcoming && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="my-booking-cancel-btn btn-danger-outline"
                        onClick={() => handleOpenCancel(b)}
                        aria-label={`Cancel booking ${b.bookingReference}`}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* Cancellation Confirmation Modal                              */}
      {/* ============================================================ */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => !isCancelling && setCancelModalOpen(false)}
        title="Cancel Booking"
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={isCancelling}
              onClick={() => setCancelModalOpen(false)}
            >
              Keep Booking
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={isCancelling}
              onClick={handleConfirmCancel}
              className="confirm-cancel-btn"
            >
              Release Seats & Cancel
            </Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
          Cancel booking <strong style={{ color: '#ffffff' }}>{bookingToCancel?.bookingReference}</strong>? Your seats will be released and this can't be undone.
        </p>
      </Modal>

    </div>
  )
}
