export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  className = '',
  style = {},
  ...props
}) {
  const customStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius,
    ...style
  }

  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={customStyle}
      aria-hidden="true"
      {...props}
    />
  )
}
