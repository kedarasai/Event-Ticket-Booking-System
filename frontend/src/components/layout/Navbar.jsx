import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { Button } from '../ui/Button'
import { TicketIcon, UserIcon, LogoutIcon, MenuIcon, XIcon, SparklesIcon } from '../ui/Icons'
import { Skeleton } from '../ui/Skeleton'

export function Navbar() {
  const { user, status, logout } = useAuth()
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV

  // Scroll state for shrink & shadow after 8px
  const [isScrolled, setIsScrolled] = useState(false)

  // User Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Mobile Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const drawerRef = useRef(null)

  // Scroll listener for shrink & shadow
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 8
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev))
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close dropdown on outside click and ESC
  useEffect(() => {
    if (!isDropdownOpen) return

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDropdownOpen])

  // Mobile drawer: body scroll lock and ESC listener
  useEffect(() => {
    if (!isDrawerOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false)
        return
      }

      // Focus trap within drawer
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  // Compute initials and first name
  const fullName = user?.name || user?.email || 'User'
  const firstName = fullName.split(' ')[0]
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  const handleLogout = () => {
    setIsDropdownOpen(false)
    setIsDrawerOpen(false)
    logout()
    navigate('/')
  }

  return (
    <header className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="container navbar-container">
        {/* Brand: Gradient ticket mark SVG + wordmark */}
        <Link to="/" className="navbar-brand" onClick={() => setIsDrawerOpen(false)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="ticketBrandGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <path
              d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
              stroke="url(#ticketBrandGradient)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="12" y1="6" x2="12" y2="8" stroke="url(#ticketBrandGradient)" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="11" x2="12" y2="13" stroke="url(#ticketBrandGradient)" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12" y2="18" stroke="url(#ticketBrandGradient)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>TICKET<span className="navbar-brand-gradient">FLOW</span></span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="navbar-nav-desktop">
          <ul className="navbar-nav">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
              >
                Events
              </NavLink>
            </li>
            {status === 'authenticated' && (
              <li>
                <NavLink
                  to="/my-bookings"
                  className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
                >
                  My Bookings
                </NavLink>
              </li>
            )}
            {isDev && (
              <>
                <li>
                  <NavLink
                    to="/demo"
                    className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
                  >
                    Race Demo
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/seatmaps"
                    className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
                  >
                    Venue Maps
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/styleguide"
                    className={({ isActive }) => `navbar-link ${isActive ? 'is-active' : ''}`}
                  >
                    Styleguide
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Desktop Actions */}
        <div className="navbar-actions navbar-actions-desktop" ref={dropdownRef}>
          {status === 'loading' ? (
            <Skeleton width={120} height={36} borderRadius="var(--radius-full)" />
          ) : status === 'authenticated' ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="user-chip"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                aria-label={`User menu for ${fullName}`}
              >
                <span className="user-avatar">{initials}</span>
                <span>{firstName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
              </button>

              {isDropdownOpen && (
                <div className="user-dropdown" role="menu">
                  <div style={{ padding: '6px 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{fullName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user?.email}
                    </div>
                  </div>

                  <Link
                    to="/my-bookings"
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <TicketIcon size={16} color="var(--accent-cyan)" />
                    <span>My Bookings</span>
                  </Link>

                  <button
                    type="button"
                    className="user-dropdown-item is-danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <LogoutIcon size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              <Link to="/register" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isDrawerOpen}
        >
          <MenuIcon size={22} />
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {isDrawerOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setIsDrawerOpen(false)}
          role="presentation"
        >
          <aside
            ref={drawerRef}
            className="drawer-content"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TicketIcon size={20} color="var(--accent-cyan)" />
                <span style={{ fontWeight: 700, color: '#ffffff' }}>TICKETFLOW</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close navigation menu"
              >
                <XIcon size={20} />
              </button>
            </div>

            <nav className="drawer-nav">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `drawer-link ${isActive ? 'is-active' : ''}`}
                onClick={() => setIsDrawerOpen(false)}
              >
                <SparklesIcon size={18} color="var(--accent-violet)" />
                <span>Events</span>
              </NavLink>

              {status === 'authenticated' && (
                <NavLink
                  to="/my-bookings"
                  className={({ isActive }) => `drawer-link ${isActive ? 'is-active' : ''}`}
                  onClick={() => setIsDrawerOpen(false)}
                >
                  <TicketIcon size={18} color="var(--accent-cyan)" />
                  <span>My Bookings</span>
                </NavLink>
              )}

              {isDev && (
                <>
                  <NavLink
                    to="/demo"
                    className={({ isActive }) => `drawer-link ${isActive ? 'is-active' : ''}`}
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <SparklesIcon size={18} color="var(--accent-cyan)" />
                    <span>Race Demo</span>
                  </NavLink>
                  <NavLink
                    to="/seatmaps"
                    className={({ isActive }) => `drawer-link ${isActive ? 'is-active' : ''}`}
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <TicketIcon size={18} color="var(--accent-violet)" />
                    <span>Venue Maps</span>
                  </NavLink>
                  <NavLink
                    to="/styleguide"
                    className={({ isActive }) => `drawer-link ${isActive ? 'is-active' : ''}`}
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    <UserIcon size={18} color="var(--gold)" />
                    <span>Styleguide</span>
                  </NavLink>
                </>
              )}
            </nav>

            <div className="drawer-footer">
              {status === 'authenticated' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="user-avatar">{initials}</span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={handleLogout}
                    icon={<LogoutIcon size={18} />}
                    style={{ width: '100%', marginTop: 'var(--space-2)' }}
                  >
                    Log Out
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <Link to="/login" style={{ textDecoration: 'none' }} onClick={() => setIsDrawerOpen(false)}>
                    <Button variant="ghost" size="md" style={{ width: '100%' }}>
                      Log In
                    </Button>
                  </Link>
                  <Link to="/register" style={{ textDecoration: 'none' }} onClick={() => setIsDrawerOpen(false)}>
                    <Button variant="primary" size="md" style={{ width: '100%' }}>
                      Register
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </header>
  )
}
