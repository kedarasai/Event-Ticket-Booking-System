import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PosterArt } from './PosterArt'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { CalendarIcon, PinIcon, ArrowRightIcon } from '../ui/Icons'

export function EventCard({ event }) {
  const containerRef = useRef(null)
  const cardRef = useRef(null)

  // Tilt & Glare refs (Zero layout reads in rAF loop)
  const rectRef = useRef({ left: 0, top: 0, width: 1, height: 1 })
  const targetTilt = useRef({ x: 0, y: 0 })
  const currentTilt = useRef({ x: 0, y: 0 })
  const targetGlare = useRef({ x: '50%', y: '50%' })
  const rafId = useRef(null)
  const isLoopRunning = useRef(false)

  const isSoldOut = Number(event.availableSeats) === 0
  const totalSeats = Number(event.totalSeats) || 1
  const availableSeats = Number(event.availableSeats) || 0
  const isLowSeats = !isSoldOut && availableSeats / totalSeats < 0.20

  // Format date with Intl en-IN
  const formattedDate = (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(event.eventDate))
    } catch {
      return new Date(event.eventDate).toLocaleDateString()
    }
  })()

  // Format price with Intl en-IN INR
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

  const minPrice = Number(event.price) || 0
  const maxPrice = Number(event.priceMax) || minPrice
  const hasPriceRange = maxPrice > minPrice
  const formattedPrice = hasPriceRange
    ? `${formatMoney(minPrice)} – ${formatMoney(maxPrice)}`
    : formatMoney(minPrice)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    if (prefersReducedMotion || isTouch || isSoldOut) return

    const container = containerRef.current
    if (!container) return

    const updateRect = () => {
      if (containerRef.current) {
        rectRef.current = containerRef.current.getBoundingClientRect()
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect, { passive: true })

    const animateTilt = () => {
      currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * 0.12
      currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * 0.12

      if (cardRef.current) {
        cardRef.current.style.setProperty('--card-tilt-x', `${currentTilt.current.x.toFixed(2)}deg`)
        cardRef.current.style.setProperty('--card-tilt-y', `${currentTilt.current.y.toFixed(2)}deg`)
        cardRef.current.style.setProperty('--glare-x', targetGlare.current.x)
        cardRef.current.style.setProperty('--glare-y', targetGlare.current.y)
      }

      const dx = Math.abs(targetTilt.current.x - currentTilt.current.x)
      const dy = Math.abs(targetTilt.current.y - currentTilt.current.y)

      if (dx > 0.01 || dy > 0.01) {
        rafId.current = requestAnimationFrame(animateTilt)
      } else {
        isLoopRunning.current = false
      }
    }

    const handlePointerEnter = () => {
      updateRect()
      if (cardRef.current) {
        cardRef.current.style.setProperty('--glare-opacity', '1')
      }
    }

    const handlePointerMove = (e) => {
      const rect = rectRef.current
      if (!rect.width || !rect.height) return

      const relX = (e.clientX - rect.left) / rect.width
      const relY = (e.clientY - rect.top) / rect.height
      const normX = Math.max(-1, Math.min(1, (relX - 0.5) * 2))
      const normY = Math.max(-1, Math.min(1, (relY - 0.5) * 2))

      // Max 8deg tilt
      targetTilt.current.x = -normY * 8
      targetTilt.current.y = normX * 8
      targetGlare.current.x = `${(relX * 100).toFixed(1)}%`
      targetGlare.current.y = `${(relY * 100).toFixed(1)}%`

      if (!isLoopRunning.current) {
        isLoopRunning.current = true
        rafId.current = requestAnimationFrame(animateTilt)
      }
    }

    const handlePointerLeave = () => {
      targetTilt.current.x = 0
      targetTilt.current.y = 0
      if (cardRef.current) {
        cardRef.current.style.setProperty('--glare-opacity', '0')
      }
      if (!isLoopRunning.current) {
        isLoopRunning.current = true
        rafId.current = requestAnimationFrame(animateTilt)
      }
    }

    container.addEventListener('pointerenter', handlePointerEnter, { passive: true })
    container.addEventListener('pointermove', handlePointerMove, { passive: true })
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    return () => {
      window.removeEventListener('resize', updateRect)
      container.removeEventListener('pointerenter', handlePointerEnter)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isSoldOut])

  return (
    <div
      ref={containerRef}
      className={`event-card-perspective ${isSoldOut ? 'is-sold-out' : ''}`}
    >
      <Link
        to={isSoldOut ? '#' : `/events/${event.eventId}`}
        onClick={isSoldOut ? (e) => e.preventDefault() : undefined}
        aria-disabled={isSoldOut}
        className="event-card-link"
        tabIndex={isSoldOut ? -1 : 0}
        aria-label={`${event.title}, ${event.venue}, on ${formattedDate}. Price ${formattedPrice}. ${availableSeats} of ${totalSeats} seats remaining.`}
      >
        <div
          ref={cardRef}
          className="event-card"
        >
          {/* Moving glare highlight overlay */}
          <div className="event-card-glare" aria-hidden="true" />

          {/* Top Generative Poster Art */}
          <PosterArt title={event.title} category={event.category} height={180} />

          {/* Card Body */}
          <div className="event-card-body">
            {/* Badges Row */}
            <div className="event-card-badge-row">
              <Badge variant="accent">
                {event.category || 'Live Event'}
              </Badge>

              {event.layoutType && (
                <Badge variant="neutral" className="event-layout-badge">
                  {event.layoutType}
                </Badge>
              )}

              {isSoldOut ? (
                <Badge variant="danger">Sold out</Badge>
              ) : isLowSeats ? (
                <Badge variant="warn">Only {availableSeats} left!</Badge>
              ) : null}
            </div>

            {/* Title (2-line clamp) */}
            <h3 className="event-card-title">
              {event.title}
            </h3>

            {/* Date & Venue meta */}
            <div className="event-card-meta">
              <div className="event-card-meta-item">
                <CalendarIcon size={15} color="var(--accent-violet)" />
                <span>{formattedDate}</span>
              </div>
              <div className="event-card-meta-item">
                <PinIcon size={15} color="var(--accent-cyan)" />
                <span className="event-card-venue">{event.venue}</span>
              </div>
            </div>

            {/* Seats meter */}
            <div className="event-card-meter">
              <ProgressBar
                value={availableSeats}
                max={totalSeats}
                label={`${availableSeats} seats left`}
              />
            </div>

            {/* Price & Action Footer */}
            <div className="event-card-footer">
              <div className="event-card-price-block">
                <span className="event-card-price-label">From</span>
                <span className="event-card-price">{formattedPrice}</span>
              </div>

              <span className={`event-card-btn ${isSoldOut ? 'is-disabled' : ''}`}>
                <span>{isSoldOut ? 'Sold Out' : 'Select Seats'}</span>
                {!isSoldOut && <ArrowRightIcon size={16} />}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
