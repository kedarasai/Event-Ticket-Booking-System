export function GlassCard({
  interactive = false,
  className = '',
  children,
  ...props
}) {
  const interactiveClass = interactive ? 'glass-card-interactive' : ''

  return (
    <div
      className={`glass-card ${interactiveClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}
