import { useCallback, useSyncExternalStore } from 'react'

/**
 * Hook to evaluate a CSS media query string using useSyncExternalStore.
 * Safe under React StrictMode (cleans up listener).
 * @param {string} query - CSS media query (e.g. '(min-width: 768px)')
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (callback) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {}
      }
      const mediaQuery = window.matchMedia(query)
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', callback)
        return () => mediaQuery.removeEventListener('change', callback)
      } else {
        mediaQuery.addListener(callback)
        return () => mediaQuery.removeListener(callback)
      }
    },
    [query]
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }, [query])

  const getServerSnapshot = () => false

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
