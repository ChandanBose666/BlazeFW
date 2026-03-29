/**
 * snapshot-boundary.tsx — React Error Boundary with automatic time-travel
 *
 * How it works:
 *
 *  1. After each successful render, the current `snapshot` prop is pushed
 *     into an internal SnapshotBuffer (ring buffer of the last N good states).
 *
 *  2. When a child throws, React calls getDerivedStateFromError → sets
 *     `hasError: true` → re-renders this boundary.
 *
 *  3. In componentDidCatch, the boundary:
 *     a. Pops the most recent snapshot from the buffer.
 *     b. Calls `props.onRestore(data, meta)` so the parent can update its state.
 *     c. Resets `hasError: false` via setState — React batches this with the
 *        parent's setState from step (b), so the children re-render with the
 *        restored state in a single pass.
 *
 *  4. If the buffer is exhausted (all snapshots tried), the boundary stays in
 *     the error state and renders `props.fallback`.
 *
 * Usage:
 *
 *   const [data, setData] = useState(initial);
 *
 *   <SnapshotBoundary
 *     snapshot={data}
 *     onRestore={(prev) => setData(prev)}
 *     maxSnapshots={5}
 *   >
 *     <MyComponent data={data} />
 *   </SnapshotBoundary>
 *
 * Or with the useSnapshot hook for less boilerplate:
 *
 *   const { value, setValue, boundaryProps } = useSnapshot(initial);
 *
 *   <SnapshotBoundary {...boundaryProps}>
 *     <MyComponent data={value} onUpdate={setValue} />
 *   </SnapshotBoundary>
 */

import React from 'react';
import { SnapshotBuffer } from './snapshot-buffer.js';

// ---------------------------------------------------------------------------
// Default fallback — hoisted outside the class so it is not recreated on
// every render (rendering-hoist-jsx) and avoids inline component definition.
// ---------------------------------------------------------------------------

function DefaultFallback({ error }: { error: Error | null }): React.ReactElement {
  return (
    <div role="alert" data-testid="snapshot-fallback">
      <strong>Component failed.</strong>
      <p>All time-travel snapshots have been exhausted.</p>
      {error !== null ? (
        <pre style={{ fontSize: 12, opacity: 0.7 }}>{error.message}</pre>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RestoreMeta {
  /** Unix timestamp when the restored snapshot was originally recorded. */
  timestamp: number;
  /**
   * Number of snapshots remaining in the buffer AFTER this restore.
   * Zero means the buffer is now empty — the next error will show the fallback.
   */
  remaining: number;
  /** The error that triggered this restore. */
  error: Error;
}

export interface SnapshotBoundaryProps<T = unknown> {
  /**
   * The state value to checkpoint after each successful render.
   * Pass the same value you render your children with so the boundary
   * always has a coherent snapshot of the last working state.
   */
  snapshot: T;
  /**
   * Called when an error triggers a time-travel restore.
   * Update your component state with the provided `data` to drive the reset.
   */
  onRestore?: (data: T, meta: RestoreMeta) => void;
  /**
   * Maximum number of historical snapshots to retain.
   * Defaults to 5. Must be ≥ 1.
   */
  maxSnapshots?: number;
  /**
   * Rendered when all snapshots have been exhausted and the component
   * still keeps throwing. Defaults to a plain error message.
   */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface BoundaryState {
  hasError: boolean;
  currentError: Error | null;
}

// ---------------------------------------------------------------------------
// SnapshotBoundary — must be a class component (hooks can't catch errors)
// ---------------------------------------------------------------------------

export class SnapshotBoundary<T = unknown> extends React.Component<
  SnapshotBoundaryProps<T>,
  BoundaryState
> {
  /** Ring buffer of successfully-rendered states. */
  private readonly buffer: SnapshotBuffer<T>;

  constructor(props: SnapshotBoundaryProps<T>) {
    super(props);
    this.state = { hasError: false, currentError: null };
    this.buffer = new SnapshotBuffer<T>(props.maxSnapshots ?? 5);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { hasError: true, currentError: error };
  }

  componentDidMount(): void {
    // Record the initial snapshot as the first known-good state.
    this.buffer.push(this.props.snapshot);
  }

  componentDidUpdate(prevProps: SnapshotBoundaryProps<T>): void {
    // Record a new snapshot whenever the state prop changes after a clean render.
    if (!this.state.hasError && prevProps.snapshot !== this.props.snapshot) {
      this.buffer.push(this.props.snapshot);
    }
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo): void {
    const entry = this.buffer.pop();

    if (!entry) {
      // All snapshots exhausted — stay in error state, show fallback.
      return;
    }

    // Notify the parent so it can update its state to the restored value.
    this.props.onRestore?.(entry.data, {
      timestamp: entry.timestamp,
      remaining: this.buffer.size,
      error,
    });

    // Reset this boundary. React batches this setState with the parent's
    // setState from onRestore, so both flush in a single render pass.
    this.setState({ hasError: false, currentError: null });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Buffer exhausted — show the permanent fallback.
      return (
        this.props.fallback ?? (
          <DefaultFallback error={this.state.currentError} />
        )
      );
    }

    return this.props.children;
  }
}
