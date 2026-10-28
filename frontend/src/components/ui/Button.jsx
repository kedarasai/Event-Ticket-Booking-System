import { Spinner } from './Spinner'

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading

  const variantClass = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-danger'
  }[variant] || 'btn-primary'

  const sizeClass = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg'
  }[size] || 'btn-md'

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size={size === 'lg' ? 'md' : 'sm'} color="currentColor" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && <span className="btn-icon" aria-hidden="true">{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
}
