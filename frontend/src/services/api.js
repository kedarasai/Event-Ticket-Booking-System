const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
export const TOKEN_STORAGE_KEY = 'tb_token'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let onUnauthorizedHandler = null
let isHandlingUnauthorized = false

export function setUnauthorizedHandler(handler) {
  onUnauthorizedHandler = handler
}

/**
 * Creates an AbortSignal that aborts after timeoutMs or when callerSignal aborts.
 */
function createTimeoutSignal(timeoutMs, callerSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new Error('Request timed out.'))
  }, timeoutMs)

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer)
      controller.abort(callerSignal.reason)
    } else {
      const onAbort = () => {
        clearTimeout(timer)
        controller.abort(callerSignal.reason)
      }
      callerSignal.addEventListener('abort', onAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  }
}

/**
 * Core HTTP request handler
 */
export async function request(endpoint, options = {}) {
  const { signal: callerSignal, headers: customHeaders = {}, timeout = 15000, ...fetchOptions } = options

  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null
  const headers = {
    'Accept': 'application/json',
    ...customHeaders
  }

  let hasAuthHeader = false
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    hasAuthHeader = true
  }

  if (fetchOptions.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const { signal, cleanup } = createTimeoutSignal(timeout, callerSignal)

  let response
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal
    })
  } catch (err) {
    cleanup()
    if (callerSignal?.aborted) {
      // Re-throw caller abort as-is
      throw err
    }
    throw new ApiError(0, 'Cannot reach the server. Check your connection.')
  }
  cleanup()

  // On 401 for an authenticated call, trigger session expiration handling
  if (response.status === 401 && hasAuthHeader) {
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login'
    if (!isHandlingUnauthorized && !isLoginPage) {
      isHandlingUnauthorized = true
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (typeof onUnauthorizedHandler === 'function') {
        onUnauthorizedHandler()
      }
      setTimeout(() => {
        isHandlingUnauthorized = false
      }, 1000)
    }
  }

  // Parse JSON response safely
  let json
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      json = await response.json()
    } catch {
      throw new ApiError(response.status, 'Invalid response from server.')
    }
  } else {
    // Non-JSON response
    if (!response.ok) {
      throw new ApiError(response.status, 'Invalid response from server.')
    }
    return null
  }

  if (!response.ok) {
    const errorMessage = json?.message || 'An unexpected error occurred.'
    throw new ApiError(response.status, errorMessage)
  }

  // Unwrap { success, message, data } -> returns data
  return json?.data !== undefined ? json.data : json
}

/* ==========================================================================
   Endpoint functions (1 per API contract endpoint)
   ========================================================================== */

/**
 * POST /auth/register
 * @param {{ name: string, email: string, password: string }} data
 */
export function register({ name, email, password }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  })
}

/**
 * POST /auth/login
 * @param {{ email: string, password: string }} data
 */
export function login({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

/**
 * GET /auth/me
 * @param {AbortSignal} [signal]
 */
export function me(signal) {
  return request('/auth/me', {
    method: 'GET',
    signal
  })
}

/**
 * GET /events?search&page&limit
 * @param {{ search?: string, page?: number, limit?: number, signal?: AbortSignal }} [params]
 */
export function getEvents({ search, page, limit, signal } = {}) {
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  if (page) params.append('page', String(page))
  if (limit) params.append('limit', String(limit))
  const qs = params.toString()
  return request(`/events${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    signal
  })
}

/**
 * GET /events/:eventId
 * @param {number|string} eventId
 * @param {AbortSignal} [signal]
 */
export function getEvent(eventId, signal) {
  return request(`/events/${eventId}`, {
    method: 'GET',
    signal
  })
}

/**
 * GET /events/:eventId/seats
 * @param {number|string} eventId
 * @param {AbortSignal} [signal]
 */
export function getSeats(eventId, signal) {
  return request(`/events/${eventId}/seats`, {
    method: 'GET',
    signal
  })
}

/**
 * POST /bookings
 * @param {number|string} eventId
 * @param {number[]} seatIds
 * @param {string} [idempotencyKey]
 */
export function createBooking(eventId, seatIds, idempotencyKey) {
  const headers = {}
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }
  return request('/bookings', {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventId, seatIds })
  })
}

/**
 * GET /bookings/my
 * @param {AbortSignal} [signal]
 */
export function getMyBookings(signal) {
  return request('/bookings/my', {
    method: 'GET',
    signal
  })
}

/**
 * GET /bookings/:bookingId
 * @param {number|string} bookingId
 * @param {AbortSignal} [signal]
 */
export function getBooking(bookingId, signal) {
  return request(`/bookings/${bookingId}`, {
    method: 'GET',
    signal
  })
}

/**
 * POST /bookings/:bookingId/cancel
 * @param {number|string} bookingId
 */
export function cancelBooking(bookingId) {
  return request(`/bookings/${bookingId}/cancel`, {
    method: 'POST'
  })
}

/**
 * Dev-only race simulation: POST /dev/race
 */
export function runDevRace({ eventId, seatId, attempts }, signal) {
  return request('/dev/race', {
    method: 'POST',
    body: JSON.stringify({ eventId, seatId, attempts }),
    signal
  })
}

/**
 * Dev-only race reset: POST /dev/race/reset
 */
export function resetDevRace({ eventId, seatId }, signal) {
  return request('/dev/race/reset', {
    method: 'POST',
    body: JSON.stringify({ eventId, seatId }),
    signal
  })
}

/**
 * Dev-only active seat lock count check: GET /dev/race/check
 */
export function checkDevRaceSeat(seatId, signal) {
  return request(`/dev/race/check?seatId=${seatId}`, {
    method: 'GET',
    signal
  })
}

export default {
  ApiError,
  setUnauthorizedHandler,
  request,
  register,
  login,
  me,
  getEvents,
  getEvent,
  getSeats,
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  runDevRace,
  resetDevRace,
  checkDevRaceSeat
}

