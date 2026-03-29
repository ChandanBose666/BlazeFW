/**
 * snapshot-buffer.ts — generic ring buffer for time-travel history
 *
 * Stores the last N successfully-rendered states. When a component throws,
 * the SnapshotBoundary pops the most recent entry and restores to it.
 * Older entries remain available for deeper time travel.
 *
 * This module has no React dependency — fully testable in Node.
 */

export interface Snapshot<T> {
  /** The captured state value. */
  readonly data: T;
  /** Unix timestamp (ms) when the snapshot was recorded. */
  readonly timestamp: number;
}

/**
 * Fixed-capacity FIFO ring buffer.
 *
 * - `push(data)` — append; oldest entry evicted when capacity is exceeded.
 * - `pop()`      — remove and return the newest entry (LIFO for time-travel).
 * - `peek()`     — view the newest entry without removing it.
 * - `getAll()`   — all entries, newest first (non-mutating).
 */
export class SnapshotBuffer<T> {
  private readonly maxSize: number;
  private items: Array<Snapshot<T>> = [];

  constructor(maxSize = 5) {
    if (maxSize < 1) throw new RangeError('maxSize must be at least 1');
    this.maxSize = maxSize;
  }

  /** Record a new snapshot. Evicts the oldest entry if at capacity. */
  push(data: T): void {
    this.items.push({ data, timestamp: Date.now() });
    if (this.items.length > this.maxSize) {
      this.items.shift(); // evict oldest
    }
  }

  /**
   * Remove and return the most recent snapshot (last-in, first-out).
   * Returns `undefined` when the buffer is empty.
   */
  pop(): Snapshot<T> | undefined {
    return this.items.pop();
  }

  /**
   * Return the most recent snapshot without removing it.
   * Returns `undefined` when the buffer is empty.
   */
  peek(): Snapshot<T> | undefined {
    return this.items[this.items.length - 1];
  }

  /** Current number of stored snapshots. */
  get size(): number {
    return this.items.length;
  }

  /** `true` when no snapshots are stored. */
  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Return a copy of all stored snapshots, newest first.
   * Does not mutate the buffer.
   */
  getAll(): ReadonlyArray<Snapshot<T>> {
    return [...this.items].reverse();
  }

  /** Remove all stored snapshots. */
  clear(): void {
    this.items = [];
  }

  /** Maximum number of snapshots this buffer can hold. */
  get capacity(): number {
    return this.maxSize;
  }
}
