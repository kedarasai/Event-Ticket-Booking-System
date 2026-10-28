import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Seat3D } from './Seat3D'
import { MaximizeIcon, MinimizeIcon } from '../ui/Icons'

// Orbit Clamping Limits per docs/DESIGN.md
const TILT_MIN = 35
const TILT_MAX = 65
const TILT_DEFAULT = 52

const YAW_MIN = -35
const YAW_MAX = 35
const YAW_DEFAULT = 0

const ZOOM_MIN = 0.7
const ZOOM_MAX = 1.4
const ZOOM_DEFAULT = 1.0

// Intro animation initial values (eases to defaults over 1.2s)
const INTRO_START_TILT = 72
const INTRO_START_YAW = -20
const INTRO_DURATION_MS = 1200

const DRAG_THRESHOLD_PX = 4

/**
 * SeatMap3D
 * Hardware-accelerated CSS 3D amphitheater seat map with pointer-driven orbit,
 * momentum inertia, zoom controls, tiered elevation, glowing stage, 3D row labels,
 * atmospheric light cones, dust particles, glass tooltip, and fullscreen mode.
 *
 * Rules:
 * - Direct CSS variables (--tilt, --yaw, --zoom) written on scene via requestAnimationFrame.
 * - ZERO React state updates during drag for 60fps performance.
 * - Pointer drag threshold < 4px allows seat clicking; >= 4px blocks seat click.
 * - Preserves preserve-3d chain without any flattening properties on ancestors.
 */
