import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitialValue(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Returns `true` when the user has requested reduced motion
 * (`prefers-reduced-motion: reduce`). Updates reactively if the
 * preference changes while the component is mounted.
 *
 * Returns `false` in SSR environments where `window` is unavailable.
 *
 * @example
 * const reduced = useReducedMotion();
 * const duration = reduced ? 0 : 300;
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(getInitialValue);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(QUERY);

    function handleChange(e: MediaQueryListEvent): void {
      setPrefersReduced(e.matches);
    }

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
}
