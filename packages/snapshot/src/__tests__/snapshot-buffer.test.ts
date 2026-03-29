import { describe, it, expect, beforeEach } from '@jest/globals';
import { SnapshotBuffer } from '../snapshot-buffer.js';

describe('SnapshotBuffer — construction', () => {
  it('starts empty', () => {
    const buf = new SnapshotBuffer<number>();
    expect(buf.isEmpty).toBe(true);
    expect(buf.size).toBe(0);
  });

  it('reports the correct capacity', () => {
    expect(new SnapshotBuffer<number>(3).capacity).toBe(3);
    expect(new SnapshotBuffer<number>(10).capacity).toBe(10);
  });

  it('throws when maxSize < 1', () => {
    expect(() => new SnapshotBuffer(0)).toThrow(RangeError);
    expect(() => new SnapshotBuffer(-1)).toThrow(RangeError);
  });

  it('uses 5 as the default capacity', () => {
    expect(new SnapshotBuffer().capacity).toBe(5);
  });
});

describe('SnapshotBuffer — push', () => {
  it('increments size on each push', () => {
    const buf = new SnapshotBuffer<string>(5);
    buf.push('a');
    buf.push('b');
    expect(buf.size).toBe(2);
    expect(buf.isEmpty).toBe(false);
  });

  it('evicts the oldest entry when capacity is exceeded', () => {
    const buf = new SnapshotBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // evicts 1
    expect(buf.size).toBe(3);
    const all = buf.getAll();
    expect(all.map((s) => s.data)).toEqual([4, 3, 2]); // newest first
  });

  it('records the data value', () => {
    const buf = new SnapshotBuffer<string>();
    buf.push('hello');
    expect(buf.peek()?.data).toBe('hello');
  });

  it('records a timestamp close to Date.now()', () => {
    const before = Date.now();
    const buf = new SnapshotBuffer<string>();
    buf.push('x');
    const after = Date.now();
    const ts = buf.peek()!.timestamp;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('SnapshotBuffer — pop', () => {
  it('returns the most recently pushed entry', () => {
    const buf = new SnapshotBuffer<number>();
    buf.push(10);
    buf.push(20);
    expect(buf.pop()?.data).toBe(20);
  });

  it('removes the entry from the buffer', () => {
    const buf = new SnapshotBuffer<number>();
    buf.push(1);
    buf.push(2);
    buf.pop();
    expect(buf.size).toBe(1);
    expect(buf.peek()?.data).toBe(1);
  });

  it('returns undefined when empty', () => {
    expect(new SnapshotBuffer<number>().pop()).toBeUndefined();
  });

  it('allows popping all entries', () => {
    const buf = new SnapshotBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.pop()?.data).toBe(3);
    expect(buf.pop()?.data).toBe(2);
    expect(buf.pop()?.data).toBe(1);
    expect(buf.pop()).toBeUndefined();
    expect(buf.isEmpty).toBe(true);
  });
});

describe('SnapshotBuffer — peek', () => {
  it('returns the newest entry without removing it', () => {
    const buf = new SnapshotBuffer<string>();
    buf.push('first');
    buf.push('second');
    expect(buf.peek()?.data).toBe('second');
    expect(buf.size).toBe(2); // unchanged
  });

  it('returns undefined when empty', () => {
    expect(new SnapshotBuffer<string>().peek()).toBeUndefined();
  });
});

describe('SnapshotBuffer — getAll', () => {
  it('returns entries newest first', () => {
    const buf = new SnapshotBuffer<number>();
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.getAll().map((s) => s.data)).toEqual([3, 2, 1]);
  });

  it('does not mutate the buffer', () => {
    const buf = new SnapshotBuffer<number>();
    buf.push(1);
    buf.push(2);
    const all = buf.getAll();
    expect(buf.size).toBe(2);
    // Mutating the returned array should not affect the buffer
    (all as unknown as Array<unknown>).length = 0;
    expect(buf.size).toBe(2);
  });

  it('returns empty array when buffer is empty', () => {
    expect(new SnapshotBuffer<number>().getAll()).toHaveLength(0);
  });
});

describe('SnapshotBuffer — clear', () => {
  it('removes all entries', () => {
    const buf = new SnapshotBuffer<number>();
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.isEmpty).toBe(true);
    expect(buf.size).toBe(0);
  });
});
