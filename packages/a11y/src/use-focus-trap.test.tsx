import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from './use-focus-trap.js';

// Minimal fixture that wraps useFocusTrap
function Fixture({
  enabled = true,
  onEscape,
}: {
  enabled?: boolean;
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, { enabled, onEscape });
  return (
    <div ref={ref}>
      <button>First</button>
      <button>Second</button>
      <button>Last</button>
    </div>
  );
}

function EmptyFixture() {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return <div ref={ref}><span>no focusable</span></div>;
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element on activation', () => {
    const { getByText } = render(<Fixture />);
    expect(document.activeElement).toBe(getByText('First'));
  });

  it('wraps Tab forward from last element to first', () => {
    const { getByText } = render(<Fixture />);
    const last = getByText('Last');
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(getByText('First'));
  });

  it('wraps Shift+Tab backward from first element to last', () => {
    const { getByText } = render(<Fixture />);
    const first = getByText('First');
    first.focus();

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByText('Last'));
  });

  it('does not wrap Tab when focus is on a middle element', () => {
    const { getByText } = render(<Fixture />);
    const second = getByText('Second');
    second.focus();

    fireEvent.keyDown(second, { key: 'Tab', shiftKey: false });
    // focus stays on second — no wrap, natural browser tab takes over
    expect(document.activeElement).toBe(second);
  });

  it('does not wrap Shift+Tab when focus is on a middle element', () => {
    const { getByText } = render(<Fixture />);
    const second = getByText('Second');
    second.focus();

    fireEvent.keyDown(second, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it('calls onEscape when Escape key is pressed', () => {
    const onEscape = jest.fn();
    const { getByText } = render(<Fixture onEscape={onEscape} />);

    fireEvent.keyDown(getByText('First'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not call onEscape for other keys', () => {
    const onEscape = jest.fn();
    const { getByText } = render(<Fixture onEscape={onEscape} />);

    fireEvent.keyDown(getByText('First'), { key: 'Enter' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does not move focus when enabled=false', () => {
    const before = document.activeElement;
    render(<Fixture enabled={false} />);
    // Should not have moved focus away from whatever was active
    expect(document.activeElement).toBe(before);
  });

  it('handles a container with no focusable elements gracefully', () => {
    expect(() => render(<EmptyFixture />)).not.toThrow();
  });

  it('restores focus to the previously focused element on unmount', () => {
    // Create a button outside and focus it before mounting the trap
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { unmount } = render(<Fixture />);
    // Trap should have stolen focus
    expect(document.activeElement).not.toBe(outside);

    unmount();
    // Focus should be restored
    expect(document.activeElement).toBe(outside);

    document.body.removeChild(outside);
  });
});
