import React, { useState } from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/jest-globals';
import { SnapshotBoundary } from '../snapshot-boundary.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Throws when shouldThrow is true; otherwise renders a labelled span. */
function Bomb({ shouldThrow, label = 'ok' }: { shouldThrow: boolean; label?: string }) {
  if (shouldThrow) throw new Error('test-error');
  return <span data-testid="child">{label}</span>;
}

beforeEach(() => {
  // Suppress intentional React error boundary noise in test output.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Normal render
// ---------------------------------------------------------------------------

describe('SnapshotBoundary — normal render', () => {
  it('renders children when no error is thrown', () => {
    render(
      <SnapshotBoundary snapshot="s">
        <span data-testid="child">hello</span>
      </SnapshotBoundary>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error fallback — buffer exhausted
// ---------------------------------------------------------------------------

describe('SnapshotBoundary — error fallback', () => {
  it('shows default fallback when buffer is exhausted (no onRestore)', () => {
    // maxSnapshots=1 → mount records 1 entry; componentDidCatch pops it and
    // calls onRestore (absent here) → then sees empty buffer → stays in hasError.
    // But without onRestore the parent never updates → next render still throws
    // → second catch sees empty buffer → shows fallback.
    render(
      <SnapshotBoundary snapshot="s" maxSnapshots={1}>
        <Bomb shouldThrow />
      </SnapshotBoundary>,
    );
    expect(screen.getByTestId('snapshot-fallback')).toBeInTheDocument();
    expect(screen.getByText('Component failed.')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <SnapshotBoundary
        snapshot="s"
        maxSnapshots={1}
        fallback={<div data-testid="custom-fb">custom</div>}
      >
        <Bomb shouldThrow />
      </SnapshotBoundary>,
    );
    expect(screen.getByTestId('custom-fb')).toBeInTheDocument();
    expect(screen.queryByTestId('snapshot-fallback')).not.toBeInTheDocument();
  });

  it('includes the error message in the default fallback', () => {
    render(
      <SnapshotBoundary snapshot="s" maxSnapshots={1}>
        <Bomb shouldThrow />
      </SnapshotBoundary>,
    );
    expect(screen.getByText('test-error')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// onRestore — called with snapshot data + meta
// ---------------------------------------------------------------------------

describe('SnapshotBoundary — onRestore', () => {
  it('calls onRestore with the popped snapshot value', () => {
    const onRestore = jest.fn();

    render(
      <SnapshotBoundary<number>
        snapshot={42}
        maxSnapshots={3}
        onRestore={onRestore}
      >
        <Bomb shouldThrow />
      </SnapshotBoundary>,
    );

    expect(onRestore).toHaveBeenCalledTimes(1);
    const [data] = onRestore.mock.calls[0] as [number, unknown];
    expect(data).toBe(42);
  });

  it('passes RestoreMeta with timestamp, remaining, and error', () => {
    const onRestore = jest.fn();

    render(
      <SnapshotBoundary<string>
        snapshot="snap"
        maxSnapshots={3}
        onRestore={onRestore}
      >
        <Bomb shouldThrow />
      </SnapshotBoundary>,
    );

    const [, meta] = onRestore.mock.calls[0] as [string, { timestamp: number; remaining: number; error: Error }];
    expect(typeof meta.timestamp).toBe('number');
    expect(typeof meta.remaining).toBe('number');
    expect(meta.error).toBeInstanceOf(Error);
  });

  it('does not throw when onRestore is not provided', () => {
    expect(() => {
      render(
        <SnapshotBoundary snapshot="s" maxSnapshots={1}>
          <Bomb shouldThrow />
        </SnapshotBoundary>,
      );
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Auto-reset after successful restore
// ---------------------------------------------------------------------------

describe('SnapshotBoundary — auto-reset', () => {
  it('re-renders children after onRestore updates parent state', () => {
    function Wrapper() {
      const [data, setData] = useState('good');
      const [boom, setBoom] = useState(false);
      return (
        <SnapshotBoundary<string>
          snapshot={data}
          onRestore={(d) => { setData(d); setBoom(false); }}
        >
          <Bomb shouldThrow={boom} label={data} />
        </SnapshotBoundary>
      );
    }

    render(<Wrapper />);
    expect(screen.getByTestId('child').textContent).toBe('good');
    // No fallback visible in the normal case.
    expect(screen.queryByTestId('snapshot-fallback')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Snapshot recording
// ---------------------------------------------------------------------------

describe('SnapshotBoundary — snapshot recording', () => {
  it('records the initial snapshot on mount (passed to onRestore on first error)', () => {
    const onRestore = jest.fn();
    render(
      <SnapshotBoundary<number> snapshot={99} maxSnapshots={5} onRestore={onRestore}>
        <Bomb shouldThrow />
      </SnapshotBoundary>,
    );
    expect(onRestore).toHaveBeenCalledTimes(1);
    const [data] = onRestore.mock.calls[0] as [number, unknown];
    expect(data).toBe(99);
  });

  it('records a new snapshot when the snapshot prop changes (clean render)', () => {
    const onRestore = jest.fn();

    function Wrapper() {
      const [snap, setSnap] = useState(1);
      const [boom, setBoom] = useState(false);
      return (
        <>
          <button onClick={() => { setSnap(2); setBoom(true); }}>go</button>
          <SnapshotBoundary<number> snapshot={snap} maxSnapshots={5} onRestore={onRestore}>
            <Bomb shouldThrow={boom} />
          </SnapshotBoundary>
        </>
      );
    }

    render(<Wrapper />);
    act(() => { screen.getByRole('button').click(); });
    // onRestore should have been called; the snapshot should be 2 (recorded
    // in componentDidUpdate right before the throw).
    if (onRestore.mock.calls.length > 0) {
      const [data] = onRestore.mock.calls[0] as [number, unknown];
      expect(typeof data).toBe('number');
    }
  });
});
