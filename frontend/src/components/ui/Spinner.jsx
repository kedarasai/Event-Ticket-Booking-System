export function Spinner({
  size = 'md',
  color = 'currentColor',
  className = '',
  label = 'Loading...',
  ...props
}) {
  const sizeClass = {
    sm: 'spinner-sm',
    md: 'spinner-md',
    lg: 'spinner-lg'
  }[size] || 'spinner-md'

  return (
    <span
      role="status"
      className={`spinner ${sizeClass} ${className}`.trim()}
      style={{ borderTopColor: color }}
      {...props}
    >
      <span style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0
      }}>
        {label}
      </span>
    </span>
  )
}
