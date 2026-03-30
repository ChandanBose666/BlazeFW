import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, act } from '@testing-library/react';
import { useAnnouncer } from './use-announcer.js';

function getLiveRegion(): HTMLElement | null {
  return document.querySelector('[data-blazefw-announcer]');
}

function AnnouncerFixture({
  politeness,
}: {
  politeness?: 'polite' | 'assertive';
}) {
  useAnnouncer({ politeness });
  return null;
}

describe('useAnnouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('injects a live region element into document.body', () => {
    const { unmount } = render(<AnnouncerFixture />);
    expect(getLiveRegion()).not.toBeNull();
    unmount();
  });

  it('live region has aria-live="polite" by default', () => {
    const { unmount } = render(<AnnouncerFixture />);
    expect(getLiveRegion()).toHaveAttribute('aria-live', 'polite');
    unmount();
  });

  it('live region has aria-live="assertive" when specified', () => {
    const { unmount } = render(<AnnouncerFixture politeness="assertive" />);
    expect(getLiveRegion()).toHaveAttribute('aria-live', 'assertive');
    unmount();
  });

  it('live region has aria-atomic="true"', () => {
    const { unmount } = render(<AnnouncerFixture />);
    expect(getLiveRegion()).toHaveAttribute('aria-atomic', 'true');
    unmount();
  });

  it('live region starts empty', () => {
    const { unmount } = render(<AnnouncerFixture />);
    expect(getLiveRegion()?.textContent).toBe('');
    unmount();
  });

  it('announce() sets message content after 50ms delay', () => {
    let announceRef!: (msg: string) => void;

    function Fixture() {
      const { announce } = useAnnouncer();
      announceRef = announce;
      return null;
    }

    const { unmount } = render(<Fixture />);

    act(() => {
      announceRef('3 results found');
      jest.advanceTimersByTime(49);
    });
    expect(getLiveRegion()?.textContent).toBe('');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(getLiveRegion()?.textContent).toBe('3 results found');

    unmount();
  });

  it('announcing the same message twice still triggers by clearing first', () => {
    let announceRef!: (msg: string) => void;

    function Fixture() {
      const { announce } = useAnnouncer();
      announceRef = announce;
      return null;
    }

    const { unmount } = render(<Fixture />);

    act(() => {
      announceRef('hello');
      jest.runAllTimers();
    });
    expect(getLiveRegion()?.textContent).toBe('hello');

    // Announce same string — region must be cleared first
    act(() => {
      announceRef('hello');
    });
    expect(getLiveRegion()?.textContent).toBe('');

    act(() => {
      jest.runAllTimers();
    });
    expect(getLiveRegion()?.textContent).toBe('hello');

    unmount();
  });

  it('removes the live region from document.body on unmount', () => {
    const { unmount } = render(<AnnouncerFixture />);
    expect(getLiveRegion()).not.toBeNull();
    unmount();
    expect(getLiveRegion()).toBeNull();
  });

  it('live region is visually hidden (position absolute, 1px dimensions)', () => {
    const { unmount } = render(<AnnouncerFixture />);
    const el = getLiveRegion() as HTMLElement;
    expect(el.style.position).toBe('absolute');
    expect(el.style.width).toBe('1px');
    expect(el.style.height).toBe('1px');
    unmount();
  });
});
