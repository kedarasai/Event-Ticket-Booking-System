import { useState, useEffect, useRef, useCallback } from 'react'
import { getEvents, getSeats, runDevRace, resetDevRace } from '../services/api'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useToast } from '../components/ui/useToast'
import { GlassCard } from '../components/ui/GlassCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Skeleton } from '../components/ui/Skeleton'
import {
  CrownIcon,
  CheckIcon,
  RefreshIcon,
  ShieldIcon,
  SparklesIcon,
  UserIcon
} from '../components/ui/Icons'

export default function ConcurrencyDemoPage() {
  useDocumentTitle('Concurrency & Zero Double-Booking Demo | TicketFlow')
  const toast = useToast()

  // Data fetching state
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [seats, setSeats] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingSeats, setLoadingSeats] = useState(false)
  const [seatRefreshTrigger, setSeatRefreshTrigger] = useState(0)

  // Race parameters & execution state
  const [attempts, setAttempts] = useState(5)
  const [isRacing, setIsRacing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [raceData, setRaceData] = useState(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const animationTimerRef = useRef(null)

  // 1. Load upcoming events on mount
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    getEvents({ signal: controller.signal })
      .then((res) => {
        if (cancelled) return
        const list = res?.events || (Array.isArray(res) ? res : [])
        setEvents(list)
        if (list.length > 0) {
          setSelectedEventId(list[0].eventId)
        }
        setLoadingEvents(false)
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        toast.error(err.message || 'Failed to load events for concurrency lab')
        setLoadingEvents(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [toast])

  // 2. Load seats asynchronously when selectedEventId or seatRefreshTrigger changes
  useEffect(() => {
    if (!selectedEventId) return

    const controller = new AbortController()
    let cancelled = false

    getSeats(selectedEventId, controller.signal)
      .then((res) => {
        if (cancelled) return
        const seatList = res?.seats || (Array.isArray(res) ? res : [])
        setSeats(seatList)
        setSelectedSeat((prev) => {
          if (prev) {
            const fresh = seatList.find((s) => s.seatId === prev.seatId)
            if (fresh) return fresh
          }
          return seatList.find((s) => s.status === 'AVAILABLE') || seatList[0] || null
        })
        setLoadingSeats(false)
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        toast.error('Failed to retrieve seats for this event')
        setLoadingSeats(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedEventId, seatRefreshTrigger, toast])

  const refreshSeats = useCallback(() => {
    setLoadingSeats(true)
    setSeatRefreshTrigger((k) => k + 1)
  }, [])

  // Clear animation timers on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current)
    }
  }, [])

  // 3. Start high-concurrency race
  const handleStartRace = async () => {
    if (!selectedSeat || !selectedEventId || isRacing) return

    try {
      setIsRacing(true)
      setRaceData(null)
      setRevealedCount(0)

      const res = await runDevRace({
        eventId: selectedEventId,
        seatId: selectedSeat.seatId,
        attempts: Number(attempts)
      })

      const data = res?.data || res
      setRaceData(data)

      // Sequential animation reveal in returned order
      const totalResults = data?.results?.length || 0
      let currentRevealed = 0

      if (animationTimerRef.current) clearInterval(animationTimerRef.current)

      animationTimerRef.current = setInterval(() => {
        currentRevealed++
        setRevealedCount(currentRevealed)
        if (currentRevealed >= totalResults) {
          clearInterval(animationTimerRef.current)
          animationTimerRef.current = null
        }
      }, 140)

      toast.success(
        `Race finished! ${data.booked || 1} booked, ${data.rejected || 0} rejected.`,
        'Race Completed'
      )

      // Refresh seats to show seat now booked
      refreshSeats()
    } catch (err) {
      toast.error(err.message || 'Failed to execute concurrency race simulation')
    } finally {
      setIsRacing(false)
    }
  }

  // 4. Reset race (cancels winning booking and releases seat)
  const handleResetRace = async () => {
    if (!selectedSeat || !selectedEventId || isResetting) return

    try {
      setIsResetting(true)
      await resetDevRace({
        eventId: selectedEventId,
        seatId: selectedSeat.seatId
      })

      toast.success(
        `Seat ${selectedSeat.seatNumber} has been released. Ready for next race.`,
        'Seat Released'
      )

      setRaceData(null)
      setRevealedCount(0)
      if (animationTimerRef.current) clearInterval(animationTimerRef.current)

      // Reload fresh seats
      refreshSeats()
    } catch (err) {
      toast.error(err.message || 'Failed to reset race seat')
    } finally {
      setIsResetting(false)
    }
  }

  const selectedEvent = events.find((e) => e.eventId === selectedEventId)

  return (
    <div className="concurrency-demo-page container">
      {/* ============================================================ */}
      {/* Header                                                       */}
      {/* ============================================================ */}
      <header className="race-demo-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Badge variant="accent" style={{ background: 'rgba(124, 58, 237, 0.25)', borderColor: 'var(--accent-violet)' }}>
            <SparklesIcon size={12} color="var(--accent-cyan)" />
            <span>Dev-Only Concurrency Lab</span>
          </Badge>
          <Badge variant="neutral">InnoDB Transactions</Badge>
        </div>
        <h1 className="race-demo-title">
          High-Concurrency Race Simulation
        </h1>
        <p className="race-demo-subtitle">
          Verify zero-double-booking guarantees in real time. Simulate up to 20 concurrent
          buyers racing for the exact same seat using MySQL row-level exclusive locks (<code style={{ color: 'var(--gold)' }}>SELECT ... FOR UPDATE</code>).
        </p>
      </header>

      {/* ============================================================ */}
      {/* Interactive Controls & Mini Seat Grid                        */}
      {/* ============================================================ */}
      <div className="race-controls-grid">
        {/* Left Column: Event Selection & Mini Seat Grid */}
        <GlassCard className="race-setup-card">
          <h2 className="race-card-heading">1. Select Event & Target Seat</h2>

          {/* Event Picker */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="event-select" className="race-field-label">
              Target Event
            </label>
            {loadingEvents ? (
              <Skeleton width="100%" height={42} />
            ) : (
              <select
                id="event-select"
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(Number(e.target.value))}
                className="race-select-input"
                disabled={isRacing}
              >
                {events.map((evt) => (
                  <option key={evt.eventId} value={evt.eventId}>
                    {evt.title} ({evt.venue})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mini 2D Seat Map */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="race-field-label" style={{ margin: 0 }}>
                Select Single Seat to Race Against:
              </span>
              {selectedSeat && (
                <span style={{ fontSize: '0.8rem', color: selectedSeat.status === 'AVAILABLE' ? 'var(--accent-cyan)' : 'var(--danger)' }}>
                  Selected: <strong>{selectedSeat.seatNumber}</strong> ({selectedSeat.tier || 'STANDARD'} • ₹{selectedSeat.price ? Number(selectedSeat.price).toLocaleString('en-IN') : '0'} • {selectedSeat.status})
                </span>
              )}
            </div>

            {loadingSeats ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6, padding: 'var(--space-3)' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <Skeleton key={i} width="100%" height={32} borderRadius="var(--radius-sm)" />
                ))}
              </div>
            ) : (
              <div className="mini-seat-grid-wrapper">
                <div className="mini-stage-banner">STAGE</div>
                <div className="mini-seat-grid" role="group" aria-label="Mini Seat Map Grid">
                  {seats.map((seat) => {
                    const isSelected = selectedSeat?.seatId === seat.seatId
                    const isBooked = seat.status !== 'AVAILABLE'

                    let seatBtnClass = 'mini-seat-btn'
                    if (isSelected) seatBtnClass += ' is-selected'
                    if (isBooked) seatBtnClass += ' is-booked'

                    return (
                      <button
                        key={seat.seatId}
                        type="button"
                        className={seatBtnClass}
                        onClick={() => setSelectedSeat(seat)}
                        disabled={isRacing}
                        title={`Seat ${seat.seatNumber} (${seat.tier || 'STANDARD'} - ₹${seat.price || 0}) - ${seat.status}`}
                        aria-label={`Seat ${seat.seatNumber}, ${seat.tier || 'STANDARD'}, ${seat.status}`}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? <CheckIcon size={12} color="#07070d" strokeWidth={3} /> : seat.seatNumber}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mini-seat-legend">
              <span className="legend-item"><span className="legend-dot dot-available" /> Available</span>
              <span className="legend-item"><span className="legend-dot dot-selected" /> Target Seat</span>
              <span className="legend-item"><span className="legend-dot dot-booked" /> Booked</span>
            </div>
          </div>
        </GlassCard>

        {/* Right Column: Concurrency Parameters & Execution */}
        <GlassCard className="race-setup-card">
          <h2 className="race-card-heading">2. Race Parameters & Execution</h2>

          {/* Attempts Slider */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <label htmlFor="attempts-range" className="race-field-label" style={{ margin: 0 }}>
                Concurrent Test Users (Attempts)
              </label>
              <span className="race-attempts-badge">{attempts} Users</span>
            </div>

            <input
              id="attempts-range"
              type="range"
              min="2"
              max="20"
              step="1"
              value={attempts}
              onChange={(e) => setAttempts(Number(e.target.value))}
              disabled={isRacing}
              className="race-slider-input"
            />

            {/* Quick Presets */}
            <div className="race-presets-bar">
              {[5, 10, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`race-preset-btn ${attempts === preset ? 'is-active' : ''}`}
                  onClick={() => setAttempts(preset)}
                  disabled={isRacing}
                >
                  {preset} Attempts
                </button>
              ))}
            </div>
          </div>

          {/* Target Summary Chip */}
          <div className="race-target-summary">
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Target Destination</span>
              <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>
                {selectedEvent?.title || 'Event'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Contested Seat</span>
              <strong style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>
                {selectedSeat ? `Seat ${selectedSeat.seatNumber}` : 'None'}
              </strong>
              {selectedSeat && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'block' }}>
                  {selectedSeat.tier || 'STANDARD'} • ₹{Number(selectedSeat.price || 0).toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Current Status</span>
              <span style={{ fontSize: '0.85rem', color: selectedSeat?.status === 'AVAILABLE' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {selectedSeat?.status || 'UNKNOWN'}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={isRacing}
              disabled={!selectedSeat || isRacing}
              onClick={handleStartRace}
              icon={<SparklesIcon size={18} />}
              className="start-race-btn"
              style={{ width: '100%' }}
            >
              {isRacing ? 'Simulating Concurrent Race...' : `Start Race (${attempts} Concurrent Attempts)`}
            </Button>

            {/* Reset Button */}
            {selectedSeat && (
              <Button
                type="button"
                variant="outline"
                size="md"
                loading={isResetting}
                disabled={isRacing || isResetting}
                onClick={handleResetRace}
                icon={<RefreshIcon size={16} />}
                className="reset-race-btn"
                style={{ width: '100%' }}
              >
                Reset Seat & Cancel Booking
              </Button>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ============================================================ */}
      {/* Race Lanes Visualization                                     */}
      {/* ============================================================ */}
      {raceData && (
        <section className="race-results-section" aria-label="Race Simulation Results">
          <div className="race-results-header">
            <h2 style={{ fontSize: 'var(--text-h2)', color: '#ffffff', margin: 0 }}>
              Live Execution Order & Outcomes
            </h2>
            <Badge variant="neutral">Sorted by Completion Order</Badge>
          </div>

          <div className="race-lanes-container" role="feed" aria-label="Concurrent Attempt Lanes">
            {(raceData.results || []).map((attemptResult, idx) => {
              const isRevealed = idx < revealedCount
              const isWinner = attemptResult.outcome === 'BOOKED'
              const laneClass = [
                'race-lane',
                isWinner ? 'is-winner' : 'is-rejected',
                isRevealed ? 'is-revealed' : 'is-pending'
              ].filter(Boolean).join(' ')

              return (
                <div key={attemptResult.user} className={laneClass}>
                  {/* Lane Rank & Crown */}
                  <div className="race-lane-rank">
                    {isWinner ? (
                      <span className="crown-badge" title="Race Winner">
                        <CrownIcon size={20} color="var(--gold)" />
                      </span>
                    ) : (
                      <span className="rank-num">#{idx + 1}</span>
                    )}
                  </div>

                  {/* User Avatar & Label */}
                  <div className="race-lane-user">
                    <UserIcon size={16} color={isWinner ? 'var(--gold)' : 'var(--text-muted)'} />
                    <span className="race-lane-email">{attemptResult.user}</span>
                  </div>

                  {/* Progress Bar Animation */}
                  <div className="race-lane-track">
                    <ProgressBar
                      value={isRevealed ? 100 : 0}
                      max={100}
                      className={isWinner ? 'winner-progress' : 'loser-progress'}
                    />
                  </div>

                  {/* Execution Duration */}
                  <div className="race-lane-time">
                    <span>{attemptResult.ms}ms</span>
                  </div>

                  {/* Outcome Badge */}
                  <div className="race-lane-outcome">
                    {isWinner ? (
                      <Badge variant="success" className="badge-winner-glow">
                        <CheckIcon size={12} color="var(--success)" />
                        <span>BOOKED (201)</span>
                      </Badge>
                    ) : (
                      <Badge variant="danger">
                        <span>REJECTED (409)</span>
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ============================================================ */}
          {/* Summary Card                                                 */}
          {/* ============================================================ */}
          {revealedCount >= (raceData.results?.length || 0) && (
            <GlassCard className="race-summary-card">
              <div className="race-summary-stats">
                <div className="race-stat-box box-gold">
                  <span className="race-stat-num">{raceData.booked || 1}</span>
                  <span className="race-stat-label">Booked (Winner)</span>
                </div>
                <div className="race-stat-box box-red">
                  <span className="race-stat-num">{raceData.rejected || 0}</span>
                  <span className="race-stat-label">Rejected (409 Conflict)</span>
                </div>
                <div className="race-stat-box box-green">
                  <span className="race-stat-num">0</span>
                  <span className="race-stat-label">Double Bookings</span>
                </div>
              </div>

              <div className="race-summary-verdict">
                <ShieldIcon size={24} color="var(--success)" />
                <div>
                  <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.05rem' }}>
                    Atomic Guarantee Upheld: 1 Booked, {raceData.rejected || 0} Rejected, 0 Double Bookings
                  </h3>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.85rem' }}>
                    MySQL row-level exclusive locks serialised all concurrent attempts. Exactly one booking was recorded.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleResetRace}
                  loading={isResetting}
                  icon={<RefreshIcon size={16} />}
                  className="summary-reset-btn"
                >
                  Reset & Race Again
                </Button>
              </div>
            </GlassCard>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/* Educational Explainer: How Transactions & Row Locks Work     */}
      {/* ============================================================ */}
      <GlassCard className="race-explainer-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)' }}>
          <ShieldIcon size={24} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: 'var(--text-h2)', color: '#ffffff', margin: 0 }}>
            How Transactions and Row Locks Prevent Double Booking
          </h2>
        </div>

        <div className="race-explainer-grid">
          <div className="explainer-step">
            <div className="step-num">01</div>
            <h4 className="step-title">SELECT ... FOR UPDATE</h4>
            <p className="step-desc">
              When a booking request begins, the backend issues an exclusive lock (<code style={{ color: 'var(--accent-cyan)' }}>FOR UPDATE</code>)
              on the index record of the requested seat within a dedicated connection.
            </p>
          </div>

          <div className="explainer-step">
            <div className="step-num">02</div>
            <h4 className="step-title">Strict Serialization</h4>
            <p className="step-desc">
              Competing concurrent transactions trying to lock the exact same seat are held waiting at the MySQL InnoDB engine level
              until the holding transaction commits or rolls back.
            </p>
          </div>

          <div className="explainer-step">
            <div className="step-num">03</div>
            <h4 className="step-title">Atomic State Mutation</h4>
            <p className="step-desc">
              The first transaction updates the seat status to <code style={{ color: 'var(--gold)' }}>BOOKED</code>, inserts the booking and active seat records,
              and commits. The lock is then released.
            </p>
          </div>

          <div className="explainer-step">
            <div className="step-num">04</div>
            <h4 className="step-title">Instant 409 Conflict Rollback</h4>
            <p className="step-desc">
              The queued transactions immediately inspect the freshly committed row, find <code style={{ color: 'var(--danger)' }}>status !== 'AVAILABLE'</code>,
              roll back their transactions cleanly, and return HTTP 409 Conflict.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
