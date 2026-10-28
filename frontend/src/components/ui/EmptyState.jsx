export function EmptyState({
  title = 'No Items Found',
  description = 'There is nothing to display here right now.',
  icon = null,
  action = null,
  className = '',
  ...props
}) {
  return (
    <div className={`empty-state ${className}`.trim()} {...props}>
      <div className="empty-state-icon">
        {icon ? (
          icon
        ) : (
        <svg
          width="120"
          height="100"
          viewBox="0 0 120 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Subtle background glow */}
          <circle cx="60" cy="50" r="40" fill="url(#empty-glow)" opacity="0.3" />

          {/* Ticket Shape */}
          <path
            d="M25 32C25 28.6863 27.6863 26 31 26H89C92.3137 26 95 28.6863 95 32V42C91.6863 42 89 44.6863 89 48C89 51.3137 91.6863 54 95 54V64C95 67.3137 92.3137 70 89 70H31C27.6863 70 25 67.3137 25 64V54C28.3137 54 31 51.3137 31 48C31 44.6863 28.3137 42 25 42V32Z"
            stroke="url(#empty-border)"
            strokeWidth="2"
            fill="rgba(255, 255, 255, 0.03)"
          />

          {/* Perforated Divider */}
          <line x1="72" y1="28" x2="72" y2="68" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" strokeDasharray="4 4" />

          {/* Stub Lines */}
          <rect x="36" y="38" width="24" height="4" rx="2" fill="rgba(34, 211, 238, 0.6)" />
          <rect x="36" y="46" width="16" height="3" rx="1.5" fill="rgba(163, 163, 189, 0.4)" />
          <rect x="36" y="53" width="20" height="3" rx="1.5" fill="rgba(163, 163, 189, 0.3)" />

          {/* Star Accent */}
          <path
            d="M80 43L81.2 46.8L85 48L81.2 49.2L80 53L78.8 49.2L75 48L78.8 46.8L80 43Z"
            fill="#fbbf24"
          />

          {/* Gradients */}
          <defs>
            <radialGradient id="empty-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 50) rotate(90) scale(40)">
              <stop stopColor="#7c3aed" stopOpacity="0.6" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="empty-border" x1="25" y1="26" x2="95" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7c3aed" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        )}
      </div>

      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}
