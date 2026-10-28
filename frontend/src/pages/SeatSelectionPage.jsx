import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useToast } from '../components/ui/useToast'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getEvent, createBooking } from '../services/api'
import { getSeatLayout } from '../lib/seatLayout'
import { useSeatSelection } from '../hooks/useSeatSelection'
import { useSeatAvailability } from '../hooks/useSeatAvailability'
import { SeatGrid2D } from '../components/seats/SeatGrid2D'
import { SeatMap3D } from '../components/seats/SeatMap3D'
import { BookingSummary } from '../components/seats/BookingSummary'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import {
  TicketIcon,
  CalendarIcon,
  PinIcon,
  CheckIcon
} from '../components/ui/Icons'

/**
 * SeatSelectionPage (/events/:id/seats)
 * Protected page providing real-time 5s seat polling, conflict detection & pruning,
 * idempotency key generation, 600ms pulse animations, card shake on 409, and booking creation.
 */
export default function SeatSelectionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useAuth()
  const toast = useToast()

  // Validate ID upfront
  const isInvalidId = !Number.isInteger(Number(id)) || Number(id) <= 0

  const [event, setEvent] = useState(null)
  const [eventLoading, setEventLoading] = useState(!isInvalidId)
  const [notFound, setNotFound] = useState(false)
  const [eventError, setEventError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  // Track active fetch key to prevent stale responses across id/retry changes
  const currentKey = `${id}_${retryKey}`
  const [prevKey, setPrevKey] = useState(currentKey)
  if (prevKey !== currentKey) {
    setPrevKey(currentKey)
    if (!isInvalidId) {
      setEventLoading(true)
      setNotFound(false)
      setEventError(null)
    }
  }

  // Redirect to login if user is anonymous
  useEffect(() => {
    if (status === 'anonymous') {
      navigate('/login', {
        replace: true,
        state: { from: location }
      })
    }
  }, [status, navigate, location])

  // Fetch Event details
  useEffect(() => {
    if (isInvalidId || status === 'anonymous') return

    const controller = new AbortController()

    async function loadEvent() {
      try {
        setEventError(null)
        setNotFound(false)

        const res = await getEvent(id, controller.signal)
        const eventItem = res?.event || res

        if (!eventItem) {
          setNotFound(true)
        } else {
          setEvent(eventItem)
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        if (err.status === 404 || err.message?.includes('404')) {
          setNotFound(true)
        } else {
          setEventError(err.message || 'Failed to load event details.')
        }
      } finally {
        setEventLoading(false)
      }
    }

    loadEvent()

    return () => {
      controller.abort()
    }
  }, [id, isInvalidId, status, retryKey])

  // Keep a ref to prune/selection methods to break circular dependencies
  const pruneRef = useRef(null)
  const selectedSeatsRef = useRef([])

  // Callback passed to useSeatAvailability to handle live seat status updates
  const handleSeatsChanged = useCallback((incomingSeats, newlyBooked) => {
    if (!newlyBooked || newlyBooked.length === 0) return

    const currentSelected = selectedSeatsRef.current
    if (currentSelected.length === 0) return

    const newlyBookedMap = new Map(newlyBooked.map((s) => [s.seatId || s.id, s]))

    // Find if any currently selected seat was just taken
    for (const selectedSeat of currentSelected) {
      const seatId = selectedSeat.seatId || selectedSeat.id
      if (newlyBookedMap.has(seatId)) {
        const taken = newlyBookedMap.get(seatId)
        toast.warning(`Seat ${taken.seatNumber} was just taken`, 'Seat Taken')
      }
    }

    // Prune the unavailable seats from selection
    if (pruneRef.current) {
      const availableIds = new Set(
        incomingSeats
          .filter((s) => String(s.status || '').toLowerCase() === 'available')
          .map((s) => s.seatId || s.id)
      )
      pruneRef.current(availableIds)
    }
  }, [toast])

  // 1. StrictMode-safe 5s Seat Availability Polling Hook
  const {
    seats,
    price: polledPrice,
    loading: seatsLoading,
    error: seatsError,
    refetch: refetchSeats,
    pulsingSeatIds
  } = useSeatAvailability(id, {
    onSeatsChanged: handleSeatsChanged
  })

  // 2. Seat Selection State (Single Source of Truth)
  const {
    selectedIds,
    selectedSeats,
    count,
    total,
    toggle,
    clear,
    prune,
    maxSeats
  } = useSeatSelection({
    seats,
    price: event?.price || polledPrice || 0,
    maxSeats: 8,
    onLimit: () => {
      toast.error('Maximum 8 seats allowed per booking.', 'Seat Limit Reached')
    }
  })

  // Update mutable refs for polling callback
  useEffect(() => {
    pruneRef.current = prune
    selectedSeatsRef.current = selectedSeats
  }, [prune, selectedSeats])

  // Compute 2D/3D layout geometry
  const layout = useMemo(() => {
    return getSeatLayout(seats, event || {})
  }, [seats, event])

  // View mode: 3D or 2D (persisted in sessionStorage)
  // Default 3D at >= 768px, 2D below
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('tb_seat_view_mode')
      if (saved === '3d' || saved === '2d') return saved
      return window.innerWidth >= 768 ? '3d' : '2d'
    }
    return '3d'
  })

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tb_seat_view_mode', mode)
    }
  }, [])

  const viewOptions = useMemo(() => [
    { label: '3D View', value: '3d' },
    { label: '2D Map', value: '2d' }
  ], [])

  // Confirm flow state: submission lock, card shake, and idempotency key
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const idempotencyKeyRef = useRef(null)

  // Reset idempotency key whenever the selection changes
  const handleToggleSeat = useCallback((seat) => {
    idempotencyKeyRef.current = null
    toggle(seat)
  }, [toggle])

  const handleClearSeats = useCallback(() => {
    idempotencyKeyRef.current = null
    clear()
  }, [clear])

  /**
   * Confirm Flow:
   * 1. Refetch and prune first.
   * 2. Generate ONE crypto.randomUUID() per attempt (reused on retry of same attempt).
   * 3. Call createBooking with button disabled.
   * 4. On 409: toast "Some seats were just taken", refetch, drop unavailable, keep rest, shake card.
   * 5. On success: clear selection and navigate to /booking/:id.
   */
  const handleConfirm = async () => {
    if (isSubmitting || count === 0) return

    try {
      setIsSubmitting(true)

      // 1. Refetch and prune first before attempting booking
      const freshData = await refetchSeats()
      const freshSeats = freshData?.seats || seats || []

      const availableSeatIds = new Set(
        freshSeats
          .filter((s) => String(s.status || '').toLowerCase() === 'available')
          .map((s) => s.seatId || s.id)
      )

      const unavailableSeats = selectedSeats.filter(
        (s) => !availableSeatIds.has(s.seatId || s.id)
      )

      if (unavailableSeats.length > 0) {
        prune(availableSeatIds)
        toast.warning('Some seats were just taken', 'Seats Unavailable')
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 500)
        idempotencyKeyRef.current = null
        return
      }

      // 2. Generate or reuse idempotency key for this attempt
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID()
      }
      const idempotencyKey = idempotencyKeyRef.current

      // 3. Call createBooking
      const seatIdsToBook = selectedSeats.map((s) => s.seatId || s.id)
      const res = await createBooking(id, seatIdsToBook, idempotencyKey)

      // 4. Success (200 or 201)
      toast.success('Booking confirmed successfully!', 'Booking Confirmed')
      clear()
      idempotencyKeyRef.current = null

      const bookingId =
        res?.booking?.bookingId ||
        res?.bookingId ||
        res?.data?.booking?.bookingId ||
        res?.data?.bookingId

      navigate(`/booking/${bookingId}`, {
        state: { isNewBooking: true }
      })
    } catch (err) {
      if (err.status === 409) {
        // 409: toast "Some seats were just taken", refetch, drop unavailable, keep rest, shake card
        toast.warning('Some seats were just taken', 'Booking Conflict')
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 500)
        idempotencyKeyRef.current = null

        const freshData = await refetchSeats()
        const freshSeats = freshData?.seats || []
        const availableSeatIds = new Set(
          freshSeats
            .filter((s) => String(s.status || '').toLowerCase() === 'available')
            .map((s) => s.seatId || s.id)
        )
        prune(availableSeatIds)
      } else if (err.status === 0 || err.message?.includes('network') || err.message?.includes('reach')) {
        // Network error: preserve idempotencyKeyRef so retrying the exact attempt reuses the key
        toast.error(err.message || 'Network connection lost. Click Confirm to retry.', 'Connection Error')
      } else {
        // 400 / 404 / other error: clear toast with message and reset key
        toast.error(err.message || 'Unable to complete booking.', 'Booking Error')
        idempotencyKeyRef.current = null
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const is404 = isInvalidId || notFound
  const loading = eventLoading || seatsLoading

  // Document Title
  const pageTitle = is404
    ? 'Event Not Found | TicketFlow'
    : event
      ? `Select Seats: ${event.title} | TicketFlow`
      : 'Select Seats | TicketFlow'
  useDocumentTitle(pageTitle)

  // Formatted event date
  const formattedDate = event?.eventDate ? (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(event.eventDate))
    } catch {
      return new Date(event.eventDate).toLocaleDateString()
    }
  })() : ''

  // Loading skeleton
  if (loading || status === 'loading') {
    return (
      <div className="container" style={{ padding: 'var(--space-6) var(--space-4) var(--space-16)' }}>
        <Skeleton width={200} height={20} style={{ marginBottom: 16 }} />
        <Skeleton width="60%" height={36} style={{ marginBottom: 12 }} />
        <Skeleton width="40%" height={24} style={{ marginBottom: 32 }} />

        <div className="seat-selection-layout">
          <div>
            <Skeleton width="100%" height={42} style={{ marginBottom: 24, borderRadius: 'var(--radius-md)' }} />
            <Skeleton width="100%" height={440} borderRadius="var(--radius-lg)" />
          </div>
          <div>
            <GlassCard style={{ padding: 'var(--space-6)' }}>
              <Skeleton width="60%" height={28} style={{ marginBottom: 16 }} />
              <Skeleton width="100%" height={20} style={{ marginBottom: 24 }} />
              <Skeleton width="100%" height={80} style={{ marginBottom: 24 }} />
              <Skeleton width="100%" height={48} borderRadius="var(--radius-sm)" />
            </GlassCard>
          </div>
        </div>
      </div>
    )
  }

  // 404 Not Found state
  if (is404) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <EmptyState
          icon={<TicketIcon size={56} color="var(--accent-cyan)" />}
          title="Event or Seats Not Found"
          description={`We couldn't locate seating availability for event #${id}. The event may have expired or is unavailable.`}
          action={
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">
                Browse Upcoming Events
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  // Error state with retry
  if ((eventError || seatsError) && !event && seats.length === 0) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <ErrorState
          title="Unable to Load Seats"
          message={eventError || seatsError || 'An unexpected network error occurred while retrieving seat layout.'}
          retryLabel="Retry Loading Seats"
          onRetry={() => {
            setEventLoading(true)
            setEventError(null)
            setRetryKey((k) => k + 1)
            refetchSeats()
          }}
        />
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: 'var(--space-6) var(--space-4) var(--space-16)' }}>
      {/* Breadcrumb Navigation */}
      <nav className="event-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/" className="breadcrumb-link">
          Events
        </Link>
        <span className="breadcrumb-separator">/</span>
        <Link to={`/events/${id}`} className="breadcrumb-link">
          {event?.title || `Event #${id}`}
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Select Seats</span>
      </nav>

      {/* Header Info */}
      <header className="seat-selection-header">
        <h1 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: '#ffffff', marginBottom: 'var(--space-2)' }}>
          Choose Your Seats
        </h1>
        <div className="seat-selection-meta-bar">
          <Badge variant="accent">
            {event?.category || 'Live Event'}
          </Badge>

          {event?.layoutType && (
            <Badge variant="neutral">
              {event.layoutType}
            </Badge>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <CalendarIcon size={16} color="var(--accent-violet)" />
            <span>{formattedDate}</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <PinIcon size={16} color="var(--gold)" />
            <span>{event?.venue}</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--success)' }}>
            <CheckIcon size={16} color="var(--success)" />
            <span>Atomic MySQL Lock Guarantee</span>
          </div>
        </div>
      </header>

      {/* View Switcher Toolbar & Legend */}
      <div
        className="seat-selection-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)'
        }}
      >
        <SegmentedControl
          label="Seat Map View Mode"
          options={viewOptions}
          value={viewMode}
          onChange={handleViewModeChange}
        />

        {/* Global Legend */}
        <div className="seat-legend-bar" style={{ margin: 0, padding: '6px 14px' }}>
          {Array.isArray(event?.tiers) && event.tiers.length > 0 ? (
            event.tiers.map((t) => (
              <div key={t.tier} className="seat-legend-item">
                <span className={`seat-indicator seat-indicator-tier-${t.tier.toLowerCase()}`} />
                <span>{t.tier} (₹{Number(t.price).toLocaleString('en-IN')})</span>
              </div>
            ))
          ) : (
            <>
              <div className="seat-legend-item">
                <span className="seat-indicator seat-indicator-tier-vip" />
                <span>VIP</span>
              </div>
              <div className="seat-legend-item">
                <span className="seat-indicator seat-indicator-tier-premium" />
                <span>Premium</span>
              </div>
              <div className="seat-legend-item">
                <span className="seat-indicator seat-indicator-tier-standard" />
                <span>Standard</span>
              </div>
            </>
          )}
          <div className="seat-legend-item">
            <span className="seat-indicator seat-indicator-selected" />
            <span>Selected</span>
          </div>
          <div className="seat-legend-item">
            <span className="seat-indicator seat-indicator-booked" />
            <span>Booked</span>
          </div>
        </div>
      </div>

      {/* Two-Column Responsive Layout */}
      <div className="seat-selection-layout">
        {/* Left Column: 3D or 2D Interactive Seat Map */}
        <section aria-label="Interactive Seat Map" style={{ minWidth: 0, width: '100%' }}>
          {viewMode === '3d' ? (
            <SeatMap3D
              layout={layout}
              selectedIds={selectedIds}
              pulsingSeatIds={pulsingSeatIds}
              onToggle={handleToggleSeat}
              disabled={isSubmitting}
              price={event?.price || polledPrice}
            />
          ) : (
            <SeatGrid2D
              layout={layout}
              rows={layout.rows}
              selectedIds={selectedIds}
              pulsingSeatIds={pulsingSeatIds}
              onToggle={handleToggleSeat}
              price={event?.price || polledPrice}
            />
          )}
        </section>

        {/* Right Column: Sticky Summary & Mobile Bottom Sheet */}
        <BookingSummary
          event={event}
          selectedSeats={selectedSeats}
          total={total}
          count={count}
          maxSeats={maxSeats}
          isSubmitting={isSubmitting}
          isShaking={isShaking}
          onRemoveSeat={handleToggleSeat}
          onClear={handleClearSeats}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  )
}
