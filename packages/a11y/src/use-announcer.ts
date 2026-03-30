import { useCallback, useEffect, useRef } from 'react';

export type AnnouncerPoliteness = 'polite' | 'assertive';

export interface AnnouncerOptions {
  /** Controls the urgency of the announcement. Defaults to "polite". */
  politeness?: AnnouncerPoliteness;
}

export interface AnnouncerReturn {
  /**
   * Announce a message to screen reader users via the live region.
   * The message is cleared then set after 50ms so that repeating the
   * same string still triggers a new announcement.
   */
  announce: (message: string) => void;
}

const VISUALLY_HIDDEN: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
};

/**
 * Inject a persistent ARIA live region into document.body and return an
 * `announce()` function to push messages to screen readers.
 *
 * The live region is removed from the DOM when the calling component unmounts.
 *
 * @example
 * const { announce } = useAnnouncer();
 * // later:
 * announce('3 results found');
 */
export function useAnnouncer(options: AnnouncerOptions = {}): AnnouncerReturn {
  const { politeness = 'polite' } = options;
  const elRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('data-blazefw-announcer', '');
    Object.assign(el.style, VISUALLY_HIDDEN);
    document.body.appendChild(el);
    elRef.current = el;

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      document.body.removeChild(el);
      elRef.current = null;
    };
  }, [politeness]);

  const announce = useCallback((message: string) => {
    const el = elRef.current;
    if (!el) return;

    // Clear first so re-announcing the same string still fires a mutation
    el.textContent = '';

    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (elRef.current) elRef.current.textContent = message;
    }, 50);
  }, []);

  return { announce };
}
