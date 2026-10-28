import { useState, useEffect, useRef, useCallback } from 'react'
import { getSeats } from '../services/api'

const BASE_POLL_INTERVAL = 5000 // 5 seconds
const MAX_BACKOFF_INTERVAL = 30000 // 30 seconds

/**
 * useSeatAvailability
 * Robust seat availability polling hook safe under React StrictMode.
 *
 * Features:
 * - Polls every 5s only while document.visibilityState is 'visible'.
 * - Pauses polling when the tab is hidden; immediately refetches on tab return.
 * - Exponential backoff on network/server errors (5s -> 10s -> 20s -> 30s) without toast spam.
 * - StrictMode safe: aborts in-flight fetches on unmount, clears all timers, never double-polls.
 * - Tracks newly booked seats and triggers a 600ms pulse state.
 *
 * @param {string|number} eventId - Target event ID
 * @param {object} [options]
 * @param {Function} [options.onSeatsChanged] - Callback invoked when seat statuses change
 * @returns {{
 *   seats: Array<object>,
 *   price: number,
 *   loading: boolean,
 *   error: string|null,
 *   refetch: () => Promise<object>,
 *   pulsingSeatIds: Set<number|string>
 * }}
 */
export function useSeatAvailability(eventId, options = {}) {
  const { onSeatsChanged } = options

  const [seats, setSeats] = useState([])
  const [price, setPrice] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pulsingSeatIds, setPulsingSeatIds] = useState(() => new Set())

  // Mutable refs for lifecycle tracking without triggering re-renders
  const abortControllerRef = useRef(null)
  const pollTimerRef = useRef(null)
  const pulseTimerRef = useRef(null)
  const currentIntervalRef = useRef(BASE_POLL_INTERVAL)
  const previousSeatsMapRef = useRef(new Map())
  const isMountedRef = useRef(true)
  const effectIdRef = useRef(0)

  // Keep callback reference updated
  const onSeatsChangedRef = useRef(onSeatsChanged)
  useEffect(() => {
    onSeatsChangedRef.current = onSeatsChanged
  }, [onSeatsChanged])

  /**
   * Core fetcher function.
   * Compares incoming seat statuses with previous snapshot to identify newly booked seats.
   */
  const fetchSeatsData = useCallback(async (isInitial = false) => {
    if (!eventId || !isMountedRef.current) return null

    // Abort previous in-flight fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await getSeats(eventId, controller.signal)
      if (!isMountedRef.current) return null

      const data = res?.seats ? res : (res?.data || null)
      if (!data || !Array.isArray(data.seats)) {
        throw new Error('Invalid seat data received from server.')
      }

      const incomingSeats = data.seats
      const prevMap = previousSeatsMapRef.current
      const nextMap = new Map()

      const newlyBooked = []

      for (const seat of incomingSeats) {
        const id = seat.seatId || seat.id
        const currentStatus = String(seat.status || '').toUpperCase()
        nextMap.set(id, currentStatus)

        // If previously available and now booked, mark as newly booked
        if (prevMap.has(id)) {
          const prevStatus = prevMap.get(id)
          if (prevStatus === 'AVAILABLE' && currentStatus === 'BOOKED') {
            newlyBooked.push(seat)
          }
        }
      }

      // Update previous snapshot
      previousSeatsMapRef.current = nextMap

      // Trigger 600ms CSS pulse for newly booked seats
      if (newlyBooked.length > 0) {
        const newPulsingSet = new Set(newlyBooked.map((s) => s.seatId || s.id))
        setPulsingSeatIds(newPulsingSet)

        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setPulsingSeatIds(new Set())
          }
        }, 600)
      }

      // Notify parent of status changes (e.g. for selection pruning)
      if (onSeatsChangedRef.current && !isInitial) {
        onSeatsChangedRef.current(incomingSeats, newlyBooked)
      }

      setSeats(incomingSeats)
      if (data.price !== undefined) {
        setPrice(Number(data.price) || 0)
      } else if (incomingSeats.length > 0 && incomingSeats[0].price !== undefined) {
        const minP = Math.min(...incomingSeats.map((s) => Number(s.price) || 0))
        setPrice(minP)
      }
      setError(null)
      // Reset backoff on successful fetch
      currentIntervalRef.current = BASE_POLL_INTERVAL

      return data
    } catch (err) {
      if (err.name === 'AbortError') {
        return null // Clean abort, do not set error state
      }

      if (isMountedRef.current) {
        setError(err.message || 'Failed to update seat availability.')
        // Exponential backoff capped at 30 seconds
        currentIntervalRef.current = Math.min(currentIntervalRef.current * 2, MAX_BACKOFF_INTERVAL)
      }
      return null
    } finally {
      if (isMountedRef.current && isInitial) {
        setLoading(false)
      }
    }
  }, [eventId])

  /**
   * Refetch trigger exposed to consumers (e.g. before confirmation)
   */
  const refetch = useCallback(() => {
    return fetchSeatsData(false)
  }, [fetchSeatsData])

  /**
   * Single polling loop coordinator.
   * Completely safe under React StrictMode (double-invoked effects).
   */
  useEffect(() => {
    isMountedRef.current = true
    const currentId = ++effectIdRef.current
    let isCancelled = false

    const scheduleNextPoll = () => {
      if (isCancelled || effectIdRef.current !== currentId || !isMountedRef.current) return
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }

      // Only schedule next poll if the tab is currently visible
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      pollTimerRef.current = setTimeout(async () => {
        if (isCancelled || effectIdRef.current !== currentId || !isMountedRef.current) return
        await fetchSeatsData(false)
        if (!isCancelled && effectIdRef.current === currentId && isMountedRef.current) {
          scheduleNextPoll()
        }
      }, currentIntervalRef.current)
    }

    const start = async () => {
      await fetchSeatsData(true)
      if (!isCancelled && effectIdRef.current === currentId && isMountedRef.current) {
        scheduleNextPoll()
      }
    }

    start()

    // Visibility change handler: pause when hidden, immediate refetch when visible
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return
      if (isCancelled || effectIdRef.current !== currentId || !isMountedRef.current) return

      if (document.visibilityState === 'visible') {
        // Tab became visible again: immediate refetch + restart 5s interval
        currentIntervalRef.current = BASE_POLL_INTERVAL
        fetchSeatsData(false).then(() => {
          if (!isCancelled && effectIdRef.current === currentId && isMountedRef.current) {
            scheduleNextPoll()
          }
        })
      } else {
        // Tab hidden: clear polling timer to avoid wasted background network calls
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current)
          pollTimerRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isCancelled = true
      effectIdRef.current += 1
      isMountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [fetchSeatsData])

  return {
    seats,
    price,
    loading,
    error,
    refetch,
    pulsingSeatIds
  }
}

export default useSeatAvailability
