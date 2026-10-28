import { useState, useId, forwardRef } from 'react'

export const Input = forwardRef(function Input(
  {
    id: explicitId,
    label,
    type = 'text',
    hint = null,
    error = null,
    icon = null,
    className = '',
    disabled = false,
    ...props
  },
  ref
) {
  const generatedId = useId()
  const inputId = explicitId || generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const computedType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className={`input-wrapper ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}

      <div className={`input-container ${error ? 'input-has-error' : ''}`}>
        {icon && (
          <span className="input-icon-slot" aria-hidden="true">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={computedType}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className="input-field"
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="input-toggle-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {showPassword ? 'HIDE' : 'SHOW'}
            </span>
          </button>
        )}
      </div>

      {error ? (
        <p id={errorId} className="input-error-msg" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="input-hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
