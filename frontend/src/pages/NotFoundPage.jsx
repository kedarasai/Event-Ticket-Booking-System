import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { TicketIcon, ArrowRightIcon, SparklesIcon } from '../components/ui/Icons'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('404 Page Not Found | TicketFlow')

  return (
    <div
      className="container"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-12) var(--space-4)'
      }}
    >
      {/* Floating CSS 3D Ticket */}
      <div
        style={{
          perspective: '800px',
          width: '260px',
          height: '140px',
          margin: '0 auto var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          className="animate-float"
          style={{
            width: '240px',
            height: '120px',
            transformStyle: 'preserve-3d',
            transform: 'rotateX(18deg) rotateY(-22deg) rotateZ(6deg)',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.35), rgba(34, 211, 238, 0.25))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), var(--shadow-glow-cyan)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>
              <TicketIcon size={18} color="var(--accent-cyan)" />
              LOST TICKET
            </span>
            <SparklesIcon size={16} color="var(--gold)" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ height: '2px', flex: 1, background: 'rgba(255, 255, 255, 0.2)', borderStyle: 'dashed' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>VOID</span>
            <div style={{ height: '2px', flex: 1, background: 'rgba(255, 255, 255, 0.2)', borderStyle: 'dashed' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>ROW: ?? &bull; SEAT: ??</span>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>404 ERROR</span>
          </div>
        </div>
      </div>

      {/* Big Gradient 404 Header */}
      <h1
        style={{
          fontSize: 'clamp(5rem, 16vw, 9rem)',
          fontWeight: 900,
          lineHeight: 1,
          margin: 0,
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.05em'
        }}
      >
        404
      </h1>

      <h2 style={{ fontSize: 'var(--text-h2)', margin: 'var(--space-3) 0 var(--space-2)' }}>
        Page Not Found
      </h2>

      <p style={{ color: 'var(--text-muted)', maxWidth: '480px', marginBottom: 'var(--space-8)' }}>
        The stage you are looking for does not exist or has been moved to another venue.
      </p>

      <Link to="/" style={{ textDecoration: 'none' }}>
        <Button variant="primary" size="lg" icon={<ArrowRightIcon size={20} />}>
          Back to Events
        </Button>
      </Link>
    </div>
  )
}
