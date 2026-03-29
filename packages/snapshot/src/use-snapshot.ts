/**
 * use-snapshot.ts — convenience hook for the SnapshotBoundary
 *
 * Manages the snapshotted state and wires up the boundary's `onRestore`
 * callback automatically, so you don't need to write that plumbing yourself.
 *
 * Usage:
 *
 *   const { value, setValue, boundaryProps } = useSnapshot(initialData);
 *
 *   <SnapshotBoundary {...boundaryProps} maxSnapshots={5}>
 *     <MyComponent data={value} onUpdate={setValue} />
 *   </SnapshotBoundary>
 *
 * When a child throws, the boundary calls `onRestore` → which calls `setValue`
 * with the previous snapshot → React re-renders children with the restored
 * data, and the boundary resets in the same flush.
 */

import { useCallback, useState } from 'react';
import type { SnapshotBoundaryProps, RestoreMeta } from './snapshot-boundary.js';

export interface UseSnapshotOptions {
  /** Maximum snapshots the SnapshotBoundary should retain. Default: 5 */
  maxSnapshots?: number;
}

export interface UseSnapshotResult<T> {
  /** Current value — pass this to both your children and SnapshotBoundary. */
  value: T;
  /**
   * Setter — updates the value and causes the boundary to record a new
   * snapshot after the next successful render.
   * Uses functional setState so the callback reference is stable
   * (rerender-functional-setstate).
   */
  setValue: (newValue: T | ((prev: T) => T)) => void;
  /**
   * Spread these onto `<SnapshotBoundary>` to wire up the boundary:
   *
   *   <SnapshotBoundary {...boundaryProps}>…</SnapshotBoundary>
   */
  boundaryProps: Pick<SnapshotBoundaryProps<T>, 'snapshot' | 'onRestore' | 'maxSnapshots'>;
}

export function useSnapshot<T>(
  initial: T,
  opts?: UseSnapshotOptions
): UseSnapshotResult<T> {
  const [value, setValueRaw] = useState<T>(initial);

  // Stable setter — uses functional setState so callers can safely pass
  // it as a dep-free callback (rerender-functional-setstate).
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValueRaw(newValue as T | ((prev: T) => T));
  }, []);

  // Stable onRestore — restores state to the snapshot the boundary popped.
  // Defined with useCallback so its reference never changes between renders,
  // preventing the SnapshotBoundary from re-recording snapshots spuriously.
  const onRestore = useCallback((data: T, _meta: RestoreMeta) => {
    setValueRaw(data);
  }, []);

  const boundaryProps: UseSnapshotResult<T>['boundaryProps'] = {
    snapshot: value,
    onRestore,
    maxSnapshots: opts?.maxSnapshots,
  };

  return { value, setValue, boundaryProps };
}
