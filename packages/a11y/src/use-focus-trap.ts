import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.closest('[inert]'));
}

export interface FocusTrapOptions {
  /** Whether the trap is active. Defaults to true. */
  enabled?: boolean;
  /** Called when Escape is pressed while the trap is active. */
  onEscape?: () => void;
}

/**
 * Trap keyboard focus within a container element.
 * Tab and Shift+Tab cycle within the container; focus is restored on deactivation.
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * useFocusTrap(ref, { enabled: isOpen, onEscape: close });
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  options: FocusTrapOptions = {}
): void {
  const { enabled = true } = options;
  // Keep callback in a ref to avoid restarting the effect on every render
  const onEscapeRef = useRef(options.onEscape);
  useEffect(() => {
    onEscapeRef.current = options.onEscape;
  });

  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    // Remember what had focus before we activated the trap
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const container = ref.current;
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (!ref.current) return;

      if (e.key === 'Escape') {
        onEscapeRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const elements = getFocusableElements(ref.current);
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (active === first || !ref.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (active === last || !ref.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that had it before the trap activated
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [enabled, ref]);
}
