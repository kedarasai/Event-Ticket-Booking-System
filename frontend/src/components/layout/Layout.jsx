import { Link, Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { TicketIcon } from '../ui/Icons'

export function Layout() {
  const location = useLocation()

  return (
    <div className="app-layout">
      {/* Background Recipe */}
      <div className="page-background" />

      {/* Sticky Glass Navbar */}
      <Navbar />

      {/* Main Content with Route-Keyed Fade-Up Transition */}
      <main
        key={location.pathname}
        className="route-transition"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <Outlet />
      </main>

      {/* Minimal Footer with link row and copyright */}
      <footer className="footer">
        <div className="container footer-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <TicketIcon size={18} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 600, color: '#ffffff' }}>TicketFlow</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-small)' }}>
              Events
            </Link>
            <Link to="/my-bookings" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 'var(--text-small)' }}>
              My Bookings
            </Link>
            <span style={{ color: 'var(--border)' }}>&bull;</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Zero Double-Booking Guarantee
            </span>
            <span style={{ color: 'var(--border)' }}>&bull;</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              CSS 3D Engine
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
