import { useEffect, useRef } from 'react'

/**
 * Hook to set document title and optionally restore previous title on unmount.
 * Safe under React StrictMode.
 * @param {string} title
 * @param {boolean} restoreOnUnmount
 */
export function useDocumentTitle(title, restoreOnUnmount = false) {
  const prevTitleRef = useRef(typeof document !== 'undefined' ? document.title : '')

  useEffect(() => {
    if (typeof document === 'undefined') return
    const prevTitle = prevTitleRef.current
    document.title = title

    return () => {
      if (restoreOnUnmount) {
        document.title = prevTitle
      }
    }
  }, [title, restoreOnUnmount])
}
