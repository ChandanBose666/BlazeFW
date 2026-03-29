import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './use-reduced-motion.js';

type ChangeListener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners: ChangeListener[] = [];

  const mql = {
    matches,
    addEventListener: (_: string, fn: ChangeListener) => listeners.push(fn),
    removeEventListener: (_: string, fn: ChangeListener) => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockReturnValue(mql),
  });

  return {
    triggerChange: (newMatches: boolean) => {
      listeners.forEach((fn) =>
        fn({ matches: newMatches } as MediaQueryListEvent)
      );
    },
    listenerCount: () => listeners.length,
  };
}

afterEach(() => {
  // Reset matchMedia mock
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: undefined,
  });
});

describe('useReducedMotion', () => {
  it('returns false when matchMedia is unavailable (SSR-like)', () => {
    // matchMedia not defined → should default to false
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns false when prefers-reduced-motion does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('updates reactively when the media query fires a change event', () => {
    const { triggerChange } = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => triggerChange(true));
    expect(result.current).toBe(true);

    act(() => triggerChange(false));
    expect(result.current).toBe(false);
  });

  it('removes the event listener on unmount', () => {
    const { listenerCount } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(listenerCount()).toBe(1);

    unmount();
    expect(listenerCount()).toBe(0);
  });

  it('returns a boolean value', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(typeof result.current).toBe('boolean');
  });

  it('re-subscribes to the media query on fresh mount', () => {
    const { listenerCount } = mockMatchMedia(false);
    const { unmount: u1 } = renderHook(() => useReducedMotion());
    expect(listenerCount()).toBe(1);
    u1();
    expect(listenerCount()).toBe(0);

    const { unmount: u2 } = renderHook(() => useReducedMotion());
    expect(listenerCount()).toBe(1);
    u2();
  });
});
