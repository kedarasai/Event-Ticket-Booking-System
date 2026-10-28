import { useMediaQuery } from './useMediaQuery'

/**
 * Hook to detect user's prefers-reduced-motion preference.
 * Safe under React StrictMode.
 * @returns {boolean}
 */
export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
