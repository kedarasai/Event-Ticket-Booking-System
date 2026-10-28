import { useEffect, useRef, useState } from 'react'

/**
 * Hook to reveal an element when it scrolls into view via IntersectionObserver.
 * Safe under React StrictMode (cleans up observer).
 * @param {Object} options - IntersectionObserverInit options
 * @returns {[React.RefObject, boolean]} [ref, isRevealed]
 */
export function useReveal(options = {}) {
  const [isRevealed, setIsRevealed] = useState(() => {
    return typeof IntersectionObserver === 'undefined'
  })
  const elementRef = useRef(null)
  const { threshold = 0.15, rootMargin = '0px 0px -40px 0px' } = options

  useEffect(() => {
    const node = elementRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    let observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsRevealed(true)
        if (observer) {
          observer.unobserve(node)
          observer.disconnect()
          observer = null
        }
      }
    }, { threshold, rootMargin })

    observer.observe(node)

    return () => {
      if (observer) {
        observer.unobserve(node)
        observer.disconnect()
      }
    }
  }, [threshold, rootMargin])

  return [elementRef, isRevealed]
}
