import { useState, useRef, useMemo } from 'react'
import { CheckIcon } from '../ui/Icons'

/**
 * 2D Interactive Seat Grid with glowing SCREEN bar, natural row labelling,
 * roving tabindex keyboard navigation, touch-friendly tap targets, and legend.
 */
export function SeatGrid2D({
  layout = null,
  rows: rowsProp = [],
  selectedIds = new Set(),
  pulsingSeatIds = new Set(),
  onToggle = () => {},
  price = 0
}) {
  const rows = useMemo(() => layout?.rows || rowsProp || [], [layout?.rows, rowsProp])

  // Group rows into sections
  const sectionGroups = useMemo(() => {
    if (layout?.sections && layout.sections.length > 1) {
      // Build from layout.sections
      return layout.sections.map((sec) => {
        const secRows = rows.filter((r) => r.section === sec.name)
        return {
          name: sec.name,
          rows: secRows.length > 0 ? secRows : rows,
          seatCount: sec.seats?.length || 0
        }
      })
    }

    // Check if rows have different section names
    const secMap = new Map()
    for (const r of rows) {
      const name = r.section || 'General'
      if (!secMap.has(name)) secMap.set(name, [])
      secMap.get(name).push(r)
    }

    if (secMap.size > 1) {
      return Array.from(secMap.entries()).map(([name, sRows]) => ({
        name,
        rows: sRows,
        seatCount: sRows.reduce((sum, r) => sum + r.seats.length, 0)
      }))
    }

    // Single section fallback
    return [{ name: 'General', rows, seatCount: rows.reduce((sum, r) => sum + r.seats.length, 0) }]
  }, [layout, rows])

  // Derive the first available seat ID as the initial default focus
  const firstAvailableId = useMemo(() => {
    for (const row of rows) {
      for (const seat of row.seats) {
        if (String(seat.status || '').toLowerCase() === 'available') {
          return seat.seatId || seat.id
        }
      }
    }
    return rows[0]?.seats[0]?.seatId || rows[0]?.seats[0]?.id || null
  }, [rows])

  const [userFocusedSeatId, setUserFocusedSeatId] = useState(null)
  const focusedSeatId = userFocusedSeatId ?? firstAvailableId
  const seatRefs = useRef({})

  // Fast grid coordinate lookup for arrow key navigation
  const gridLookup = useMemo(() => {
    const map = {}
    rows.forEach((r, rIdx) => {
      r.seats.forEach((s, cIdx) => {
        const id = s.seatId || s.id
        map[id] = { rIdx, cIdx }
      })
    })
    return map
  }, [rows])

  // Handle arrow key navigation between seats (roving tabIndex)
  const handleKeyDown = (e, currentSeat) => {
    const currentId = currentSeat.seatId || currentSeat.id
    const meta = gridLookup[currentId]
    if (!meta) return

    let targetSeat = null

    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault()
        const nextCol = meta.cIdx + 1
        if (nextCol < rows[meta.rIdx].seats.length) {
          targetSeat = rows[meta.rIdx].seats[nextCol]
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const prevCol = meta.cIdx - 1
        if (prevCol >= 0) {
          targetSeat = rows[meta.rIdx].seats[prevCol]
        }
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        const nextRow = meta.rIdx + 1
        if (nextRow < rows.length) {
          const targetRowSeats = rows[nextRow].seats
          // Find seat in same or nearest column
          const colIndex = Math.min(meta.cIdx, targetRowSeats.length - 1)
          targetSeat = targetRowSeats[colIndex]
        }
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prevRow = meta.rIdx - 1
        if (prevRow >= 0) {
          const targetRowSeats = rows[prevRow].seats
          const colIndex = Math.min(meta.cIdx, targetRowSeats.length - 1)
          targetSeat = targetRowSeats[colIndex]
        }
        break
      }
      case ' ':
      case 'Enter': {
        e.preventDefault()
        if (String(currentSeat.status || '').toLowerCase() !== 'booked') {
          onToggle(currentSeat)
        }
        return
      }
      default:
        return
    }

    if (targetSeat) {
      const targetId = targetSeat.seatId || targetSeat.id
      setUserFocusedSeatId(targetId)
      const el = seatRefs.current[targetId]
      if (el) {
        el.focus()
      }
    }
  }

  return (
    <div className="seat-grid-root">
      {/* 1. SCREEN Stage Bar with Ambient Light Beam */}
      <div className="seat-screen-wrapper">
        <div className="seat-screen-bar" role="region" aria-label="Stage and Screen Area">
          <div className="seat-screen-glow" />
          <span className="seat-screen-text">STAGE / SCREEN</span>
        </div>
      </div>

      {/* 2. Legend */}
      <div className="seat-legend-bar" aria-label="Seat Selection Legend">
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
        <div className="seat-legend-item">
          <span className="seat-indicator seat-indicator-tier-economy" />
          <span>Economy</span>
        </div>
        <div className="seat-legend-item">
          <span className="seat-indicator seat-indicator-selected">
            <CheckIcon size={12} color="#07070d" strokeWidth={3} />
          </span>
          <span>Selected</span>
        </div>
        <div className="seat-legend-item">
          <span className="seat-indicator seat-indicator-booked" />
          <span>Booked</span>
        </div>
      </div>

      {/* 3. Scrollable Grid Container */}
      <div
        className="seat-grid-scroll-container"
        tabIndex={-1}
        role="region"
        aria-label="Seat Map Grid"
      >
        <div className="seat-grid-layout">
          {sectionGroups.map((secGroup) => (
            <div key={secGroup.name} className="seat-grid-section-block">
              {sectionGroups.length > 1 && (
                <div className="seat-grid-section-header">
                  <span className="seat-grid-section-badge">{secGroup.name}</span>
                  <span className="seat-grid-section-count">{secGroup.seatCount} seats</span>
                </div>
              )}

              {secGroup.rows.map((row) => (
                <div key={`${secGroup.name}_${row.label}`} className="seat-row" role="row">
                  {/* Left Row Label */}
                  <div className="seat-row-label seat-row-label-left" aria-hidden="true">
                    {row.label}
                  </div>

                  {/* Seats in Row */}
                  <div className="seat-row-seats">
                    {row.seats.map((seat, colIndex) => {
                      const id = seat.seatId || seat.id
                      const status = String(seat.status || '').toLowerCase()
                      const isBooked = status === 'booked'
                      const isSelected = selectedIds.has(id)
                      const isFocused = id === focusedSeatId

                      // Aisle gap after every 4th seat
                      const isAisleGap = colIndex % 4 === 3 && colIndex !== row.seats.length - 1

                      // Accessible label per spec
                      const seatPrice = seat.price !== undefined && seat.price !== null ? seat.price : price
                      const displayPriceStr = typeof seatPrice === 'number' ? `₹${seatPrice}` : `${seatPrice} rupees`
                      const tierClass = seat.tier ? `seat-btn-tier-${seat.tier.toLowerCase()}` : 'seat-btn-tier-standard'

                      const ariaStatus = isBooked
                        ? 'booked'
                        : isSelected
                          ? `selected, ${seat.tier ? `${seat.tier} tier, ` : ''}${displayPriceStr}`
                          : `available, ${seat.tier ? `${seat.tier} tier, ` : ''}${displayPriceStr}`

                      const isPulsing = pulsingSeatIds?.has(id)

                      const seatClass = [
                        'seat-btn',
                        isBooked && 'seat-btn-booked',
                        isSelected && 'seat-btn-selected',
                        !isBooked && !isSelected && `seat-btn-available ${tierClass}`,
                        isAisleGap && 'seat-btn-aisle',
                        isPulsing && 'seat-btn-booked-pulse'
                      ].filter(Boolean).join(' ')

                      return (
                        <button
                          key={id}
                          ref={(el) => {
                            if (el) seatRefs.current[id] = el
                            else delete seatRefs.current[id]
                          }}
                          type="button"
                          className={seatClass}
                          disabled={isBooked}
                          tabIndex={isBooked ? -1 : isFocused ? 0 : -1}
                          title={`Seat ${seat.seatNumber}${seat.tier ? ` • ${seat.tier}` : ''} • ₹${seatPrice}`}
                          aria-label={`Seat ${seat.seatNumber}, ${ariaStatus}`}
                          aria-pressed={isBooked ? undefined : isSelected}
                          onClick={() => {
                            if (!isBooked) {
                              setUserFocusedSeatId(id)
                              onToggle(seat)
                            }
                          }}
                          onFocus={() => {
                            if (!isBooked) setUserFocusedSeatId(id)
                          }}
                          onKeyDown={(e) => handleKeyDown(e, seat)}
                        >
                          {/* Visual Content: Checkmark when selected, strike when booked, seat col when available */}
                          {isSelected ? (
                            <CheckIcon size={14} color="#07070d" strokeWidth={3} />
                          ) : isBooked ? (
                            <span className="seat-strike-line" aria-hidden="true" />
                          ) : (
                            <span className="seat-col-text">{seat.col}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Right Row Label */}
                  <div className="seat-row-label seat-row-label-right" aria-hidden="true">
                    {row.label}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SeatGrid2D
