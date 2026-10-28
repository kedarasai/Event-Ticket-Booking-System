import { useEffect, useState, useRef } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { XIcon, TicketIcon, ArrowRightIcon } from '../ui/Icons'

/**
 * Animated price counter displaying smoothly updated money values.
 */
function AnimatedPrice({ value }) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValue = useRef(value)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    prevValue.current = end

    if (start === end) {
      setDisplayValue(end)
      return
    }

    const duration = 250 // ms
    const startTime = performance.now()

    let frameId
    const step = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = Math.round(start + (end - start) * progress)
      setDisplayValue(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value])

  const formatted = (() => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(displayValue)
    } catch {
      return `₹${displayValue}`
    }
  })()

  return <span className="booking-summary-total-value">{formatted}</span>
}

/**
 * Sticky booking summary card / mobile bottom sheet displaying live selections,
 * removable seat chips, animated price total, and confirmation trigger.
 */
export function BookingSummary({
  event = null,
  selectedSeats = [],
  total = 0,
  count = 0,
  maxSeats = 8,
  isSubmitting = false,
  isShaking = false,
  onRemoveSeat = () => {},
  onClear = () => {},
  onConfirm = () => {}
}) {
  const formattedEventDate = event?.eventDate ? (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(event.eventDate))
    } catch {
      return new Date(event.eventDate).toLocaleDateString()
    }
  })() : ''

  return (
    <aside className="booking-summary-wrapper" aria-label="Booking Summary">
      <GlassCard className={`booking-summary-card gradient-border ${isShaking ? 'is-shaking' : ''}`.trim()}>
        {/* Header: Event Meta */}
        <div className="booking-summary-header">
          <div className="booking-summary-event-info">
            <h2 className="booking-summary-title">
              {event?.title || 'Selected Event'}
            </h2>
            <div className="booking-summary-meta">
              {formattedEventDate && <span>{formattedEventDate}</span>}
              {event?.venue && (
                <>
                  <span className="summary-meta-dot">•</span>
                  <span>{event.venue}</span>
                </>
              )}
            </div>
          </div>

          <div className="booking-summary-counter-badge">
            <Badge variant={count >= maxSeats ? 'warning' : count > 0 ? 'accent' : 'default'}>
              Selected {count} / {maxSeats}
            </Badge>
          </div>
        </div>

        {/* Selected Seats Chips */}
        <div className="booking-summary-seats-section">
          <div className="booking-summary-section-label">Selected Seats</div>
          {selectedSeats.length === 0 ? (
            <div className="booking-summary-empty-text">
              No seats selected. Choose up to {maxSeats} seats on the map.
            </div>
          ) : (
            <div className="booking-summary-chips" role="list" aria-label="Selected Seats">
              {selectedSeats.map((seat) => {
                const seatPrice = seat.price !== undefined && seat.price !== null ? seat.price : event?.price
                const tier = seat.tier
                return (
                  <div
                    key={seat.seatId || seat.id}
                    className={`seat-chip ${tier ? `seat-chip-${tier.toLowerCase()}` : ''}`}
                    role="listitem"
                  >
                    <TicketIcon size={14} color={tier === 'VIP' ? 'var(--gold)' : tier === 'PREMIUM' ? 'var(--accent-violet)' : 'var(--accent-cyan)'} />
                    <span className="seat-chip-number">{seat.seatNumber}</span>
                    {tier && (
                      <span className={`seat-chip-tier tier-${tier.toLowerCase()}`}>{tier}</span>
                    )}
                    {seatPrice != null && (
                      <span className="seat-chip-price">₹{Number(seatPrice).toLocaleString('en-IN')}</span>
                    )}
                    <button
                      type="button"
                      className="seat-chip-remove-btn"
                      disabled={isSubmitting}
                      aria-label={`Remove seat ${seat.seatNumber}${tier ? ` (${tier})` : ''}`}
                      onClick={() => onRemoveSeat(seat)}
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pricing Breakdown Row */}
        <div className="booking-summary-pricing-row">
          <div className="booking-summary-rate">
            <span className="summary-rate-label">{count > 1 ? `${count} Seats Selected` : count === 1 ? '1 Seat Selected' : 'Pricing'}</span>
            <span className="summary-rate-value">
              {count > 0 ? (
                selectedSeats.map((s) => `₹${Number(s.price !== undefined && s.price !== null ? s.price : event?.price).toLocaleString('en-IN')}`).join(' + ')
              ) : (
                'Tiered per seat'
              )}
            </span>
          </div>

          <div className="booking-summary-total">
            <span className="summary-total-label">Total Amount</span>
            <AnimatedPrice value={total} />
          </div>
        </div>

        {/* Action Controls */}
        <div className="booking-summary-actions">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={count === 0 || isSubmitting}
            onClick={onClear}
            className="booking-summary-clear-btn"
          >
            Clear
          </Button>

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={count === 0 || isSubmitting}
            loading={isSubmitting}
            onClick={onConfirm}
            icon={<ArrowRightIcon size={18} />}
            className="booking-summary-confirm-btn"
          >
            Confirm {count > 0 ? `(${count})` : ''}
          </Button>
        </div>
      </GlassCard>
    </aside>
  )
}

export default BookingSummary
