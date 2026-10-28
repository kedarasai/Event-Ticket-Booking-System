import { useRef, useEffect, useCallback, useMemo } from 'react'
import { PosterArt } from '../events/PosterArt'
import { CalendarIcon, PinIcon, TicketIcon, RotateIcon } from '../ui/Icons'

/**
 * Generates a deterministic barcode-style pattern from the booking reference.
 * Pure function with varying line widths and spacing.
 * NOTE: Decorative only; not a real scannable barcode.
 */
function generateBarcodeLines(refStr = '') {
  const bars = []
  let seed = 0
  for (let i = 0; i < refStr.length; i++) {
    seed = (seed << 5) - seed + refStr.charCodeAt(i)
  }
  seed = Math.abs(seed)
  const pattern = [2, 3, 1, 4, 2, 4, 1, 3, 2, 1, 3, 4]
  let currentX = 16

  for (let i = 0; i < 32; i++) {
    const width = pattern[(seed + i * 5) % pattern.length]
    bars.push({ x: currentX, width })
    const gap = 2 + ((seed + i * 3) % 3)
    currentX += width + gap
  }

  return { bars, totalWidth: currentX + 16 }
}

/**
 * Ticket3D
 * Hardware-accelerated CSS 3D interactive ticket card with front/back flip,
 * perforated tear line, notched cutouts, PosterArt banner, decorative barcode,
 * gentle pointer tilt on desktop, and printable layout.
 */
