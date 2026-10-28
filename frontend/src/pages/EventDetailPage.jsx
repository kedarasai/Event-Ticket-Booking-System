import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { getEvent } from '../services/api'
import { useAuth } from '../context/useAuth'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PosterArt } from '../components/events/PosterArt'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import {
  CalendarIcon,
  ClockIcon,
  PinIcon,
  TicketIcon,
  AlertIcon,
  CheckIcon,
  ArrowRightIcon,
  SparklesIcon
} from '../components/ui/Icons'

const VENUE_LAYOUT_LABELS = {
  ARENA: 'Arena (Main Stage & Multi-Tier)',
  AUDITORIUM: 'Auditorium (Fan-Shaped Curved Rows)',
  CLUB: 'Comedy Club (Tables & Bar Seating)',
  THEATRE: 'Classic Theatre (Stalls, Circle & Royal Boxes)',
  STADIUM: 'Stadium (Ring Seating around Pitch)',
  FESTIVAL: 'Open-Air Festival (Tiered Zones & VIP Deck)'
}

export default function EventDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { status } = useAuth()

  const isInvalidId = !Number.isInteger(Number(id)) || Number(id) <= 0
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(!isInvalidId)
  const [notFound, setNotFound] = useState(isInvalidId)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [parallaxOffset, setParallaxOffset] = useState(0)

  // React pattern: Adjust state during render when id or retryKey changes
  const currentKey = `${id}_${retryKey}`
  const [prevKey, setPrevKey] = useState(currentKey)
  if (prevKey !== currentKey) {
    setPrevKey(currentKey)
    setEvent(null)
    setLoading(!isInvalidId)
    setNotFound(isInvalidId)
    setError(null)
  }

  // Document Title
  const is404 = isInvalidId || notFound
  const documentTitle = event
    ? `${event.title} | TicketFlow`
    : is404
    ? 'Event Not Found | TicketFlow'
    : error
    ? 'Error Loading Event | TicketFlow'
    : 'Event Details | TicketFlow'
  useDocumentTitle(documentTitle)

  // Fetch event details
  useEffect(() => {
    if (isInvalidId) return

    const controller = new AbortController()

    getEvent(Number(id), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setEvent(data.event)
          setNotFound(false)
          setError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          if (
            err.status === 404 ||
            err.status === 400 ||
            err.message?.toLowerCase().includes('not found') ||
            err.message?.toLowerCase().includes('positive integer')
          ) {
            setNotFound(true)
          } else {
            setError(err.message || 'Failed to load event details.')
          }
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [id, isInvalidId, retryKey])

  // Subtle scroll parallax on poster artwork (transform: translateY only, disabled on reduced motion)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setParallaxOffset(Math.min(window.scrollY * 0.22, 70))
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Sold out simulation support via query param ?simulateSoldOut=true (for gate verification)
  const isSimulatedSoldOut =
    searchParams.get('simulateSoldOut') === 'true' ||
    searchParams.get('soldOut') === 'true'

  const effectiveAvailableSeats = isSimulatedSoldOut
    ? 0
    : Number(event?.availableSeats) || 0
  const isSoldOut = event ? effectiveAvailableSeats === 0 : false
  const totalSeats = Number(event?.totalSeats) || 1
  const isLowSeats = !isSoldOut && effectiveAvailableSeats / totalSeats < 0.20

  // Formatted date & time
  const formattedFullDate = event ? (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(new Date(event.eventDate))
    } catch {
      return new Date(event.eventDate).toLocaleDateString()
    }
  })() : ''

  const formattedTime = event ? (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(event.eventDate))
    } catch {
      return new Date(event.eventDate).toLocaleTimeString()
    }
  })() : ''

  // Formatted price
  const formatMoney = (amount) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(Number(amount) || 0)
    } catch {
      return `₹${Math.round(Number(amount) || 0)}`
    }
  }

  const minPrice = Number(event?.price) || 0
  const maxPrice = Number(event?.priceMax) || minPrice
  const hasPriceRange = maxPrice > minPrice
  const formattedPrice = event
    ? hasPriceRange
      ? `${formatMoney(minPrice)} – ${formatMoney(maxPrice)}`
      : formatMoney(minPrice)
    : ''

  // Primary CTA: Select seats
  const handleSelectSeats = () => {
    if (status === 'authenticated') {
      navigate(`/events/${id}/seats`)
    } else {
      // Logged-out user sent to /login and returns to /events/:id/seats afterwards
      navigate('/login', {
        state: { from: { pathname: `/events/${id}/seats` } }
      })
    }
  }

  // 1. Loading Skeleton State (Zero Layout Shift)
  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-6) var(--space-4) var(--space-16)' }}>
        {/* Banner Skeleton */}
        <div className="event-banner" style={{ background: 'var(--surface-1)' }}>
          <Skeleton width="100%" height={380} borderRadius="var(--radius-lg)" />
        </div>

        {/* Two-Column Skeleton */}
        <div className="event-details-layout">
          <div className="event-main-content">
            <Skeleton width={180} height={28} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={20} style={{ marginBottom: 10 }} />
            <Skeleton width="95%" height={20} style={{ marginBottom: 10 }} />
            <Skeleton width="80%" height={20} style={{ marginBottom: 32 }} />

            <Skeleton width={160} height={26} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={160} borderRadius="var(--radius-md)" />
          </div>

          <div className="event-sticky-card-wrapper">
            <GlassCard style={{ padding: 'var(--space-8)' }}>
              <Skeleton width="40%" height={36} style={{ marginBottom: 20 }} />
              <Skeleton width="100%" height={16} style={{ marginBottom: 24 }} />
              <Skeleton width="100%" height={52} borderRadius="var(--radius-sm)" style={{ marginBottom: 24 }} />
              <Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
              <Skeleton width="60%" height={16} />
            </GlassCard>
          </div>
        </div>
      </div>
    )
  }

  // 2. 404 Not Found State
  if (is404) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <EmptyState
          icon={<TicketIcon size={56} color="var(--accent-cyan)" />}
          title="Event Not Found"
          description={`We couldn't find an event with ID #${id}. The event may have ended, been rescheduled, or does not exist.`}
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

  // 3. Error State with Retry
  if (error || !event) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <ErrorState
          title="Unable to Load Event"
          message={error || 'An unexpected network error occurred while retrieving event details.'}
          onRetry={() => {
            setLoading(true)
            setError(null)
            setRetryKey((k) => k + 1)
          }}
        />
      </div>
    )
  }

  // 4. Main Event Details View
  return (
    <div className="container" style={{ padding: 'var(--space-6) var(--space-4) var(--space-16)' }}>
      {/* Top Banner with Generative PosterArt & Scroll Parallax */}
      <section className="event-banner" aria-label="Event Banner">
        <div
          className="event-banner-art"
          style={{
            transform: `translateY(${parallaxOffset}px)`
          }}
        >
          <PosterArt
            title={event.title}
            category={event.category}
            height={460}
          />
        </div>

        {/* Gradient Overlay with Content */}
        <div className="event-banner-overlay">
          {/* Breadcrumb Navigation */}
          <nav className="event-breadcrumb" aria-label="Breadcrumb">
            <Link to="/" className="breadcrumb-link">
              Events
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{event.title}</span>
          </nav>

          {/* Category & Layout Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge variant="accent">
              {event.category || 'Live Event'}
            </Badge>
            {event.layoutType && (
              <Badge variant="neutral">
                {event.layoutType}
              </Badge>
            )}
          </div>

          {/* Event Title */}
          <h1 className="event-detail-title">
            {event.title}
          </h1>

          {/* Meta Chips Row (Date, Time, Venue) */}
          <div className="event-meta-chips">
            <div className="event-meta-chip">
              <CalendarIcon size={16} color="var(--accent-violet)" />
              <span>{formattedFullDate}</span>
            </div>

            <div className="event-meta-chip">
              <ClockIcon size={16} color="var(--accent-cyan)" />
              <span>{formattedTime}</span>
            </div>

            <div className="event-meta-chip">
              <PinIcon size={16} color="var(--gold)" />
              <span>{event.venue}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Layout */}
      <div className="event-details-layout">
        {/* LEFT COLUMN: About & Details */}
        <div className="event-main-content">
          {/* About this event */}
          <section aria-label="About this event">
            <h2 className="event-section-title">About this event</h2>
            <p className="event-description">
              {event.description}
            </p>
          </section>

          {/* Event details list */}
          <section aria-label="Event details">
            <h2 className="event-section-title">Event Details</h2>
            <div className="event-details-list">
              <div className="event-detail-row">
                <span className="event-detail-label">
                  <CalendarIcon size={18} color="var(--accent-violet)" />
                  <span>Date</span>
                </span>
                <span className="event-detail-value">{formattedFullDate}</span>
              </div>

              <div className="event-detail-row">
                <span className="event-detail-label">
                  <ClockIcon size={18} color="var(--accent-cyan)" />
                  <span>Doors Open</span>
                </span>
                <span className="event-detail-value">{formattedTime} (Assumed as event time)</span>
              </div>

              <div className="event-detail-row">
                <span className="event-detail-label">
                  <PinIcon size={18} color="var(--gold)" />
                  <span>Venue</span>
                </span>
                <span className="event-detail-value">{event.venue}</span>
              </div>

              {event.layoutType && (
                <div className="event-detail-row">
                  <span className="event-detail-label">
                    <SparklesIcon size={18} color="var(--accent-cyan)" />
                    <span>Venue Layout</span>
                  </span>
                  <span className="event-detail-value">
                    {VENUE_LAYOUT_LABELS[event.layoutType] || event.layoutType}
                  </span>
                </div>
              )}

              <div className="event-detail-row">
                <span className="event-detail-label">
                  <SparklesIcon size={18} color="var(--accent-cyan)" />
                  <span>Seat Map</span>
                </span>
                <span className="event-detail-value">Interactive 3D Seating (Pure CSS 3D)</span>
              </div>

              <div className="event-detail-row">
                <span className="event-detail-label">
                  <CheckIcon size={18} color="var(--success)" />
                  <span>Concurrency Guarantee</span>
                </span>
                <span className="event-detail-value" style={{ color: 'var(--success)' }}>
                  Atomic MySQL Row Locks
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Sticky Booking Card */}
        <aside className="event-sticky-card-wrapper" aria-label="Booking Summary">
          <GlassCard className="gradient-border event-booking-card">
            {/* Price Row */}
            <div className="booking-price-row">
              {hasPriceRange && <span className="booking-price-from-label">From</span>}
              <span className="booking-price-value">{hasPriceRange ? formatMoney(minPrice) : formattedPrice}</span>
              <span className="booking-price-sub">{hasPriceRange ? `to ${formatMoney(maxPrice)}` : '/ seat'}</span>
            </div>

            {/* Available Tiers List */}
            {Array.isArray(event.tiers) && event.tiers.length > 0 && (
              <div className="booking-tiers-list">
                <span className="booking-tiers-title">Tiers & Pricing</span>
                <div className="booking-tier-pills">
                  {event.tiers.map((t) => (
                    <div key={t.tier} className={`tier-info-row tier-${t.tier.toLowerCase()}`}>
                      <div className="tier-info-left">
                        <span className={`tier-badge-indicator tier-${t.tier.toLowerCase()}`} />
                        <span className="tier-name">{t.tier}</span>
                      </div>
                      <div className="tier-info-right">
                        <span className="tier-price">{formatMoney(t.price)}</span>
                        <span className="tier-seats-count">({t.availableSeats} left)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Availability Meter with Animated Fill */}
            <div className="booking-availability-meter">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Seat Availability</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                  {effectiveAvailableSeats} of {totalSeats} seats left
                </span>
              </div>
              <ProgressBar
                value={effectiveAvailableSeats}
                max={totalSeats}
              />
            </div>

            {/* Urgency Note when under 20% */}
            {isLowSeats && (
              <div className="booking-urgency-note">
                <AlertIcon size={16} />
                <span>High demand: Only {effectiveAvailableSeats} seats remaining!</span>
              </div>
            )}

            {/* Sold Out Note */}
            {isSoldOut && (
              <div className="booking-soldout-note">
                <AlertIcon size={16} />
                <span>All tickets for this event are currently sold out.</span>
              </div>
            )}

            {/* Primary CTA: Select seats */}
            <Button
              variant="primary"
              size="lg"
              disabled={isSoldOut}
              onClick={handleSelectSeats}
              icon={!isSoldOut ? <ArrowRightIcon size={20} /> : null}
              style={{ width: '100%' }}
            >
              {isSoldOut ? 'Sold out' : 'Select seats'}
            </Button>

            {/* Reassurance Perks */}
            <div className="booking-perks-list">
              <div className="booking-perk-item">
                <CheckIcon size={16} color="var(--success)" />
                <span>Zero double-booking guarantee via MySQL locks</span>
              </div>
              <div className="booking-perk-item">
                <CheckIcon size={16} color="var(--accent-cyan)" />
                <span>Real-time CSS 3D interactive seat picker</span>
              </div>
              <div className="booking-perk-item">
                <CheckIcon size={16} color="var(--gold)" />
                <span>Reserve up to 8 verified seats per order</span>
              </div>
            </div>
          </GlassCard>
        </aside>
      </div>
    </div>
  )
}
