import { useRef } from 'react'

export function SegmentedControl({
  options = [],
  value,
  onChange,
  label = 'View options',
  className = ''
}) {
  const tabsRef = useRef([])

  const handleKeyDown = (e, index) => {
    let nextIndex

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (index + 1) % options.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (index - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = options.length - 1
    } else {
      return
    }

    const nextOption = options[nextIndex]
    if (nextOption) {
      onChange?.(nextOption.value)
      tabsRef.current[nextIndex]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`segmented-control ${className}`.trim()}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => (tabsRef.current[index] = el)}
            role="tab"
            type="button"
            data-tab={option.value}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange?.(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`segment-item ${isSelected ? 'segment-item-active' : ''}`}
          >
            {option.icon && <span style={{ marginRight: 6, display: 'inline-flex' }}>{option.icon}</span>}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
