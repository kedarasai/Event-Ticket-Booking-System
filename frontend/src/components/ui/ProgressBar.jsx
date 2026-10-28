export function ProgressBar({
  value = 0,
  max = 100,
  label = null,
  showPercentage = false,
  className = '',
  ...props
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)))

  return (
    <div className={`progress-bar-wrapper ${className}`.trim()} {...props}>
      {(label || showPercentage) && (
        <div className="progress-bar-header">
          {label && <span>{label}</span>}
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={label || 'Progress'}
        className="progress-bar-track"
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
