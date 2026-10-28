import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { ToastProvider } from './components/ui/Toast'
import { Layout } from './components/layout/Layout'
import { ScrollToTop } from './components/layout/ScrollToTop'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { GlassCard } from './components/ui/GlassCard'
import { Skeleton } from './components/ui/Skeleton'

// Static imports for core entry pages
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

// Code-split lazy-loaded pages
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'))
const SeatSelectionPage = lazy(() => import('./pages/SeatSelectionPage'))
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'))
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const Styleguide = import.meta.env.DEV
  ? lazy(() => import('./pages/Styleguide'))
  : null
const ConcurrencyDemoPage = import.meta.env.DEV
  ? lazy(() => import('./pages/ConcurrencyDemoPage'))
  : null
const SeatmapsPage = import.meta.env.DEV
  ? lazy(() => import('./pages/SeatmapsPage'))
  : null

function PageFallback() {
  return (
    <div className="container" style={{ padding: 'var(--space-8) var(--space-4)', width: '100%' }}>
      <GlassCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Skeleton width="40%" height={36} />
          <Skeleton width="70%" height={20} />
          <Skeleton width="100%" height={220} />
        </div>
      </GlassCard>
    </div>
  )
}

export default function App() {
  const isDev = import.meta.env.DEV

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route
                path="events/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <EventDetailPage />
                  </Suspense>
                }
              />
              <Route
                path="events/:id/seats"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageFallback />}>
                      <SeatSelectionPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="booking/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageFallback />}>
                      <BookingConfirmationPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-bookings"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageFallback />}>
                      <MyBookingsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="login"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route
                path="register"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <RegisterPage />
                  </Suspense>
                }
              />
              {isDev && (
                <>
                  <Route
                    path="demo"
                    element={
                      <ProtectedRoute>
                        <Suspense fallback={<PageFallback />}>
                          <ConcurrencyDemoPage />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="styleguide"
                    element={
                      <Suspense fallback={<PageFallback />}>
                        <Styleguide />
                      </Suspense>
                    }
                  />
                  <Route
                    path="seatmaps"
                    element={
                      <Suspense fallback={<PageFallback />}>
                        <SeatmapsPage />
                      </Suspense>
                    }
                  />
                </>
              )}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
