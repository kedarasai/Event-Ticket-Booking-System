import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { GlassCard } from '../ui/GlassCard'

export function AuthLayout({ children, title, subtitle }) {
  const { status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect authenticated users visiting /login or /register to destination or /
  useEffect(() => {
    if (status === 'authenticated') {
      const from = location.state?.from?.pathname || location.state?.from || '/'
      navigate(from, { replace: true })
    }
  }, [status, navigate, location])

  return (
    <div className="container auth-page-container">
      {/* Left: Showcase panel (mesh + 2 floating CSS 3D tickets + tagline, hidden under 900px) */}
      <section className="auth-showcase-panel" aria-label="TicketFlow Platform Showcase">
        <div className="auth-tickets-viewport" aria-hidden="true">
          <div className="auth-ticket-3d auth-ticket-primary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-cyan)'
                }}
              >
                VIP ADMISSION
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  background: 'rgba(255, 255, 255, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600
                }}
              >
                SEC A · ROW 1
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                Cyber Symphony 2026
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Seat A-12 · Guaranteed Seat
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px dashed rgba(255, 255, 255, 0.2)',
                paddingTop: 6
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                TF-84920-LOK
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Row Lock Protected</span>
            </div>
          </div>

          <div className="auth-ticket-3d auth-ticket-secondary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-violet-light)'
                }}
              >
                FRONT ROW
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  background: 'rgba(255, 255, 255, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600
                }}
              >
                STAGE VIP
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                Neon Nights Live
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Seat VIP-04 · Guaranteed Seat
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px dashed rgba(255, 255, 255, 0.2)',
                paddingTop: 6
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-violet-light)' }}>
                TF-99120-ROW
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Zero Double-Booking</span>
            </div>
          </div>
        </div>

        <p
          className="auth-showcase-heading"
          style={{
            fontSize: 'var(--text-h2)',
            fontWeight: 700,
            marginBottom: 'var(--space-3)',
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}
        >
          Verified Live Seating,{' '}
          <span className="navbar-brand-gradient">Guaranteed</span>
        </p>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            maxWidth: '380px',
            lineHeight: 1.6,
            marginBottom: 'var(--space-6)'
          }}
        >
          Zero double-booking guarantee powered by transactional MySQL row locks and real-time CSS 3D seat rendering.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="badge badge-accent">Atomic Row Locks</span>
          <span className="badge badge-success">Idempotent Checkout</span>
          <span className="badge badge-neutral">Pure CSS 3D</span>
        </div>
      </section>

      {/* Right: GlassCard Form */}
      <section className="auth-form-panel">
        <GlassCard style={{ width: '100%', padding: 'var(--space-8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ fontSize: 'var(--text-h2)', marginBottom: 'var(--space-2)', color: '#ffffff' }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </GlassCard>
      </section>
    </div>
  )
}
