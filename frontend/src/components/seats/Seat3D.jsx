import { memo } from 'react'
import { CheckIcon } from '../ui/Icons'

/**
 * Seat3D
 * Individual 3D theater seat composed of a horizontal cushion, front apron,
 * and upright vertical backrest face with gradient shading and 3D elevations.
 *
 * State classes:
 * - available: cyan accent (#22d3ee)
 * - hover: violet highlight (#7c3aed), subtle lift
 * - selected: gold (#fbbf24) + raised 14px + prominent glow
 * - booked: dark muted (#181824), non-interactive, opacity 0.45
 *
 * Optimized with React.memo to re-render ONLY when its own status/selection changes.
 */
export const Seat3D = memo(function Seat3D({
  seat,
  isSelected = false,
  isBooked = false,
  isPulsing = false,
  isFocused = false,
  disabled = false,
  formattedPrice = '',
  buttonRef = null,
  onToggle = () => {},
  onFocus = () => {},
  onKeyDown = () => {},
  onPointerEnter = null,
  onPointerLeave = null
}) {
  const id = seat.seatId || seat.id

  const tierClass = seat.tier ? `seat-tier-${seat.tier.toLowerCase()}` : 'seat-tier-standard'

  const stateClass = isBooked
    ? 'seat-3d-booked'
    : isSelected
      ? 'seat-3d-selected'
      : `seat-3d-available ${tierClass}`

  const pulseClass = isPulsing ? 'seat-3d-pulse' : ''

  const seatPrice = seat.price !== undefined && seat.price !== null ? seat.price : formattedPrice
  const displayPriceStr = typeof seatPrice === 'number' ? `₹${seatPrice}` : `${seatPrice} rupees`

  const ariaStatus = isBooked
    ? 'booked'
    : isSelected
      ? `selected, ${seat.tier ? `${seat.tier} tier, ` : ''}${displayPriceStr}`
      : `available, ${seat.tier ? `${seat.tier} tier, ` : ''}${displayPriceStr}`

  const seatTransform = `translate3d(${seat.pos.x}px, ${seat.pos.y}px, ${seat.pos.z}px) rotateZ(${seat.pos.angleDeg}deg)`

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`seat-3d ${stateClass} ${pulseClass}`.trim()}
      style={{ transform: seatTransform }}
      disabled={isBooked || disabled}
      tabIndex={isBooked ? -1 : isFocused ? 0 : -1}
      aria-label={`Seat ${seat.seatNumber}, ${ariaStatus}`}
      aria-pressed={isBooked ? undefined : isSelected}
      onClick={() => {
        if (!isBooked && !disabled) {
          onToggle(seat)
        }
      }}
      onPointerEnter={(e) => {
        if (!disabled) onPointerEnter?.(seat, e)
      }}
      onMouseEnter={(e) => {
        if (!disabled) onPointerEnter?.(seat, e)
      }}
      onPointerLeave={() => {
        onPointerLeave?.()
      }}
      onMouseLeave={() => {
        onPointerLeave?.()
      }}
      onFocus={() => {
        if (!isBooked) {
          onFocus(id)
        }
      }}
      onKeyDown={(e) => onKeyDown(e, seat)}
    >
      {/* 1. Horizontal Seat Cushion Slab */}
      <div className="seat-3d-cushion">
        {isSelected ? (
          <CheckIcon size={12} color="#07070d" strokeWidth={3} />
        ) : isBooked ? (
          <span className="seat-3d-strike" aria-hidden="true" />
        ) : (
          <span className="seat-3d-col-text">{seat.col}</span>
        )}
      </div>

      {/* 2. Front Apron Edge (gives cushion physical 3D thickness) */}
      <div className="seat-3d-apron" aria-hidden="true" />

      {/* 3. Upright Vertical Backrest Face */}
      <div className="seat-3d-backrest" aria-hidden="true" />
    </button>
  )
})

export default Seat3D