export function Ticket3D({
  booking = {},
  isFlipped = false,
  onFlip = () => {},
  isCancelled = false
}) {
  const flipperRef = useRef(null)
  const wrapperRef = useRef(null)

  // Reduced motion preference
  const prefersReducedMotionRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotionRef.current = media.matches
    const listener = (e) => {
      prefersReducedMotionRef.current = e.matches
    }
    media.addEventListener?.('change', listener)
    return () => media.removeEventListener?.('change', listener)
  }, [])

  // Desktop Pointer Tilt: gentle rotation up to +-6deg
  const handlePointerMove = useCallback((e) => {
    // Disabled on touch and reduced motion
    if (e.pointerType === 'touch' || prefersReducedMotionRef.current || !flipperRef.current || !wrapperRef.current) {
      return
    }

    const rect = wrapperRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const dx = (e.clientX - centerX) / (rect.width / 2)
    const dy = (e.clientY - centerY) / (rect.height / 2)

    const tiltX = Math.max(-6, Math.min(6, -dy * 6))
    const tiltY = Math.max(-6, Math.min(6, dx * 6))

    flipperRef.current.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`)
    flipperRef.current.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`)
  }, [])

  const handlePointerLeave = useCallback(() => {
    if (!flipperRef.current) return
    flipperRef.current.style.setProperty('--tilt-x', '0deg')
    flipperRef.current.style.setProperty('--tilt-y', '0deg')
  }, [])

  // Barcode lines for decorative pattern on back face
  const barcode = useMemo(() => {
    return generateBarcodeLines(booking?.bookingReference || 'EVT-000000')
  }, [booking?.bookingReference])

  // Formatted date and time
  const formattedEventDate = booking?.event?.eventDate ? (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(booking.event.eventDate))
    } catch {
      return new Date(booking.event.eventDate).toLocaleDateString()
    }
  })() : ''

  // Formatted booking creation date
  const formattedBookingDate = booking?.createdAt ? (() => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(new Date(booking.createdAt))
    } catch {
      return new Date(booking.createdAt).toLocaleDateString()
    }
  })() : ''

  // Formatted total amount
  const formattedTotal = (() => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(Number(booking?.totalAmount) || 0)
    } catch {
      return `₹${booking?.totalAmount || 0}`
    }
  })()

  const seatNumbers = booking?.seatNumbers || []

  return (
    <div className="ticket-3d-container">
      {/* 3D Perspective Wrapper */}
      <div
        ref={wrapperRef}
        className={`ticket-3d-wrapper ${isFlipped ? 'is-flipped' : ''} ${isCancelled ? 'is-cancelled' : ''}`.trim()}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        aria-label={`Interactive 3D Ticket for ${booking?.event?.title || 'event'}. Press Enter or Space to flip.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onFlip()
          }
        }}
      >
        {/* Flipper Card (preserve-3d, 700ms transition) */}
        <div ref={flipperRef} className="ticket-3d-flipper">
          
          {/* ============================================================ */}
          {/* 1. FRONT FACE OF TICKET                                      */}
          {/* ============================================================ */}
          <div className="ticket-face ticket-face-front">
            {/* Top PosterArt Visual Strip */}
            <div className="ticket-front-art">
              <PosterArt
                title={booking?.event?.title || 'Event'}
                category={booking?.event?.category || 'Live Event'}
                height={120}
                className="ticket-poster-img"
              />
              <div className="ticket-art-overlay" />
              <div className="ticket-brand-chip">
                <span>TICKETFLOW ACCESS</span>
              </div>
            </div>

            {/* Event Details Section */}
            <div className="ticket-body">
              <div className="ticket-header-row">
                <span className="ticket-category-tag">
                  {booking?.event?.category || 'EVENT PASS'}
                </span>
                <span className={`ticket-status-pill ${isCancelled ? 'status-cancelled' : 'status-confirmed'}`}>
                  {isCancelled ? 'CANCELLED' : 'CONFIRMED'}
                </span>
              </div>

              <h2 className="ticket-event-title">
                {booking?.event?.title || 'Live Event Title'}
              </h2>

              <div className="ticket-meta-grid">
                <div className="ticket-meta-item">
                  <CalendarIcon size={15} color="var(--accent-cyan)" />
                  <span>{formattedEventDate || 'Date TBA'}</span>
                </div>
                <div className="ticket-meta-item">
                  <PinIcon size={15} color="var(--gold)" />
                  <span>{booking?.event?.venue || 'Venue TBA'}</span>
                </div>
              </div>

              {/* Perforated Divider & Notched Edge Cutouts */}
              <div className="ticket-perforated-row" aria-hidden="true">
                <span className="ticket-notch notch-left" />
                <span className="ticket-dash-line" />
                <span className="ticket-notch notch-right" />
              </div>

              {/* Lower Stub Section: Seats & Payment Info */}
              <div className="ticket-stub">
                <div className="ticket-stub-col">
                  <span className="ticket-stub-label">RESERVED SEATS</span>
                  <div className="ticket-seat-chips">
                    {Array.isArray(booking?.seats) && booking.seats.length > 0 ? (
                      booking.seats.map((s) => (
                        <span key={s.seatId || s.seatNumber} className={`ticket-seat-pill seat-chip-print ${s.tier ? `tier-${s.tier.toLowerCase()}` : ''}`}>
                          <TicketIcon size={12} color={s.tier === 'VIP' ? 'var(--gold)' : s.tier === 'PREMIUM' ? 'var(--accent-violet)' : 'var(--accent-cyan)'} />
                          <span className="ticket-seat-num">{s.seatNumber}</span>
                          {s.tier && <span className="ticket-seat-tier">{s.tier}</span>}
                          {s.price != null && <span className="ticket-seat-price">₹{Number(s.price).toLocaleString('en-IN')}</span>}
                        </span>
                      ))
                    ) : seatNumbers.length > 0 ? (
                      seatNumbers.map((seatNum) => (
                        <span key={seatNum} className="ticket-seat-pill seat-chip-print">
                          <TicketIcon size={12} color="var(--gold)" />
                          {seatNum}
                        </span>
                      ))
                    ) : (
                      <span className="ticket-seat-pill seat-chip-print">General Admission</span>
                    )}
                  </div>
                </div>

                <div className="ticket-stub-col stub-right">
                  <span className="ticket-stub-label">TOTAL AMOUNT</span>
                  <span className="ticket-price-total">{formattedTotal}</span>
                </div>
              </div>

              {/* Reference Footer */}
              <div className="ticket-footer-ref">
                <span className="ticket-ref-text">REF: {booking?.bookingReference}</span>
                <span className="ticket-tap-hint">Tap to flip ↻</span>
              </div>
            </div>

            {/* Cancelled Diagonal Stamp Overlay */}
            {isCancelled && (
              <div className="ticket-cancelled-watermark" aria-hidden="true">
                <span>CANCELLED</span>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* 2. BACK FACE OF TICKET                                       */}
          {/* ============================================================ */}
          <div className="ticket-face ticket-face-back">
            <div className="ticket-back-inner">
              <div className="ticket-back-header">
                <span className="ticket-back-brand">TICKETFLOW SECURITY PASS</span>
                <span className="ticket-back-num">#{booking?.bookingId}</span>
              </div>

              {/* Pure SVG Barcode-Style Pattern */}
              <div className="ticket-barcode-container" aria-hidden="true">
                <svg
                  className="ticket-barcode-svg"
                  viewBox={`0 0 ${barcode.totalWidth} 48`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {barcode.bars.map((bar, i) => (
                    <rect
                      key={i}
                      x={bar.x}
                      y="0"
                      width={bar.width}
                      height="48"
                      fill="currentColor"
                      rx="0.5"
                    />
                  ))}
                </svg>
                <div className="ticket-barcode-caption">
                  DECORATIVE IDENTIFIER • NON-SCANNABLE
                </div>
              </div>

              {/* Booking Issuance Metadata */}
              <div className="ticket-back-meta">
                <div className="ticket-back-meta-item">
                  <span className="back-meta-label">REFERENCE CODE</span>
                  <span className="back-meta-val font-mono">{booking?.bookingReference}</span>
                </div>
                {formattedBookingDate && (
                  <div className="ticket-back-meta-item">
                    <span className="back-meta-label">DATE ISSUED</span>
                    <span className="back-meta-val">{formattedBookingDate}</span>
                  </div>
                )}
              </div>

              {/* Short Terms & Conditions */}
              <div className="ticket-back-terms">
                <div className="ticket-terms-title">ADMISSION GUIDELINES & TERMS</div>
                <ul className="ticket-terms-list">
                  <li>Present this ticket confirmation at the entrance gates upon arrival.</li>
                  <li>Seats are non-transferable once scanned or checked in at the venue.</li>
                  <li>Event organizers reserve the right to verify government-issued photo ID.</li>
                  <li>No outside beverages, recording gear, or restricted items permitted inside.</li>
                </ul>
              </div>

              {/* Footer Return Hint */}
              <div className="ticket-back-footer">
                <span>Verified by TicketFlow Atomic MySQL Guarantee</span>
                <span className="ticket-tap-hint">Tap to flip ↻</span>
              </div>
            </div>

            {/* Cancelled Stamp on Back */}
            {isCancelled && (
              <div className="ticket-cancelled-watermark" aria-hidden="true">
                <span>VOID</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Accessible Flip Button */}
      <div className="ticket-flip-btn-wrap">
        <button
          type="button"
          className="ticket-flip-btn"
          onClick={onFlip}
          aria-label={isFlipped ? 'Flip ticket to front face' : 'Flip ticket to back face'}
          title="Flip Ticket"
        >
          <RotateIcon size={16} />
          <span>Flip ticket ({isFlipped ? 'Back' : 'Front'})</span>
        </button>
      </div>
    </div>
  )
}

export default Ticket3D