export function SeatMap3D({
  layout = { rows: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } },
  selectedIds = new Set(),
  pulsingSeatIds = new Set(),
  onToggle = () => {},
  disabled = false,
  price = 0
}) {
  const rows = useMemo(() => layout?.rows || [], [layout?.rows])

  // Default focus to first available seat
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

  // UI state for tips fade, fullscreen toggle, and touch badge
  const [hasInteracted, setHasInteracted] = useState(false)
  const isInteractedRef = useRef(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [touchTapBadge, setTouchTapBadge] = useState(null)
  const touchBadgeTimerRef = useRef(null)
  const tipsTimerRef = useRef(null)

  // Format price for screen reader labels & tooltip
  const formattedPrice = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0
      }).format(Number(price) || 0)
    } catch {
      return String(Math.round(Number(price) || 0))
    }
  }, [price])

  // DOM Refs
  const viewportRef = useRef(null)
  const sceneRef = useRef(null)
  const seatRefs = useRef({})
  const tooltipRef = useRef(null)
  const hoveredSeatRef = useRef(null)

  // Orbit Tracking Refs (ZERO React state during interaction)
  const defaultTilt = layout?.camera?.defaultTilt ?? TILT_DEFAULT
  const defaultYaw = layout?.camera?.defaultYaw ?? YAW_DEFAULT
  const defaultZoom = layout?.camera?.defaultZoom ?? ZOOM_DEFAULT

  const tiltRef = useRef(defaultTilt)
  const yawRef = useRef(defaultYaw)
  const zoomRef = useRef(defaultZoom)

  const isPointerDownRef = useRef(false)
  const isDraggingRef = useRef(false)
  const dragDistRef = useRef(0)
  const startPosRef = useRef({ x: 0, y: 0 })
  const lastPosRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ vx: 0, vy: 0 })
  const inertiaRafRef = useRef(null)
  const introRafRef = useRef(null)
  const touchDirectionRef = useRef(null) // 'h' (rotate) or 'v' (scroll)
  const resetTimerRef = useRef(null)

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

  // Writes CSS variables directly to sceneRef in rAF
  const applyTransforms = useCallback((tilt, yaw, zoom) => {
    if (!sceneRef.current) return
    sceneRef.current.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`)
    sceneRef.current.style.setProperty('--yaw', `${yaw.toFixed(2)}deg`)
    sceneRef.current.style.setProperty('--zoom', `${zoom.toFixed(2)}`)
  }, [])

  // Adapt camera framing when layout changes
  useEffect(() => {
    if (layout?.camera) {
      tiltRef.current = layout.camera.defaultTilt ?? TILT_DEFAULT
      yawRef.current = layout.camera.defaultYaw ?? YAW_DEFAULT
      zoomRef.current = layout.camera.defaultZoom ?? ZOOM_DEFAULT
      applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)
    }
  }, [layout?.camera, applyTransforms])

  // Mark first interaction to cancel intro and fade tips
  const markInteracted = useCallback(() => {
    if (!isInteractedRef.current) {
      isInteractedRef.current = true
      setHasInteracted(true)
    }
    if (introRafRef.current) {
      cancelAnimationFrame(introRafRef.current)
      introRafRef.current = null
    }
  }, [])

  // Auto-fade tips after 6 seconds
  useEffect(() => {
    tipsTimerRef.current = setTimeout(() => {
      markInteracted()
    }, 6000)
    return () => {
      if (tipsTimerRef.current) clearTimeout(tipsTimerRef.current)
    }
  }, [markInteracted])

  // Intro Animation: eases from tilt 72deg / yaw -20deg to defaults over 1.2s on first load
  useEffect(() => {
    if (prefersReducedMotionRef.current) {
      applyTransforms(TILT_DEFAULT, YAW_DEFAULT, ZOOM_DEFAULT)
      return
    }

    tiltRef.current = INTRO_START_TILT
    yawRef.current = INTRO_START_YAW
    zoomRef.current = ZOOM_DEFAULT
    applyTransforms(INTRO_START_TILT, INTRO_START_YAW, ZOOM_DEFAULT)

    const startTime = performance.now()
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4)

    const runIntro = (now) => {
      if (isInteractedRef.current) return
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / INTRO_DURATION_MS)
      const eased = easeOutQuart(progress)

      tiltRef.current = INTRO_START_TILT + (TILT_DEFAULT - INTRO_START_TILT) * eased
      yawRef.current = INTRO_START_YAW + (YAW_DEFAULT - INTRO_START_YAW) * eased

      applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)

      if (progress < 1) {
        introRafRef.current = requestAnimationFrame(runIntro)
      } else {
        introRafRef.current = null
      }
    }

    introRafRef.current = requestAnimationFrame(runIntro)

    return () => {
      if (introRafRef.current) {
        cancelAnimationFrame(introRafRef.current)
        introRafRef.current = null
      }
    }
  }, [applyTransforms])

  // Fullscreen Esc key handler
  useEffect(() => {
    if (!isFullscreen) return
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isFullscreen])

  // Tooltip position updater (Direct transform without React renders)
  const updateTooltipPos = useCallback((clientX, clientY) => {
    if (!tooltipRef.current || !viewportRef.current) return
    const rect = viewportRef.current.getBoundingClientRect()
    let x = clientX - rect.left + 14
    let y = clientY - rect.top - 38

    // Clamp within viewport
    x = Math.max(12, Math.min(rect.width - 220, x))
    y = Math.max(12, Math.min(rect.height - 40, y))

    tooltipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }, [])

  // Floating glass tooltip on seat hover (Desktop)
  const handleSeatPointerEnter = useCallback((seat, e) => {
    if (isDraggingRef.current || !tooltipRef.current) return
    hoveredSeatRef.current = seat
    const status = String(seat.status || '').toLowerCase()
    const isBooked = status === 'booked' || seat.isBooked
    const isSelected = selectedIds.has(seat.seatId || seat.id)
    const statusLabel = isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'
    const statusClass = isBooked ? 'tt-booked' : isSelected ? 'tt-selected' : 'tt-available'

    const sectionPrefix = seat.section ? `${seat.section} • ` : ''
    const seatPrice = seat.price !== undefined && seat.price !== null ? seat.price : price
    const formattedSeatPrice = Number(seatPrice).toLocaleString('en-IN')
    const tierBadge = seat.tier
      ? `<span class="seat-3d-tt-tier tier-${seat.tier.toLowerCase()}">${seat.tier}</span><span class="seat-3d-tt-divider">|</span>`
      : ''

    tooltipRef.current.innerHTML = `
      <span class="seat-3d-tt-seat">${sectionPrefix}Seat ${seat.seatNumber}</span>
      <span class="seat-3d-tt-divider">|</span>
      ${tierBadge}
      <span class="seat-3d-tt-price">₹${formattedSeatPrice}</span>
      <span class="seat-3d-tt-divider">|</span>
      <span class="seat-3d-tt-status ${statusClass}">${statusLabel}</span>
    `
    tooltipRef.current.style.display = 'inline-flex'
    if (e && typeof e.clientX === 'number' && e.clientX > 0) {
      updateTooltipPos(e.clientX, e.clientY)
    } else {
      const seatEl = seatRefs.current[seat.seatId || seat.id]
      if (seatEl) {
        const r = seatEl.getBoundingClientRect()
        updateTooltipPos(r.x + r.width / 2, r.y)
      }
    }
  }, [selectedIds, price, updateTooltipPos])

  const handleSeatPointerLeave = useCallback(() => {
    hoveredSeatRef.current = null
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none'
    }
  }, [])

  // Flattened seat array for directional navigation
  const allSeats = useMemo(() => {
    return rows.flatMap((r) => r.seats)
  }, [rows])

  // Handle arrow key roving tabIndex navigation with spatial direction
  const handleSeatKeyDown = (e, currentSeat) => {
    const cx = currentSeat.pos.x
    const cy = currentSeat.pos.y

    let targetSeat = null

    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault()
        const candidates = allSeats.filter((s) => s.pos.x > cx + 4)
        if (candidates.length > 0) {
          targetSeat = candidates.reduce((best, s) => {
            const dx = s.pos.x - cx
            const dy = s.pos.y - cy
            const dist = dx * dx + dy * dy * 2.2
            const bestDist = (best.pos.x - cx) ** 2 + (best.pos.y - cy) ** 2 * 2.2
            return dist < bestDist ? s : best
          })
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const candidates = allSeats.filter((s) => s.pos.x < cx - 4)
        if (candidates.length > 0) {
          targetSeat = candidates.reduce((best, s) => {
            const dx = cx - s.pos.x
            const dy = s.pos.y - cy
            const dist = dx * dx + dy * dy * 2.2
            const bestDist = (cx - best.pos.x) ** 2 + (best.pos.y - cy) ** 2 * 2.2
            return dist < bestDist ? s : best
          })
        }
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        const candidates = allSeats.filter((s) => s.pos.y > cy + 4)
        if (candidates.length > 0) {
          targetSeat = candidates.reduce((best, s) => {
            const dx = s.pos.x - cx
            const dy = s.pos.y - cy
            const dist = dx * dx * 2.2 + dy * dy
            const bestDist = (best.pos.x - cx) ** 2 * 2.2 + (best.pos.y - cy) ** 2
            return dist < bestDist ? s : best
          })
        }
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const candidates = allSeats.filter((s) => s.pos.y < cy - 4)
        if (candidates.length > 0) {
          targetSeat = candidates.reduce((best, s) => {
            const dx = s.pos.x - cx
            const dy = cy - s.pos.y
            const dist = dx * dx * 2.2 + dy * dy
            const bestDist = (best.pos.x - cx) ** 2 * 2.2 + (cy - best.pos.y) ** 2
            return dist < bestDist ? s : best
          })
        }
        break
      }
      case ' ':
      case 'Enter': {
        e.preventDefault()
        if (String(currentSeat.status || '').toLowerCase() !== 'booked' && !disabled) {
          markInteracted()
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

  // Pointer Down on Viewport: Begin Drag Tracking
  const handlePointerDown = (e) => {
    if (e.button !== 0) return

    markInteracted()

    // Hide tooltip when interaction begins
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none'
    }

    // Cancel inertia animation if active
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current)
      inertiaRafRef.current = null
    }

    isPointerDownRef.current = true
    isDraggingRef.current = false
    dragDistRef.current = 0
    startPosRef.current = { x: e.clientX, y: e.clientY }
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    velocityRef.current = { vx: 0, vy: 0 }
    touchDirectionRef.current = null
  }

  // Pointer Move on Viewport: Calculate Orbit & Inertia Velocity
  const handlePointerMove = (e) => {
    const clientX = e.clientX
    const clientY = e.clientY

    // Update floating tooltip position when not dragging
    if (!isDraggingRef.current && hoveredSeatRef.current && tooltipRef.current) {
      updateTooltipPos(clientX, clientY)
    }

    if (!isPointerDownRef.current) return

    const totalDx = clientX - startPosRef.current.x
    const totalDy = clientY - startPosRef.current.y
    const totalDist = Math.hypot(totalDx, totalDy)
    dragDistRef.current = totalDist

    // Touch disambiguation: horizontal drags rotate, vertical drags scroll
    if (e.pointerType === 'touch') {
      if (!touchDirectionRef.current && totalDist >= DRAG_THRESHOLD_PX) {
        if (Math.abs(totalDy) > Math.abs(totalDx)) {
          touchDirectionRef.current = 'v' // Vertical scroll
          isPointerDownRef.current = false
          return
        } else {
          touchDirectionRef.current = 'h' // Horizontal rotate
        }
      }

      if (touchDirectionRef.current === 'v') {
        return
      }

      if (touchDirectionRef.current === 'h' && e.cancelable) {
        e.preventDefault()
      }
    }

    // Exceeded threshold: mark as active drag
    if (totalDist >= DRAG_THRESHOLD_PX) {
      if (!isDraggingRef.current) {
        isDraggingRef.current = true
        viewportRef.current?.classList.add('is-dragging')
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'none'
        }
        if (e.currentTarget && e.pointerId !== undefined) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // Safe fallback
          }
        }
      }

      const dx = clientX - lastPosRef.current.x
      const dy = clientY - lastPosRef.current.y

      // Calculate instantaneous velocity for inertia
      velocityRef.current = {
        vx: dx * 0.28,
        vy: dy * 0.22
      }

      // Update yaw & tilt
      if (touchDirectionRef.current === 'h') {
        // On touch horizontal: only rotate yaw
        yawRef.current = Math.max(YAW_MIN, Math.min(YAW_MAX, yawRef.current + dx * 0.25))
      } else {
        yawRef.current = Math.max(YAW_MIN, Math.min(YAW_MAX, yawRef.current + dx * 0.25))
        tiltRef.current = Math.max(TILT_MIN, Math.min(TILT_MAX, tiltRef.current - dy * 0.2))
      }

      lastPosRef.current = { x: clientX, y: clientY }
      applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)
    }
  }

  // Pointer Up: Release and Trigger Inertia Easing
  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    viewportRef.current?.classList.remove('is-dragging')

    if (e.currentTarget && e.pointerId !== undefined && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Safe fallback
      }
    }

    const wasDragging = isDraggingRef.current

    // Run momentum inertia easing if pointer was dragged and reduced motion is disabled
    if (wasDragging && !prefersReducedMotionRef.current) {
      const runInertia = () => {
        let { vx, vy } = velocityRef.current

        // Friction dampening
        vx *= 0.9
        vy *= 0.9

        velocityRef.current = { vx, vy }

        if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) {
          inertiaRafRef.current = null
          return
        }

        yawRef.current = Math.max(YAW_MIN, Math.min(YAW_MAX, yawRef.current + vx))
        if (touchDirectionRef.current !== 'h') {
          tiltRef.current = Math.max(TILT_MIN, Math.min(TILT_MAX, tiltRef.current - vy))
        }

        applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)

        // Stop if limits hit
        const atYawLimit = yawRef.current === YAW_MIN || yawRef.current === YAW_MAX
        const atTiltLimit = tiltRef.current === TILT_MIN || tiltRef.current === TILT_MAX
        if (atYawLimit && atTiltLimit) {
          inertiaRafRef.current = null
          return
        }

        inertiaRafRef.current = requestAnimationFrame(runInertia)
      }

      inertiaRafRef.current = requestAnimationFrame(runInertia)
    }

    if (wasDragging) {
      setTimeout(() => {
        isDraggingRef.current = false
        dragDistRef.current = 0
      }, 40)
    } else {
      isDraggingRef.current = false
      dragDistRef.current = 0
    }
  }

  // Seat toggle handler: ignores clicks if drag exceeded threshold
  const handleSeatToggle = useCallback((seat, isTouch = false) => {
    markInteracted()
    if (disabled || isDraggingRef.current) {
      return
    }

    // On touch devices or small screens: show small glass tap label
    const isTouchDevice = isTouch || (typeof window !== 'undefined' && (window.innerWidth <= 768 || window.matchMedia?.('(pointer: coarse)')?.matches))
    if (isTouchDevice) {
      const status = String(seat.status || '').toLowerCase()
      const isBooked = status === 'booked' || seat.isBooked
      const isSelected = selectedIds.has(seat.seatId || seat.id)
      const nextStatus = isBooked ? 'Booked' : isSelected ? 'Available' : 'Selected'

      const seatPrice = seat.price !== undefined && seat.price !== null ? seat.price : price
      const formattedSeatPrice = Number(seatPrice).toLocaleString('en-IN')
      const tierPrefix = seat.tier ? `${seat.tier} • ` : ''

      setTouchTapBadge({
        text: `${tierPrefix}Seat ${seat.seatNumber} | ₹${formattedSeatPrice} | ${nextStatus}`
      })
      if (touchBadgeTimerRef.current) clearTimeout(touchBadgeTimerRef.current)
      touchBadgeTimerRef.current = setTimeout(() => {
        setTouchTapBadge(null)
      }, 2500)
    }

    onToggle(seat)
  }, [disabled, selectedIds, price, markInteracted, onToggle])

  // Zoom controls
  const handleZoomIn = () => {
    markInteracted()
    zoomRef.current = Math.min(ZOOM_MAX, Number((zoomRef.current + 0.1).toFixed(2)))
    applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)
  }

  const handleZoomOut = () => {
    markInteracted()
    zoomRef.current = Math.max(ZOOM_MIN, Number((zoomRef.current - 0.1).toFixed(2)))
    applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)
  }

  const handleResetView = () => {
    markInteracted()
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current)

    sceneRef.current?.classList.add('is-animating')
    tiltRef.current = TILT_DEFAULT
    yawRef.current = YAW_DEFAULT
    zoomRef.current = ZOOM_DEFAULT
    applyTransforms(TILT_DEFAULT, YAW_DEFAULT, ZOOM_DEFAULT)

    resetTimerRef.current = setTimeout(() => {
      sceneRef.current?.classList.remove('is-animating')
    }, 600)
  }

  // Wheel zoom handling (Ctrl+wheel or mousewheel on viewport)
  const handleWheel = (e) => {
    e.preventDefault()
    markInteracted()
    const delta = -e.deltaY * 0.0012
    zoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number((zoomRef.current + delta).toFixed(2))))
    applyTransforms(tiltRef.current, yawRef.current, zoomRef.current)
  }

  // Viewport keyboard zoom and reset shortcuts
  const handleViewportKeyDown = (e) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      handleZoomIn()
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      handleZoomOut()
    } else if (e.key === '0') {
      e.preventDefault()
      handleResetView()
    }
  }

  // Subtle floating dust particles in atmosphere (<= 20, transform only)
  const dustParticles = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: `${(10 + (i * 6.3) % 80).toFixed(1)}%`,
      top: `${(15 + (i * 7.7) % 70).toFixed(1)}%`,
      size: `${2 + (i % 3)}px`,
      delay: `${-(i * 0.8).toFixed(1)}s`,
      duration: `${(7 + (i % 5) * 2).toFixed(1)}s`,
      opacity: (0.2 + (i % 4) * 0.1).toFixed(2)
    }))
  }, [])

  // Clean up all timers and animation frames on unmount
  useEffect(() => {
    return () => {
      if (introRafRef.current) cancelAnimationFrame(introRafRef.current)
      if (inertiaRafRef.current) cancelAnimationFrame(inertiaRafRef.current)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      if (touchBadgeTimerRef.current) clearTimeout(touchBadgeTimerRef.current)
      if (tipsTimerRef.current) clearTimeout(tipsTimerRef.current)
    }
  }, [])

  // Extract decor & section plates
  const decorItems = useMemo(() => layout?.decor || [], [layout?.decor])

  // Grounded support plates for sections
  const sectionPlates = useMemo(() => {
    if (!layout?.sections || layout.sections.length <= 1) return []

    return layout.sections
      .map((sec) => {
        const secSeats = sec.seats || []
        if (secSeats.length === 0) return null

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity
        for (const s of secSeats) {
          if (s.pos.x < minX) minX = s.pos.x
          if (s.pos.x > maxX) maxX = s.pos.x
          if (s.pos.y < minY) minY = s.pos.y
          if (s.pos.y > maxY) maxY = s.pos.y
          if (s.pos.z < minZ) minZ = s.pos.z
        }

        const padX = 22
        const padY = 18
        const width = (maxX - minX) + padX * 2
        const height = (maxY - minY) + padY * 2

        return {
          name: sec.name,
          x: Number((minX - padX).toFixed(1)),
          y: Number((minY - padY).toFixed(1)),
          width: Number(width.toFixed(1)),
          height: Number(height.toFixed(1)),
          z: Number((minZ - 3).toFixed(1)),
          titleX: Number(((minX + maxX) / 2).toFixed(1)),
          titleY: Number((minY - padY - 8).toFixed(1)),
          titleZ: Number(minZ.toFixed(1))
        }
      })
      .filter(Boolean)
  }, [layout])

  // Table disks for comedy club tables
  const tableDisks = useMemo(() => {
    const seats = layout?.seats || []
    const tablesMap = new Map()

    for (const s of seats) {
      if (s.section === 'Tables' && s.row && s.row.startsWith('T')) {
        if (!tablesMap.has(s.row)) {
          tablesMap.set(s.row, [])
        }
        tablesMap.get(s.row).push(s)
      }
    }

    return Array.from(tablesMap.entries()).map(([tableId, tSeats]) => {
      const avgX = tSeats.reduce((sum, s) => sum + s.pos.x, 0) / tSeats.length
      const avgY = tSeats.reduce((sum, s) => sum + s.pos.y, 0) / tSeats.length
      const avgZ = tSeats.reduce((sum, s) => sum + s.pos.z, 0) / tSeats.length
      return {
        id: tableId,
        x: Number(avgX.toFixed(1)),
        y: Number(avgY.toFixed(1)),
        z: Number((avgZ - 2).toFixed(1)),
        radius: 26
      }
    })
  }, [layout?.seats])

  return (
    <div className="seat-map-3d-root">
      {/* Perspective Viewport (touch-action: pan-y, cursor: grab) */}
      <div
        ref={viewportRef}
        className={`seat-map-3d-viewport ${isFullscreen ? 'is-fullscreen' : ''}`.trim()}
        tabIndex={0}
        role="region"
        aria-label="3D Interactive Auditorium Seat Map. Drag to orbit, +/- to zoom, Tab to navigate seats."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleViewportKeyDown}
      >
        {/* Atmosphere 1: Soft Vignette Overlay (Outside 3D chain) */}
        <div className="seat-3d-vignette" aria-hidden="true" />

        {/* Atmosphere 2: Floating Dust Particles (Transform only) */}
        <div className="seat-3d-particles" aria-hidden="true">
          {dustParticles.map((p) => (
            <span
              key={p.id}
              className="seat-3d-dust"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration
              }}
            />
          ))}
        </div>

        {/* Floating HUD Controls (Zoom, Reset View & Fullscreen) */}
        <div className="seat-3d-hud" role="toolbar" aria-label="3D Camera Controls">
          <div className="seat-3d-hud-btn-group">
            <button
              type="button"
              className="seat-3d-hud-btn"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              title="Zoom In (+)"
            >
              +
            </button>
            <button
              type="button"
              className="seat-3d-hud-btn"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              title="Zoom Out (-)"
            >
              −
            </button>
            <button
              type="button"
              className="seat-3d-hud-btn"
              onClick={() => {
                markInteracted()
                setIsFullscreen((prev) => !prev)
              }}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
            >
              {isFullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
            </button>
          </div>
          <button
            type="button"
            className="seat-3d-reset-btn"
            onClick={handleResetView}
            aria-label="Reset 3D camera view"
            title="Reset View (0)"
          >
            Reset View
          </button>
        </div>

        {/* Tips Line: Fades after first interaction */}
        <div className={`seat-3d-tips ${hasInteracted ? 'is-faded' : ''}`.trim()} aria-hidden="true">
          <span>Drag to rotate</span>
          <span className="seat-3d-tips-dot">•</span>
          <span>Ctrl+scroll or +/- to zoom</span>
          <span className="seat-3d-tips-dot">•</span>
          <span>Click a seat</span>
        </div>

        {/* Compact Legend (VIP, Premium, Standard, Economy, Selected, Booked) */}
        <div className="seat-3d-legend" aria-hidden="true">
          <div className="seat-3d-legend-item">
            <span className="seat-3d-legend-dot dot-vip" />
            <span>VIP</span>
          </div>
          <div className="seat-3d-legend-item">
            <span className="seat-3d-legend-dot dot-premium" />
            <span>Premium</span>
          </div>
          <div className="seat-3d-legend-item">
            <span className="seat-3d-legend-dot dot-standard" />
            <span>Standard</span>
          </div>
          <div className="seat-3d-legend-item">
            <span className="seat-3d-legend-dot dot-economy" />
            <span>Economy</span>
          </div>
          <div className="seat-3d-legend-item">
            <span className="seat-3d-legend-dot dot-selected" />
            <span>Selected</span>
          </div>
          <div className="seat-3d-legend-item">
            <span className="seat-3d-legend-dot dot-booked" />
            <span>Booked</span>
          </div>
        </div>

        {/* Floating Glass Tooltip for Pointer Hover (Desktop) */}
        <div
          ref={tooltipRef}
          className="seat-3d-tooltip"
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {/* Touch Tap Floating Badge (Mobile) */}
        {touchTapBadge && (
          <div className="seat-3d-touch-badge" aria-live="polite">
            {touchTapBadge.text}
          </div>
        )}

        {/* 3D Scene: preserve-3d, rotated by CSS variables */}
        <div ref={sceneRef} className="seat-map-3d-scene">
          {/* 1. Floor Plane with perspective grid & subtle glossy reflections */}
          <div className="seat-3d-floor" aria-hidden="true" />

          {/* 2. Venue-Specific 3D Architectural Decor */}
          {decorItems.map((d, dIdx) => {
            if (d.type === 'pitch') {
              return (
                <div
                  key={dIdx}
                  className="seat-3d-pitch"
                  style={{
                    transform: `translate3d(${d.x - d.width / 2}px, ${d.y - d.height / 2}px, ${d.z || 0}px)`,
                    width: `${d.width}px`,
                    height: `${d.height}px`
                  }}
                  role="region"
                  aria-label="Stadium Arena Pitch"
                >
                  <div className="seat-3d-pitch-halfway" />
                  <div className="seat-3d-pitch-circle" />
                </div>
              )
            }
            if (d.type === 'floodlight') {
              return (
                <div
                  key={dIdx}
                  className="seat-3d-floodlight"
                  style={{
                    transform: `translate3d(${d.x - 7}px, ${d.y - 7}px, ${d.z || 80}px)`
                  }}
                  aria-hidden="true"
                />
              )
            }
            if (d.type === 'stage') {
              return (
                <div
                  key={dIdx}
                  className="seat-3d-stage"
                  style={{
                    transform: `translate3d(${d.x - d.width / 2}px, ${d.y}px, ${d.z || 0}px)`,
                    width: `${d.width}px`,
                    height: `${d.height}px`
                  }}
                  role="region"
                  aria-label={d.label || 'Stage'}
                >
                  <div className="seat-3d-stage-top">
                    <span className="seat-3d-stage-text">{d.label || 'STAGE'}</span>
                  </div>
                  <div className="seat-3d-stage-beam" aria-hidden="true" />
                  {d.beams && (
                    <div className="seat-3d-beams-fan" aria-hidden="true">
                      <div className="seat-3d-beam beam-left" />
                      <div className="seat-3d-beam beam-center" />
                      <div className="seat-3d-beam beam-right" />
                    </div>
                  )}
                  {d.hasCatwalk && (
                    <div
                      className="seat-3d-catwalk"
                      style={{
                        height: `${d.catwalkLength || 80}px`,
                        transform: `translate3d(${d.width / 2 - 14}px, ${d.height}px, 0)`
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {d.hasScreen && (
                    <div
                      className="seat-3d-screen"
                      style={{
                        transform: `translate3d(20px, -45px, 12px)`,
                        width: `${d.width - 40}px`,
                        height: '38px'
                      }}
                      aria-hidden="true"
                    >
                      <span className="seat-3d-screen-text">NEXTGEN 2026 KEYNOTE</span>
                    </div>
                  )}
                  {d.hasMicStand && (
                    <>
                      <div
                        className="seat-3d-spotlight-ring"
                        style={{
                          transform: `translate3d(${d.width / 2}px, ${d.height + 25}px, 2px)`
                        }}
                        aria-hidden="true"
                      />
                      <div
                        className="seat-3d-mic-stand"
                        style={{
                          transform: `translate3d(${d.width / 2 - 3}px, ${d.height + 25}px, 16px)`
                        }}
                        aria-hidden="true"
                      />
                    </>
                  )}
                </div>
              )
            }
            if (d.type === 'barCounter') {
              return (
                <div
                  key={dIdx}
                  className="seat-3d-bar-counter"
                  style={{
                    transform: `translate3d(${d.x - d.width / 2}px, ${d.y}px, ${d.z || 12}px)`,
                    width: `${d.width}px`,
                    height: `${d.height}px`
                  }}
                  aria-hidden="true"
                >
                  <span className="seat-3d-bar-text">BAR & DRINKS</span>
                </div>
              )
            }
            if (d.type === 'boxBalcony') {
              return (
                <div
                  key={dIdx}
                  className="seat-3d-box-balcony"
                  style={{
                    transform: `translate3d(${d.x - d.width / 2}px, ${d.y}px, ${d.z || 40}px)`,
                    width: `${d.width}px`,
                    height: `${d.height}px`
                  }}
                  aria-hidden="true"
                />
              )
            }
            if (d.type === 'festivalTent') {
              return (
                <div
                  key={dIdx}
                  className="seat-3d-festival-tent"
                  style={{
                    transform: `translate3d(${d.x - 25}px, ${d.y}px, ${d.z || 8}px)`
                  }}
                  aria-hidden="true"
                >
                  {d.label}
                </div>
              )
            }
            return null
          })}

          {/* Fallback default stage if no decor provided */}
          {decorItems.length === 0 && (
            <div className="seat-3d-stage" role="region" aria-label="Stage">
              <div className="seat-3d-stage-top">
                <span className="seat-3d-stage-text">STAGE</span>
              </div>
              <div className="seat-3d-stage-beam" aria-hidden="true" />
              <div className="seat-3d-beams-fan" aria-hidden="true">
                <div className="seat-3d-beam beam-left" />
                <div className="seat-3d-beam beam-center" />
                <div className="seat-3d-beam beam-right" />
              </div>
            </div>
          )}

          {/* 3. Section Plates & Titles */}
          <div className="seat-3d-plates-layer">
            {sectionPlates.map((sp) => (
              <div
                key={sp.name}
                className="seat-3d-section-plate"
                style={{
                  transform: `translate3d(${sp.x}px, ${sp.y}px, ${sp.z}px)`,
                  width: `${sp.width}px`,
                  height: `${sp.height}px`
                }}
                aria-hidden="true"
              >
                <div
                  className="seat-3d-section-title"
                  style={{
                    transform: `translate3d(${sp.width / 2}px, -12px, 2px) translateX(-50%)`
                  }}
                >
                  {sp.name}
                </div>
              </div>
            ))}

            {/* Table Disks for Comedy Club */}
            {tableDisks.map((tb) => (
              <div
                key={tb.id}
                className="seat-3d-table-disk"
                style={{
                  transform: `translate3d(${tb.x - tb.radius}px, ${tb.y - tb.radius}px, ${tb.z}px)`,
                  width: `${tb.radius * 2}px`,
                  height: `${tb.radius * 2}px`
                }}
                aria-hidden="true"
              >
                <span className="seat-3d-table-label">{tb.id}</span>
              </div>
            ))}
          </div>

          {/* 4. Seats Layer (All ancestors maintain transform-style: preserve-3d) */}
          <div className="seat-3d-seats-layer">
            {rows.map((row) => {
              const firstSeat = row.seats[0]
              const lastSeat = row.seats[row.seats.length - 1]

              return (
                <div key={row.label} style={{ transformStyle: 'preserve-3d' }}>
                  {/* Left Row Label: Counter-rotates against scene yaw to always face viewer */}
                  {firstSeat && (
                    <div
                      className="seat-3d-row-label"
                      style={{
                        transform: `translate3d(${firstSeat.pos.x - 34}px, ${firstSeat.pos.y}px, ${firstSeat.pos.z}px) rotateZ(${firstSeat.pos.angleDeg}deg)`
                      }}
                      aria-hidden="true"
                    >
                      <span className="seat-3d-row-label-text">
                        {row.label}
                      </span>
                    </div>
                  )}

                  {/* Seats in Row */}
                  {row.seats.map((seat) => {
                    const id = seat.seatId || seat.id
                    const isSelected = selectedIds.has(id)
                    const isBooked = String(seat.status || '').toLowerCase() === 'booked'
                    const isPulsing = pulsingSeatIds?.has(id)
                    const isFocused = id === focusedSeatId

                    return (
                      <Seat3D
                        key={id}
                        seat={seat}
                        isSelected={isSelected}
                        isBooked={isBooked}
                        isPulsing={isPulsing}
                        isFocused={isFocused}
                        disabled={disabled}
                        formattedPrice={formattedPrice}
                        buttonRef={(el) => {
                          if (el) seatRefs.current[id] = el
                          else delete seatRefs.current[id]
                        }}
                        onToggle={(s) => handleSeatToggle(s, false)}
                        onPointerEnter={handleSeatPointerEnter}
                        onPointerLeave={handleSeatPointerLeave}
                        onFocus={setUserFocusedSeatId}
                        onKeyDown={handleSeatKeyDown}
                      />
                    )
                  })}

                  {/* Right Row Label: Counter-rotates against scene yaw */}
                  {lastSeat && (
                    <div
                      className="seat-3d-row-label"
                      style={{
                        transform: `translate3d(${lastSeat.pos.x + 34}px, ${lastSeat.pos.y}px, ${lastSeat.pos.z}px) rotateZ(${lastSeat.pos.angleDeg}deg)`
                      }}
                      aria-hidden="true"
                    >
                      <span className="seat-3d-row-label-text">
                        {row.label}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeatMap3D
