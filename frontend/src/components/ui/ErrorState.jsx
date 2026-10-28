import { GlassCard } from './GlassCard'
import { Button } from './Button'
import { AlertIcon } from './Icons'

/**
 * ErrorState Component
 * Consistent, accessible error display with AlertIcon, heading, descriptive text, and retry CTA.
 */
export function ErrorState({
  title = 'Unable to Load Content',
  message = 'An unexpected network error occurred. Please check your connection and try again.',
  onRetry = null,
  retryLabel = 'Retry Connection',
  action = null,
  className = '',
  style = {}
}) {
  return (
    <GlassCard
      role="alert"
      aria-live="polite"
      className={`error-state-card ${className}`.trim()}
      style={{
        maxWidth: 540,
        margin: 'var(--space-8) auto',
        textAlign: 'center',
        padding: 'var(--space-10) var(--space-6)',
        ...style
      }}
    >
      <div
        className="error-state-icon"
        style={{ color: 'var(--danger)', marginBottom: 'var(--space-4)', display: 'inline-flex' }}
        aria-hidden="true"
      >
        <AlertIcon size={48} />
      </div>

      <h2 style={{ fontSize: 'var(--text-h2)', color: '#ffffff', marginBottom: 'var(--space-2)' }}>
        {title}
      </h2>

      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
        {message}
      </p>

      {action ? (
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          {action}
        </div>
      ) : onRetry ? (
        <Button variant="primary" size="md" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </GlassCard>
  )
}

export default ErrorState
