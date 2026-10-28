export function Badge({
  variant = 'neutral',
  icon = null,
  className = '',
  children,
  ...props
}) {
  const variantClass = {
    success: 'badge-success',
    warn: 'badge-warn',
    warning: 'badge-warn',
    danger: 'badge-danger',
    neutral: 'badge-neutral',
    accent: 'badge-accent'
  }[variant] || 'badge-neutral'

  return (
    <span className={`badge ${variantClass} ${className}`.trim()} {...props}>
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
