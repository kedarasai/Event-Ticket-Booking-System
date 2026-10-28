import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { Skeleton } from '../ui/Skeleton'
import { GlassCard } from '../ui/GlassCard'

/**
 * ProtectedRoute component.
 * Displays a shimmer skeleton while auth status is 'loading'.
 * Redirects anonymous users to /login with state.from.
 * Renders protected content once authenticated.
 */
export function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="container" style={{ padding: 'var(--space-8) 0' }}>
        <GlassCard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Skeleton width="35%" height={32} />
            <Skeleton width="65%" height={20} />
            <Skeleton width="100%" height={160} />
          </div>
        </GlassCard>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ? children : <Outlet />
}
