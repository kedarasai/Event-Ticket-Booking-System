import { useState, useRef, useEffect } from 'react'
import {
  Button,
  GlassCard,
  Badge,
  Skeleton,
  Spinner,
  Modal,
  useToast,
  EmptyState,
  ErrorBoundary,
  Input,
  SegmentedControl,
  ProgressBar,
  CalendarIcon,
  PinIcon,
  TicketIcon,
  UserIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  ArrowRightIcon,
  MenuIcon,
  RotateIcon,
  ZoomInIcon,
  ZoomOutIcon,
  SparklesIcon,
  ClockIcon,
  LogoutIcon,
  ChevronIcon
} from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useReveal } from '../hooks/useReveal'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

// Buggy child component to demonstrate ErrorBoundary retry
function BuggyComponent({ shouldThrow, onThrow }) {
  if (shouldThrow) {
    throw new Error('This is a simulated runtime error inside ErrorBoundary!')
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
        Component is functioning properly.
      </p>
      <Button variant="danger" size="sm" onClick={onThrow}>
        Trigger Render Error
      </Button>
    </div>
  )
}

export default function Styleguide() {
  useDocumentTitle('Design System Styleguide | Ticket Booking')
  const toast = useToast()
  const prefersReducedMotion = usePrefersReducedMotion()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalInputValue, setModalInputValue] = useState('')

  // Segmented Control State
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Input states
  const [textVal, setTextVal] = useState('')
  const [passVal, setPassVal] = useState('CyberSecure123!')
  const [searchVal, setSearchVal] = useState('')

  // Button Loading State
  const [btnLoading, setBtnLoading] = useState(false)

  // Error boundary simulation state
  const [simulateError, setSimulateError] = useState(false)

  // 3D Cube interactive state
  const [isCubePaused, setIsCubePaused] = useState(false)
  const cubeSceneRef = useRef(null)
  const isDraggingRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const rotRef = useRef({ x: -22, y: 45 })
  const rafIdRef = useRef(null)

  // Scroll reveal hook for late section
  const [revealRef, isRevealed] = useReveal()

  // Pointer drag handler for 3D Cube
  const handlePointerDown = (e) => {
    isDraggingRef.current = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
    setIsCubePaused(true)
  }

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingRef.current) return
      const dx = e.clientX - lastPointerRef.current.x
      const dy = e.clientY - lastPointerRef.current.y
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      rotRef.current.x = Math.max(-80, Math.min(80, rotRef.current.x - dy * 0.5))
      rotRef.current.y = (rotRef.current.y + dx * 0.5) % 360

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        if (cubeSceneRef.current) {
          cubeSceneRef.current.style.transform = `rotateX(${rotRef.current.x}deg) rotateY(${rotRef.current.y}deg)`
        }
      })
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  const resetCube = () => {
    rotRef.current = { x: -22, y: 45 }
    if (cubeSceneRef.current) {
      cubeSceneRef.current.style.transform = ''
    }
    setIsCubePaused(false)
  }

  const categoryOptions = [
    { value: 'all', label: 'All Events' },
    { value: 'concerts', label: 'Concerts' },
    { value: 'theater', label: 'Theater' },
    { value: 'sports', label: 'Sports' }
  ]

  const iconsList = [
    { name: 'Calendar', component: <CalendarIcon size={24} /> },
    { name: 'Pin', component: <PinIcon size={24} /> },
    { name: 'Ticket', component: <TicketIcon size={24} /> },
    { name: 'User', component: <UserIcon size={24} /> },
    { name: 'Search', component: <SearchIcon size={24} /> },
    { name: 'Check', component: <CheckIcon size={24} /> },
    { name: 'X', component: <XIcon size={24} /> },
    { name: 'Alert', component: <AlertIcon size={24} /> },
    { name: 'ArrowRight', component: <ArrowRightIcon size={24} /> },
    { name: 'Menu', component: <MenuIcon size={24} /> },
    { name: 'Rotate', component: <RotateIcon size={24} /> },
    { name: 'ZoomIn', component: <ZoomInIcon size={24} /> },
    { name: 'ZoomOut', component: <ZoomOutIcon size={24} /> },
    { name: 'Sparkles', component: <SparklesIcon size={24} /> },
    { name: 'Clock', component: <ClockIcon size={24} /> },
    { name: 'Logout', component: <LogoutIcon size={24} /> },
    { name: 'Chevron', component: <ChevronIcon size={24} direction="down" /> }
  ]

  return (
    <div className="styleguide-page" style={{ paddingBottom: 'var(--space-16)' }}>
      {/* Background Recipe */}
      <div className="page-background" />

      <div className="container" style={{ paddingTop: 'var(--space-8)' }}>
        {/* Header Section */}
        <header style={{ marginBottom: 'var(--space-10)', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Badge variant="accent">Design System</Badge>
            <Badge variant="success">Vanilla CSS 3D</Badge>
            {prefersReducedMotion && <Badge variant="warn">Reduced Motion Active</Badge>}
          </div>
          <h1>System Styleguide</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '640px' }}>
            Zero-library, high-performance UI foundation featuring CSS 3D transforms,
            glassmorphism, WCAG AA accessibility, and StrictMode compatibility.
          </p>
        </header>

        {/* 1. CSS 3D ROTATING CUBE DEMO */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2>CSS 3D Depth Demo (Preserve-3D)</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Demonstrates true hardware-accelerated 3D depth with perspective and unflattened transform-style: preserve-3d.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCubePaused((p) => !p)}
              >
                {isCubePaused ? 'Resume Auto-Spin' : 'Pause'}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetCube}>
                Reset Orbit
              </Button>
            </div>
          </div>

          <GlassCard style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Click and drag the cube to manually orbit in 3D space:
            </p>

            <div
              className="cube-viewport"
              onPointerDown={handlePointerDown}
              style={{ cursor: 'grab' }}
            >
              <div
                ref={cubeSceneRef}
                className={`cube-scene ${isCubePaused ? 'is-paused' : ''}`}
              >
                <div className="cube-face cube-face-front">
                  <TicketIcon size={32} />
                  <span>FRONT</span>
                  <span className="cube-face-label">Elevation</span>
                </div>
                <div className="cube-face cube-face-back">
                  <SparklesIcon size={32} />
                  <span>BACK</span>
                  <span className="cube-face-label">Aisle</span>
                </div>
                <div className="cube-face cube-face-right">
                  <CalendarIcon size={32} />
                  <span>RIGHT</span>
                  <span className="cube-face-label">Balcony</span>
                </div>
                <div className="cube-face cube-face-left">
                  <UserIcon size={32} />
                  <span>LEFT</span>
                  <span className="cube-face-label">Tier</span>
                </div>
                <div className="cube-face cube-face-top">
                  <PinIcon size={32} />
                  <span>TOP</span>
                  <span className="cube-face-label">Ceiling</span>
                </div>
                <div className="cube-face cube-face-bottom">
                  <RotateIcon size={32} />
                  <span>STAGE</span>
                  <span className="cube-face-label">Floor</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 2. BUTTONS & STATES */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Buttons & Interactive States</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Gradient primary with glow on hover, ghost, danger, multiple sizes, and loading states.
          </p>

          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>Variants</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <Button variant="primary">Primary Gradient</Button>
                  <Button variant="ghost">Ghost Surface</Button>
                  <Button variant="danger">Danger Action</Button>
                  <Button variant="primary" icon={<TicketIcon size={18} />}>With Icon</Button>
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>Sizes</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Button size="sm">Small Button</Button>
                  <Button size="md">Medium Default</Button>
                  <Button size="lg">Large Hero</Button>
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>States</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <Button
                    loading={btnLoading}
                    onClick={() => {
                      setBtnLoading(true)
                      setTimeout(() => setBtnLoading(false), 2000)
                    }}
                  >
                    {btnLoading ? 'Processing...' : 'Click for Loading State'}
                  </Button>
                  <Button disabled>Disabled Primary</Button>
                  <Button variant="ghost" disabled>Disabled Ghost</Button>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 3. GLASS CARDS & GRADIENT BORDER */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Glassmorphism & Gradient Borders</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Surface 2 glass with top inset highlight and optional hover lift; gradient border via pseudo-element.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
            <GlassCard>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Standard Glass</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
                Equipped with 16px blur, 140% saturation, 1px surface border, and top inset highlight.
              </p>
            </GlassCard>

            <GlassCard interactive>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Interactive Hover Lift</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
                Hover over this card to observe the smooth 4px Y-lift and amplified violet glow shadow.
              </p>
            </GlassCard>

            <div className="gradient-border" style={{ padding: 'var(--space-6)' }}>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Gradient Border Recipe</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
                Uses masked pseudo-elements with accent gradient for razor-sharp borders on any aspect ratio.
              </p>
            </div>
          </div>
        </section>

        {/* 4. BADGES */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Badges</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Semantic status indicators with pill styling and harmonious color tokens.
          </p>

          <GlassCard>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <Badge variant="success" icon={<CheckIcon size={12} />}>Confirmed</Badge>
              <Badge variant="warn" icon={<AlertIcon size={12} />}>Few Left</Badge>
              <Badge variant="danger" icon={<XIcon size={12} />}>Sold Out</Badge>
              <Badge variant="neutral">Draft</Badge>
              <Badge variant="accent" icon={<SparklesIcon size={12} />}>VIP Access</Badge>
            </div>
          </GlassCard>
        </section>

        {/* 5. FORM INPUTS & TOGGLES */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Form Inputs</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Accessible text, search, and password inputs with icon slots, hints, error states, and show/hide toggles.
          </p>

          <GlassCard>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
              <Input
                label="Search Events"
                placeholder="Search by artist, venue, or city..."
                icon={<SearchIcon size={18} />}
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                hint="Press enter to search"
              />

              <Input
                label="Full Name"
                placeholder="e.g. Alex Morgan"
                icon={<UserIcon size={18} />}
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                hint="Must match your government ID"
              />

              <Input
                label="Password"
                type="password"
                value={passVal}
                onChange={(e) => setPassVal(e.target.value)}
                hint="Toggle HIDE/SHOW button on the right"
              />

              <Input
                label="Email Address"
                type="email"
                defaultValue="invalid-email@"
                error="Please enter a valid email address."
              />

              <Input
                label="Disabled Field"
                defaultValue="Locked administrative setting"
                disabled
              />
            </div>
          </GlassCard>
        </section>

        {/* 6. SEGMENTED CONTROL & PROGRESS BAR */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Navigation & Progress</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Keyboard-navigable segmented control (Arrow keys, role=tablist) and smooth gradient progress bars.
          </p>

          <GlassCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>
                  Segmented Control (Use Left/Right Arrow Keys)
                </h3>
                <SegmentedControl
                  options={categoryOptions}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  label="Filter events by category"
                />
                <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-small)', color: 'var(--accent-cyan)' }}>
                  Active Tab: {selectedCategory.toUpperCase()}
                </p>
              </div>

              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>
                  Progress Bars
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <ProgressBar value={25} label="Booking Step 1 of 4: Select Seats" showPercentage />
                  <ProgressBar value={75} label="Venue Capacity" showPercentage />
                  <ProgressBar value={100} label="Checkout Completed" showPercentage />
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 7. MODAL & TOASTS */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Overlays: Modal & Stacked Toasts</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Modal features focus trapping, backdrop click, Escape key dismiss, and scroll locking.
            Toasts feature auto-dismiss, stacking, and pause-on-hover.
          </p>

          <GlassCard>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                Open Accessible Modal
              </Button>

              <Button
                variant="ghost"
                onClick={() => toast.success('Booking reference #TB-8942 confirmed!', 'Payment Successful')}
              >
                Trigger Success Toast
              </Button>

              <Button
                variant="ghost"
                onClick={() => toast.error('Seat A-12 is no longer available.', 'Seat Conflict')}
              >
                Trigger Error Toast
              </Button>

              <Button
                variant="ghost"
                onClick={() => toast.info('Your seat reservation expires in 5 minutes.', 'Cart Reservation')}
              >
                Trigger Info Toast
              </Button>
            </div>
          </GlassCard>

          {/* Modal Instance */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Confirm Reservation"
            footer={
              <>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsModalOpen(false)
                    toast.success('Your reservation has been confirmed!')
                  }}
                >
                  Confirm & Pay
                </Button>
              </>
            }
          >
            <p style={{ marginBottom: 'var(--space-4)' }}>
              This dialog traps keyboard focus (press Tab to cycle through controls), locks body scroll,
              and returns focus to the button that opened it when closed.
            </p>
            <Input
              label="Attendee Name"
              placeholder="Enter name for ticket..."
              value={modalInputValue}
              onChange={(e) => setModalInputValue(e.target.value)}
            />
          </Modal>
        </section>

        {/* 8. SKELETON & SPINNERS */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Skeletons & Spinners</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Shimmering loading placeholders and smooth spinner animations.
          </p>

          <GlassCard>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>Skeleton Card</h3>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <Skeleton width={56} height={56} borderRadius="var(--radius-md)" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <Skeleton width="70%" height={20} />
                    <Skeleton width="45%" height={14} />
                  </div>
                </div>
                <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="90%" height={14} />
              </div>

              <div>
                <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-muted)' }}>Spinners</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
                  <Spinner size="sm" color="var(--accent-cyan)" />
                  <Spinner size="md" color="var(--accent-violet)" />
                  <Spinner size="lg" color="var(--gold)" />
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 9. EMPTY STATE & ERROR BOUNDARY */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Empty States & Error Handling</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Polished vector illustrations for zero states and fault-tolerant error boundaries with retries.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
            <EmptyState
              title="No Bookings Yet"
              description="You have not booked any tickets. Explore upcoming concerts and theatrical performances now."
              action={<Button variant="primary" size="sm">Browse Events</Button>}
            />

            <GlassCard>
              <h3 style={{ marginBottom: 'var(--space-3)' }}>ErrorBoundary Demonstration</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)', marginBottom: 'var(--space-4)' }}>
                Catch JavaScript render exceptions gracefully without crashing the application.
              </p>
              <ErrorBoundary onReset={() => setSimulateError(false)}>
                <BuggyComponent
                  shouldThrow={simulateError}
                  onThrow={() => setSimulateError(true)}
                />
              </ErrorBoundary>
            </GlassCard>
          </div>
        </section>

        {/* 10. ICON GALLERY */}
        <section style={{ marginBottom: 'var(--space-12)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Inline SVG Icon Set</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            All 17 zero-dependency inline SVG icons with currentColor support.
          </p>

          <GlassCard>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 'var(--space-4)',
                textAlign: 'center'
              }}
            >
              {iconsList.map((item) => (
                <div
                  key={item.name}
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-2)'
                  }}
                >
                  <div style={{ color: 'var(--accent-cyan)' }}>{item.component}</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.name}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* 11. SCROLL REVEAL HOOK DEMO */}
        <section
          ref={revealRef}
          className={`reveal ${isRevealed ? 'is-revealed' : ''}`}
          style={{ marginBottom: 'var(--space-8)' }}
        >
          <GlassCard style={{ textAlign: 'center', padding: 'var(--space-8)', borderColor: 'var(--accent-cyan)' }}>
            <Badge variant="accent" style={{ marginBottom: 'var(--space-2)' }}>useReveal Hook</Badge>
            <h2>Scroll Reveal Activated</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto' }}>
              This section was smoothly faded and translated up using our IntersectionObserver hook.
            </p>
          </GlassCard>
        </section>
      </div>
    </div>
  )
}
