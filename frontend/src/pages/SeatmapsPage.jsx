import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getEvents, getSeats } from '../services/api'
import { getSeatLayout } from '../seatmap'
import { SeatMap3D } from '../components/seats/SeatMap3D'
import { SeatGrid2D } from '../components/seats/SeatGrid2D'
import { GlassCard } from '../components/ui/GlassCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'

const VENUES = [
  { id: 'ARENA', label: 'Concert Arena', count: 138, eventId: 1 },
  { id: 'AUDITORIUM', label: 'Auditorium', count: 128, eventId: 2 },
  { id: 'CLUB', label: 'Comedy Club', count: 40, eventId: 3 },
  { id: 'THEATRE', label: 'Opera Theatre', count: 144, eventId: 4 },
  { id: 'STADIUM', label: 'Sports Stadium', count: 126, eventId: 5 },
  { id: 'FESTIVAL', label: 'Music Festival', count: 138, eventId: 6 }
]

export default function SeatmapsPage() {
  useDocumentTitle('Venue Seating Plans Dev Preview | TicketFlow')

  const [activeVenue, setActiveVenue] = useState('ARENA')
  const [viewMode, setViewMode] = useState('3d') // '3d' | '2d'
  const [events, setEvents] = useState([])
  const [seatsMap, setSeatsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedSeatIds, setSelectedSeatIds] = useState(new Set())

  // Load events and pre-load all venue seat maps
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const eventsRes = await getEvents()
        const list = eventsRes?.events || (Array.isArray(eventsRes) ? eventsRes : [])
        if (!cancelled) setEvents(list)

        // Preload seats for each event
        const map = {}
        for (const ev of list) {
          try {
            const seatsRes = await getSeats(ev.eventId)
            map[ev.eventId] = seatsRes?.seats || (Array.isArray(seatsRes) ? seatsRes : [])
          } catch (err) {
            console.error(`Failed to load seats for event ${ev.eventId}:`, err)
          }
        }
        if (!cancelled) {
          setSeatsMap(map)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load events for preview:', err)
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [])

  // Find target event for active venue
  const currentVenue = VENUES.find((v) => v.id === activeVenue) || VENUES[0]
  const targetEvent = useMemo(() => {
    return (
      events.find((e) => e.layoutType === activeVenue || e.eventId === currentVenue.eventId) || {
        eventId: currentVenue.eventId,
        title: currentVenue.label,
        layoutType: activeVenue,
        price: 1500
      }
    )
  }, [events, activeVenue, currentVenue])

  // Get raw seats
  const rawSeats = useMemo(() => {
    return seatsMap[targetEvent.eventId] || []
  }, [seatsMap, targetEvent.eventId])

  // Compute 3D/2D layout structure
  const layout = useMemo(() => {
    return getSeatLayout(rawSeats, targetEvent)
  }, [rawSeats, targetEvent])

  // Seat toggle logic (max 8 seats per rule)
  const handleToggleSeat = useCallback((seat) => {
    const id = seat.seatId || seat.id
    setSelectedSeatIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 8) return prev
        next.add(id)
      }
      return next
    })
  }, [])

  // Overlap verification: ensure no two seats have distance < 18px in 3D projection plane
  const overlapStats = useMemo(() => {
    const seats = layout?.seats || []
    let collisionCount = 0
    const minDistance = 16 // minimum acceptable center-to-center distance in px

    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const dx = seats[i].pos.x - seats[j].pos.x
        const dy = seats[i].pos.y - seats[j].pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDistance) {
          collisionCount++
        }
      }
    }

    return {
      totalSeats: seats.length,
      collisionCount,
      hasOverlap: collisionCount > 0
    }
  }, [layout])

  return (
    <div className="container" style={{ padding: 'var(--space-6) var(--space-4)', width: '100%' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <Badge variant="cyan">DEV ONLY PREVIEW</Badge>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real Venue Geometry & Projection Audit
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          Venue Seating Architecture
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0' }}>
          Real venue seating plans with authentic sections, raked tiers, accurate 3D decor, and collision-free seat spacing.
        </p>
      </div>

      {/* Top Controls Card */}
      <GlassCard style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Venue Switcher Tabs */}
          <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 'var(--space-1)' }}>
            <SegmentedControl
              options={VENUES.map((v) => ({
                value: v.id,
                label: `${v.label} (${v.count})`
              }))}
              value={activeVenue}
              onChange={(newVenue) => {
                setActiveVenue(newVenue)
                setSelectedSeatIds(new Set())
              }}
            />
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>View:</span>
            <SegmentedControl
              options={[
                { value: '3d', label: '3D Orbit Map' },
                { value: '2d', label: '2D Plan Grid' }
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </div>
        </div>

        {/* Venue Info & Section Breakdown */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Metrics */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
            <Badge variant="warn">{layout.templateName || activeVenue}</Badge>
            <Badge variant="neutral">{layout.seats?.length || 0} Seats</Badge>
            <Badge variant="accent">{layout.sections?.length || 0} Sections</Badge>
            {overlapStats.hasOverlap ? (
              <Badge variant="danger">Overlap Alert: {overlapStats.collisionCount} collisions</Badge>
            ) : (
              <Badge variant="success">✓ Zero Overlapping Seats</Badge>
            )}
            <Badge variant={selectedSeatIds.size > 0 ? 'warn' : 'neutral'}>
              {selectedSeatIds.size}/8 Selected
            </Badge>
          </div>

          {/* Section Pill List */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {layout.sections?.map((sec) => (
              <span
                key={sec.name}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)'
                }}
              >
                <strong style={{ color: 'var(--accent-cyan)' }}>{sec.name}:</strong> {sec.seats?.length}
              </span>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Main Seat Map Container */}
      <GlassCard padding="none" style={{ position: 'relative', overflow: 'hidden', minHeight: '520px' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading venue seating geometry...
          </div>
        ) : viewMode === '3d' ? (
          <SeatMap3D
            layout={layout}
            selectedIds={selectedSeatIds}
            onToggle={handleToggleSeat}
            price={targetEvent.price || 1500}
          />
        ) : (
          <div style={{ padding: 'var(--space-6)' }}>
            <SeatGrid2D
              layout={layout}
              selectedIds={selectedSeatIds}
              onToggle={handleToggleSeat}
              price={targetEvent.price || 1500}
            />
          </div>
        )}
      </GlassCard>

      {/* Selected Seats Bar */}
      {selectedSeatIds.size > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selected Seats:</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                  {Array.from(selectedSeatIds).map((id) => {
                    const seat = layout.seats?.find((s) => (s.seatId || s.id) === id)
                    return (
                      <Badge key={id} variant="gold">
                        {seat ? `${seat.section} • ${seat.seatNumber}` : `Seat #${id}`}
                      </Badge>
                    )
                  })}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedSeatIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
