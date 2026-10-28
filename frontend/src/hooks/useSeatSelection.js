import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { seatNumberCompare } from '../lib/seatLayout'

export const MAX_SEATS_PER_BOOKING = 8

/**
 * Custom hook to manage seat selection state with strict 8-seat limit enforcement,
 * natural seat sorting, and real-time pricing calculation.
 * Serves as the single source of truth for both 2D and 3D views.
 *
 * @param {object} options
 * @param {Array<object>} [options.seats=[]] - List of all seats for the event
 * @param {number} [options.price=0] - Price per seat
 * @param {number} [options.maxSeats=8] - Maximum allowable seats per booking
 * @param {Function} [options.onLimit] - Callback invoked when the user attempts to exceed maxSeats
 * @returns {object} Selection state and control functions
 */
export function useSeatSelection({
  seats = [],
  price = 0,
  maxSeats = MAX_SEATS_PER_BOOKING,
  onLimit = null
} = {}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const selectedIdsRef = useRef(selectedIds)

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  // Fast ID lookup map for all seats in current event
  const seatMap = useMemo(() => {
    const map = new Map()
    if (Array.isArray(seats)) {
      for (const seat of seats) {
        const id = seat.seatId || seat.id
        if (id !== undefined && id !== null) {
          map.set(id, seat)
        }
      }
    }
    return map
  }, [seats])

  /**
   * Toggles seat selection state.
   * Rejects booked seats and enforces maxSeats limit.
   */
  const toggle = useCallback((seat) => {
    if (!seat) return false

    // Prevent booking or selecting already booked seats (case-insensitive)
    const status = String(seat.status || '').toLowerCase()
    if (status === 'booked' || seat.isBooked) {
      return false
    }

    const id = seat.seatId || seat.id
    if (id === undefined || id === null) return false

    const current = selectedIdsRef.current
    if (!current.has(id)) {
      if (current.size >= maxSeats) {
        onLimit?.(maxSeats)
        return false
      }
      const next = new Set(current).add(id)
      selectedIdsRef.current = next
      setSelectedIds(next)
      return true
    } else {
      const next = new Set(current)
      next.delete(id)
      selectedIdsRef.current = next
      setSelectedIds(next)
      return true
    }
  }, [maxSeats, onLimit])

  /**
   * Clears all selected seats.
   */
  const clear = useCallback(() => {
    selectedIdsRef.current = new Set()
    setSelectedIds(new Set())
  }, [])

  /**
   * Prunes selected seats against a list of valid/available seat IDs.
   * Useful when refreshing seat availability to drop newly-booked seats.
   */
  const prune = useCallback((availableIds) => {
    if (!availableIds) return

    const validSet = availableIds instanceof Set
      ? availableIds
      : new Set(Array.isArray(availableIds) ? availableIds : [])

    const current = selectedIdsRef.current
    let changed = false
    const next = new Set()
    for (const id of current) {
      if (validSet.has(id)) {
        next.add(id)
      } else {
        changed = true
      }
    }
    if (changed) {
      selectedIdsRef.current = next
      setSelectedIds(next)
    }
  }, [])

  /**
   * Checks whether a seat is currently selected.
   */
  const isSelected = useCallback((seatOrId) => {
    if (seatOrId === null || seatOrId === undefined) return false
    const id = typeof seatOrId === 'object' ? (seatOrId.seatId || seatOrId.id) : seatOrId
    return selectedIds.has(id)
  }, [selectedIds])

  // Derived selected seats list, sorted naturally (e.g. A2 before A10)
  const selectedSeats = useMemo(() => {
    const list = []
    for (const id of selectedIds) {
      const seatObj = seatMap.get(id) || { seatId: id, id, seatNumber: String(id) }
      list.push(seatObj)
    }
    return list.sort(seatNumberCompare)
  }, [selectedIds, seatMap])

  const count = selectedIds.size
  const total = useMemo(() => {
    let sumPaise = 0
    for (const seat of selectedSeats) {
      const seatPrice = seat.price !== undefined && seat.price !== null ? seat.price : price
      sumPaise += Math.round(Number(seatPrice) * 100)
    }
    return sumPaise / 100
  }, [selectedSeats, price])

  return {
    selectedIds,
    selectedSeats,
    count,
    total,
    toggle,
    clear,
    prune,
    isSelected,
    maxSeats
  }
}

export default useSeatSelection
