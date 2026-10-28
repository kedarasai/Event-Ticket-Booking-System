import { useState, useEffect, useRef } from 'react'

export function StatCounters({ events = [] }) {
  const containerRef = useRef(null)
  const hasAnimatedRef = useRef(false)

  // Real data calculations with graceful fallbacks
  const targetEvents = events.length > 0 ? events.length : 6
  const targetSeats = events.length > 0
    ? events.reduce((sum, e) => sum + (Number(e.totalSeats) || 0), 0)
    : 500
  const targetDoubleBookings = 0

  const [counts, setCounts] = useState({
    events: 0,
    seats: 0,
    doubleBookings: 0
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // IntersectionObserver to count up once when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true
          observer.disconnect()

          const startTime = performance.now()
          const duration = 1200 // 1.2s smooth count up

          const step = (now) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            // Ease-out quadratic
            const ease = progress * (2 - progress)

            setCounts({
              events: Math.round(ease * targetEvents),
              seats: Math.round(ease * targetSeats),
              doubleBookings: targetDoubleBookings
            })

            if (progress < 1) {
              requestAnimationFrame(step)
            } else {
              setCounts({
                events: targetEvents,
                seats: targetSeats,
                doubleBookings: targetDoubleBookings
              })
            }
          }

          requestAnimationFrame(step)
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [targetEvents, targetSeats, targetDoubleBookings])

  return (
    <div ref={containerRef} className="hero-stats-grid" aria-label="TicketFlow Platform Statistics">
      <div className="stat-counter-card">
        <span className="stat-number">
          {counts.events}
        </span>
        <span className="stat-label">live events</span>
      </div>

      <div className="stat-counter-card">
        <span className="stat-number">
          {counts.seats > 0 ? `${counts.seats}+` : '500+'}
        </span>
        <span className="stat-label">verified seats</span>
      </div>

      <div className="stat-counter-card">
        <span className="stat-number" style={{ color: 'var(--success)' }}>
          {counts.doubleBookings}
        </span>
        <span className="stat-label">double bookings</span>
      </div>
    </div>
  )
}
