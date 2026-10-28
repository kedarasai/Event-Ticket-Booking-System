import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getEvents } from '../services/api'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import {
  SearchIcon,
  XIcon,
  SparklesIcon,
  MusicIcon,
  UsersIcon,
  SmileIcon,
  TheatreIcon,
  TrophyIcon,
  FlameIcon,
  TicketIcon,
  CheckIcon,
  ArrowRightIcon
} from '../components/ui/Icons'
import { HeroScene } from '../components/home/HeroScene'
import { StatCounters } from '../components/home/StatCounters'
import { EventCard } from '../components/events/EventCard'

const CATEGORIES = [
  { name: 'All', value: '', icon: SparklesIcon },
  { name: 'Concert', value: 'Concert', icon: MusicIcon },
  { name: 'Conference', value: 'Conference', icon: UsersIcon },
  { name: 'Comedy', value: 'Comedy', icon: SmileIcon },
  { name: 'Theatre', value: 'Theatre', icon: TheatreIcon },
  { name: 'Sports', value: 'Sports', icon: TrophyIcon },
  { name: 'Festival', value: 'Festival', icon: FlameIcon }
]

export default function HomePage() {
  useDocumentTitle('Book the Moment | TicketFlow')

  const [searchParams, setSearchParams] = useSearchParams()
  const searchInputRef = useRef(null)

  // URL State
  const urlSearch = searchParams.get('search') || ''
  const urlPage = parseInt(searchParams.get('page'), 10) || 1

  // Local state for debounced search
  const [inputValue, setInputValue] = useState(urlSearch)
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch)

  // Catalog state
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(urlPage)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  // React-recommended pattern: Adjust input and loading state during render when URL/retry changes
  const currentFetchKey = `${urlSearch}_${retryKey}`
  const [prevFetchKey, setPrevFetchKey] = useState(currentFetchKey)

  if (prevUrlSearch !== urlSearch) {
    setPrevUrlSearch(urlSearch)
    setInputValue(urlSearch)
  }

  if (prevFetchKey !== currentFetchKey) {
    setPrevFetchKey(currentFetchKey)
    setLoading(true)
    setError(null)
    setCurrentPage(1)
  }

  // Press "/" anywhere to focus the search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName
      const isInput = ['INPUT', 'TEXTAREA'].includes(activeTag) || document.activeElement?.isContentEditable
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 300ms Debounce for typing in the search input
  useEffect(() => {
    if (inputValue === urlSearch) return

    const timer = setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams)
      if (inputValue.trim()) {
        nextParams.set('search', inputValue.trim())
      } else {
        nextParams.delete('search')
      }
      nextParams.set('page', '1')
      setSearchParams(nextParams, { replace: true })
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue, urlSearch, searchParams, setSearchParams])

  // Fetch page 1 when search or retryKey changes, aborting stale requests
  useEffect(() => {
    const controller = new AbortController()

    getEvents({
      search: urlSearch,
      page: 1,
      limit: 9,
      signal: controller.signal
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setEvents(data.events || [])
          setTotal(data.pagination?.total || 0)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Failed to load events.')
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [urlSearch, retryKey])

  // Category chip click
  const handleCategorySelect = (catValue) => {
    setInputValue(catValue)
    const nextParams = new URLSearchParams(searchParams)
    if (catValue) {
      nextParams.set('search', catValue)
    } else {
      nextParams.delete('search')
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams, { replace: false })
  }

  // Clear search input
  const handleClearSearch = () => {
    setInputValue('')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('search')
    nextParams.set('page', '1')
    setSearchParams(nextParams, { replace: false })
    searchInputRef.current?.focus()
  }

  // Load more pagination handler (appends next page while keeping scroll position)
  const handleLoadMore = async () => {
    const nextPage = currentPage + 1
    try {
      setLoadingMore(true)
      const data = await getEvents({
        search: urlSearch,
        page: nextPage,
        limit: 9
      })
      setEvents((prev) => [...prev, ...(data.events || [])])
      setCurrentPage(nextPage)

      // Sync page to URL
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('page', String(nextPage))
      setSearchParams(nextParams, { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to load more events.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleExploreEvents = () => {
    document.getElementById('events-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleHowItWorks = () => {
    document.getElementById('how-it-works-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="container" style={{ padding: 'var(--space-4) var(--space-4) var(--space-16)' }}>
      {/* Hero Section */}
      <section className="hero-section" aria-label="Hero Introduction">
        <div className="hero-content-col">
          <div style={{ display: 'inline-flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Badge variant="accent">
              <SparklesIcon size={12} style={{ marginRight: 4 }} />
              Pure CSS 3D Engine
            </Badge>
            <Badge variant="success">Zero Double-Booking Guarantee</Badge>
          </div>

          <h1 className="hero-headline">
            Book the <span className="hero-headline-gradient">moment.</span>
          </h1>

          <p className="hero-subtext">
            Experience verified live events on a real-time CSS 3D venue map. Powered by atomic MySQL row locks that make double bookings mathematically impossible.
          </p>

          <div className="hero-cta-group">
            <Button
              variant="primary"
              size="lg"
              onClick={handleExploreEvents}
              icon={<ArrowRightIcon size={18} />}
            >
              Explore events
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleHowItWorks}
            >
              How it works
            </Button>
          </div>

          <StatCounters events={events} />
        </div>

        <div className="hero-scene-col">
          <HeroScene />
        </div>
      </section>

      {/* Events Catalog Section */}
      <section id="events-section" aria-label="Upcoming Events Catalog" style={{ paddingTop: 'var(--space-8)' }}>
        {/* Toolbar: Search input + Category chips */}
        <div className="catalog-toolbar">
          {/* Search Bar */}
          <div className="search-row">
            <span className="search-icon-slot">
              <SearchIcon size={20} />
            </span>

            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by event, artist, venue, or category..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="search-input-field"
              aria-label="Search events"
            />

            {inputValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="search-clear-btn"
                aria-label="Clear search query"
              >
                <XIcon size={16} />
              </button>
            )}

            <span className="search-kbd-hint" aria-hidden="true">
              /
            </span>
          </div>

          {/* Category Chips Row */}
          <div className="category-chips-row" role="tablist" aria-label="Filter events by category">
            {CATEGORIES.map((cat) => {
              const IconComp = cat.icon
              const isSelected = cat.value
                ? urlSearch.toLowerCase() === cat.value.toLowerCase()
                : !urlSearch

              return (
                <button
                  key={cat.name}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleCategorySelect(cat.value)}
                  className={`category-chip ${isSelected ? 'is-active' : ''}`}
                >
                  <IconComp size={16} color={isSelected ? 'var(--accent-cyan)' : 'currentColor'} />
                  <span>{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Status Bar */}
        <div className="catalog-status-bar">
          <div>
            <h2 className="catalog-heading" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#ffffff', display: 'inline', margin: 0 }}>
              Upcoming Events
            </h2>
            {urlSearch && (
              <span style={{ marginLeft: 8, color: 'var(--accent-cyan)' }}>
                matching &ldquo;{urlSearch}&rdquo;
              </span>
            )}
          </div>
          <span>
            {loading ? 'Scanning venues...' : `Showing ${events.length} of ${total} events`}
          </span>
        </div>

        {/* Catalog Grid States */}
        {loading ? (
          /* Skeletons matching EventCard proportions (Zero Layout Shift) */
          <div className="events-grid" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="event-card-perspective">
                <div className="event-card" style={{ padding: 0 }}>
                  <Skeleton width="100%" height={180} borderRadius="0" />
                  <div className="event-card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton width={80} height={22} borderRadius="var(--radius-full)" />
                      <Skeleton width={70} height={22} borderRadius="var(--radius-full)" />
                    </div>
                    <Skeleton width="90%" height={24} style={{ marginTop: 4 }} />
                    <Skeleton width="65%" height={20} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                      <Skeleton width="50%" height={16} />
                      <Skeleton width="40%" height={16} />
                    </div>
                    <Skeleton width="100%" height={12} borderRadius="var(--radius-full)" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 16 }}>
                      <Skeleton width={70} height={28} />
                      <Skeleton width={110} height={36} borderRadius="var(--radius-sm)" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State with Retry Button */
          <ErrorState
            title="Unable to Load Events"
            message={error}
            onRetry={() => {
              setLoading(true)
              setError(null)
              setRetryKey((k) => k + 1)
            }}
          />
        ) : events.length === 0 ? (
          /* Empty State for no matching results */
          <EmptyState
            title="No events found"
            description={
              urlSearch
                ? `We couldn't find any events matching "${urlSearch}". Try checking your spelling or clearing your filter.`
                : 'There are currently no upcoming events scheduled. Please check back soon!'
            }
            action={
              urlSearch ? (
                <Button variant="ghost" size="md" onClick={handleClearSearch}>
                  Clear search
                </Button>
              ) : null
            }
          />
        ) : (
          /* Event Cards Grid */
          <>
            <div className="events-grid">
              {events.map((evt) => (
                <EventCard key={evt.eventId} event={evt} />
              ))}
            </div>

            {/* Load More Button */}
            {events.length < total && (
              <div className="load-more-wrapper">
                <Button
                  variant="ghost"
                  size="lg"
                  loading={loadingMore}
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  style={{ minWidth: 200 }}
                >
                  Load more events
                </Button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {total - events.length} more events available
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* Static "How It Works" Section below the Grid */}
      <section
        id="how-it-works-section"
        className="how-it-works-section"
        aria-label="How TicketFlow Works"
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <Badge variant="neutral" style={{ marginBottom: 'var(--space-2)' }}>Simple 3-Step Process</Badge>
          <h2 style={{ fontSize: 'var(--text-h2)', color: '#ffffff' }}>How It Works</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: 'var(--space-2) auto 0' }}>
            Book verified seats with zero double booking guaranteed by MySQL row locks.
          </p>
        </div>

        <div className="how-it-works-grid">
          {/* Step 1 */}
          <GlassCard className="step-card">
            <div className="step-header-row">
              <span className="step-number-badge">1</span>
              <div className="step-icon-box">
                <TicketIcon size={22} color="var(--accent-violet)" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)', color: '#ffffff' }}>
              Pick an event
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Browse upcoming live concerts, festivals, theatre, and sports across premier venues with live seat availability.
            </p>
          </GlassCard>

          {/* Step 2 */}
          <GlassCard className="step-card">
            <div className="step-header-row">
              <span className="step-number-badge">2</span>
              <div className="step-icon-box">
                <SparklesIcon size={22} color="var(--accent-cyan)" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)', color: '#ffffff' }}>
              Choose seats in 3D
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Experience the amphitheater in real-time CSS 3D with stage view perspective and immediate tier pricing.
            </p>
          </GlassCard>

          {/* Step 3 */}
          <GlassCard className="step-card">
            <div className="step-header-row">
              <span className="step-number-badge">3</span>
              <div className="step-icon-box">
                <CheckIcon size={22} color="var(--success)" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)', color: '#ffffff' }}>
              Book instantly
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Atomic MySQL row locks guarantee zero double bookings with idempotent instant confirmation.
            </p>
          </GlassCard>
        </div>
      </section>
    </div>
  )
}
