import { useEffect, useRef, useState, useMemo } from 'react'
import { TicketIcon } from '../ui/Icons'

export function HeroScene() {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const wrapperRef = useRef(null)

  const [isPaused, setIsPaused] = useState(false)

  // Layout & tilt tracking refs (ZERO layout reads in rAF loop)
  const rectRef = useRef({ left: 0, top: 0, width: 1, height: 1 })
  const targetTilt = useRef({ x: 0, y: 0 })
  const currentTilt = useRef({ x: 0, y: 0 })
  const rafId = useRef(null)
  const isLoopRunning = useRef(false)

  // 16 small floating particles generated once with useMemo
  const particles = useMemo(() => [
    { id: 1, size: 4, x: -130, y: -90, z: 70, duration: 5.2, delay: 0, color: 'var(--accent-cyan)' },
    { id: 2, size: 6, x: 140, y: -110, z: -80, duration: 6.4, delay: -1.2, color: 'var(--accent-violet)' },
    { id: 3, size: 5, x: -90, y: 80, z: 130, duration: 4.8, delay: -0.5, color: 'var(--gold)' },
    { id: 4, size: 7, x: 110, y: 95, z: 60, duration: 5.8, delay: -2.1, color: 'var(--accent-cyan)' },
    { id: 5, size: 3, x: -170, y: 10, z: -40, duration: 6.8, delay: -1.8, color: 'var(--success)' },
    { id: 6, size: 5, x: 160, y: -20, z: 140, duration: 5.0, delay: -0.9, color: 'var(--accent-violet)' },
    { id: 7, size: 4, x: -40, y: -130, z: -100, duration: 7.2, delay: -3.0, color: 'var(--accent-cyan)' },
    { id: 8, size: 6, x: 50, y: 130, z: -50, duration: 6.0, delay: -1.5, color: 'var(--gold)' },
    { id: 9, size: 4, x: -110, y: -40, z: 90, duration: 4.6, delay: -2.4, color: 'var(--accent-cyan)' },
    { id: 10, size: 5, x: 90, y: -70, z: 110, duration: 5.6, delay: -0.7, color: 'var(--accent-violet)' },
    { id: 11, size: 3, x: -60, y: 110, z: 30, duration: 6.5, delay: -1.9, color: 'var(--success)' },
    { id: 12, size: 7, x: 70, y: -130, z: 40, duration: 5.4, delay: -2.7, color: 'var(--gold)' },
    { id: 13, size: 4, x: -150, y: 60, z: -90, duration: 7.0, delay: -0.4, color: 'var(--accent-cyan)' },
    { id: 14, size: 6, x: 130, y: 40, z: -120, duration: 6.2, delay: -1.6, color: 'var(--accent-violet)' },
    { id: 15, size: 4, x: -20, y: -80, z: 150, duration: 4.9, delay: -2.2, color: 'var(--gold)' },
    { id: 16, size: 5, x: 20, y: 70, z: 80, duration: 5.7, delay: -1.1, color: 'var(--accent-cyan)' },
  ], [])

  // Parallax Pointer & Intersection Observer
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isMobile = window.innerWidth < 768

    // IntersectionObserver to pause CSS animations and rAF loop when scrolled out of view
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPaused(!entry.isIntersecting)
      },
      { threshold: 0.05 }
    )

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current)
    }

    // Skip pointer parallax listeners if reduced motion, touch, or mobile
    if (prefersReducedMotion || isTouch || isMobile) {
      return () => {
        observer.disconnect()
        if (rafId.current) cancelAnimationFrame(rafId.current)
      }
    }

    const container = containerRef.current
    if (!container) {
      return () => {
        observer.disconnect()
      }
    }

    // Cache bounding client rect on resize or pointerenter (never inside rAF!)
    const updateRect = () => {
      if (containerRef.current) {
        rectRef.current = containerRef.current.getBoundingClientRect()
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect, { passive: true })

    const animateTilt = () => {
      // Smooth lerp toward target angles
      currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * 0.08
      currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * 0.08

      if (stageRef.current) {
        stageRef.current.style.setProperty('--tilt-x', `${currentTilt.current.x.toFixed(2)}deg`)
        stageRef.current.style.setProperty('--tilt-y', `${currentTilt.current.y.toFixed(2)}deg`)
      }

      const dx = Math.abs(targetTilt.current.x - currentTilt.current.x)
      const dy = Math.abs(targetTilt.current.y - currentTilt.current.y)

      if (dx > 0.005 || dy > 0.005) {
        rafId.current = requestAnimationFrame(animateTilt)
      } else {
        isLoopRunning.current = false
      }
    }

    const handlePointerMove = (e) => {
      const rect = rectRef.current
      if (!rect.width || !rect.height) return

      // Normalized coordinates from -1 to +1
      const relX = (e.clientX - rect.left) / rect.width
      const relY = (e.clientY - rect.top) / rect.height
      const normX = Math.max(-1, Math.min(1, (relX - 0.5) * 2))
      const normY = Math.max(-1, Math.min(1, (relY - 0.5) * 2))

      // Max +-10deg tilt
      targetTilt.current.x = -normY * 10
      targetTilt.current.y = normX * 10

      if (!isLoopRunning.current) {
        isLoopRunning.current = true
        rafId.current = requestAnimationFrame(animateTilt)
      }
    }

    const handlePointerEnter = () => {
      updateRect()
    }

    const handlePointerLeave = () => {
      targetTilt.current.x = 0
      targetTilt.current.y = 0
      if (!isLoopRunning.current) {
        isLoopRunning.current = true
        rafId.current = requestAnimationFrame(animateTilt)
      }
    }

    container.addEventListener('pointerenter', handlePointerEnter, { passive: true })
    container.addEventListener('pointermove', handlePointerMove, { passive: true })
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
      container.removeEventListener('pointerenter', handlePointerEnter)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="hero-scene-wrapper">
      {/* Glow Orbs live strictly OUTSIDE the preserve-3d chain so filters do not flatten the 3D scene */}
      <div className="hero-glow-orb hero-glow-orb-violet" aria-hidden="true" />
      <div className="hero-glow-orb hero-glow-orb-cyan" aria-hidden="true" />

      {/* Perspective Container (perspective: 1200px) */}
      <div ref={containerRef} className="hero-scene-perspective" aria-hidden="true">
        {/* Preserve-3D Stage (tilts with pointer via CSS variables --tilt-x, --tilt-y) */}
        <div
          ref={stageRef}
          className={`hero-scene-stage ${isPaused ? 'is-paused' : ''}`}
        >
          {/* (a) Perspective Grid Floor */}
          <div className="hero-grid-floor">
            <div className="hero-grid-surface" />
          </div>

          {/* (b) Three CSS 3D Tickets at different depths and sizes */}

          {/* Ticket 2: Background / Left (translateZ: -90px) */}
          <div className="hero-ticket-slab hero-ticket-2">
            <div className="hero-ticket-face hero-ticket-front">
              <div className="hero-ticket-leaf hero-ticket-leaf-indigo">
                <div className="hero-ticket-header">
                  <span className="hero-ticket-tag">EXP SHOWCASE</span>
                  <span className="hero-ticket-badge">ROW LOCK</span>
                </div>
                <div className="hero-ticket-body">
                  <div className="hero-ticket-title">Neon Horizons</div>
                  <div className="hero-ticket-meta">Nov 07 · 7:30 PM</div>
                </div>
                <div className="hero-ticket-footer">
                  <span className="hero-ticket-seat">SEC VIP · ROW B · SEAT 04</span>
                  <span className="hero-ticket-hash">TF-99120</span>
                </div>
              </div>
            </div>
            <div className="hero-ticket-face hero-ticket-back">
              <div className="hero-ticket-leaf hero-ticket-leaf-back">
                <div className="hero-ticket-back-inner">
                  <TicketIcon size={24} color="var(--accent-violet-light)" />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>TICKETFLOW 3D</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VERIFIED SEAT #99120</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket 1: Center / Primary (translateZ: 60px) */}
          <div className="hero-ticket-slab hero-ticket-1">
            <div className="hero-ticket-face hero-ticket-front">
              <div className="hero-ticket-leaf hero-ticket-leaf-primary">
                <div className="hero-ticket-header">
                  <span className="hero-ticket-tag hero-ticket-tag-cyan">VIP ADMISSION</span>
                  <span className="hero-ticket-badge hero-ticket-badge-gold">STAGE FRONT</span>
                </div>
                <div className="hero-ticket-body">
                  <div className="hero-ticket-title hero-ticket-title-lg">Cyber Symphony 2026</div>
                  <div className="hero-ticket-meta">Tomorrowland Mainstage · Oct 28 · 8:00 PM</div>
                </div>
                <div className="hero-ticket-footer">
                  <span className="hero-ticket-seat hero-ticket-seat-gold">SEC A · ROW 1 · SEAT 12</span>
                  <span className="hero-ticket-hash">TF-84920-LOK</span>
                </div>
              </div>
            </div>
            <div className="hero-ticket-face hero-ticket-back">
              <div className="hero-ticket-leaf hero-ticket-leaf-back">
                <div className="hero-ticket-back-inner">
                  <TicketIcon size={28} color="var(--accent-cyan)" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>TICKETFLOW GUARANTEED</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>ZERO DOUBLE-BOOKING</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LOCK HASH #84920</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket 3: Foreground / Right (translateZ: 150px) */}
          <div className="hero-ticket-slab hero-ticket-3">
            <div className="hero-ticket-face hero-ticket-front">
              <div className="hero-ticket-leaf hero-ticket-leaf-cyan">
                <div className="hero-ticket-header">
                  <span className="hero-ticket-tag hero-ticket-tag-emerald">STAGE VIP PASS</span>
                  <span className="hero-ticket-badge">ATOMIC LOCK</span>
                </div>
                <div className="hero-ticket-body">
                  <div className="hero-ticket-title">Electronic Odyssey</div>
                  <div className="hero-ticket-meta">Nov 14 · 9:00 PM</div>
                </div>
                <div className="hero-ticket-footer">
                  <span className="hero-ticket-seat">TIER 1 · ROW 2 · SEAT 08</span>
                  <span className="hero-ticket-hash">TF-73104</span>
                </div>
              </div>
            </div>
            <div className="hero-ticket-face hero-ticket-back">
              <div className="hero-ticket-leaf hero-ticket-leaf-back">
                <div className="hero-ticket-back-inner">
                  <TicketIcon size={24} color="var(--success)" />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>TICKETFLOW 3D</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VERIFIED SEAT #73104</span>
                </div>
              </div>
            </div>
          </div>

          {/* (c) 16 Floating Particles in 3D */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="hero-particle"
              style={{
                width: p.size,
                height: p.size,
                color: p.color,
                background: p.color,
                transform: `translate3d(${p.x}px, ${p.y}px, ${p.z}px)`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
