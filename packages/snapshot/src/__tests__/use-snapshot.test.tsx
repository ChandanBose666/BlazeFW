import { describe, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useSnapshot } from '../use-snapshot.js';

describe('useSnapshot — initial state', () => {
  it('returns the initial value', () => {
    const { result } = renderHook(() => useSnapshot('hello'));
    expect(result.current.value).toBe('hello');
  });

  it('works with object types', () => {
    const initial = { count: 0 };
    const { result } = renderHook(() => useSnapshot(initial));
    expect(result.current.value).toBe(initial);
  });

  it('works with number types', () => {
    const { result } = renderHook(() => useSnapshot(0));
    expect(result.current.value).toBe(0);
  });
});

describe('useSnapshot — setValue', () => {
  it('updates the value on direct assignment', () => {
    const { result } = renderHook(() => useSnapshot('initial'));
    act(() => { result.current.setValue('updated'); });
    expect(result.current.value).toBe('updated');
  });

  it('updates the value with a functional updater', () => {
    const { result } = renderHook(() => useSnapshot(0));
    act(() => { result.current.setValue((prev) => prev + 1); });
    expect(result.current.value).toBe(1);
  });

  it('setValue reference is stable across renders', () => {
    const { result, rerender } = renderHook(() => useSnapshot('a'));
    const first = result.current.setValue;
    act(() => { result.current.setValue('b'); });
    rerender();
    expect(result.current.setValue).toBe(first);
  });
});

describe('useSnapshot — boundaryProps', () => {
  it('boundaryProps.snapshot mirrors the current value', () => {
    const { result } = renderHook(() => useSnapshot('x'));
    expect(result.current.boundaryProps.snapshot).toBe('x');
    act(() => { result.current.setValue('y'); });
    expect(result.current.boundaryProps.snapshot).toBe('y');
  });

  it('boundaryProps.onRestore restores the value', () => {
    const { result } = renderHook(() => useSnapshot('original'));
    act(() => { result.current.setValue('changed'); });
    expect(result.current.value).toBe('changed');
    // Simulate the boundary calling onRestore
    act(() => {
      result.current.boundaryProps.onRestore?.('original', {
        timestamp: Date.now(),
        remaining: 0,
        error: new Error('test'),
      });
    });
    expect(result.current.value).toBe('original');
  });

  it('boundaryProps.onRestore reference is stable', () => {
    const { result, rerender } = renderHook(() => useSnapshot('a'));
    const first = result.current.boundaryProps.onRestore;
    act(() => { result.current.setValue('b'); });
    rerender();
    expect(result.current.boundaryProps.onRestore).toBe(first);
  });

  it('boundaryProps.maxSnapshots defaults to undefined when not provided', () => {
    const { result } = renderHook(() => useSnapshot('v'));
    expect(result.current.boundaryProps.maxSnapshots).toBeUndefined();
  });

  it('boundaryProps.maxSnapshots reflects the provided option', () => {
    const { result } = renderHook(() => useSnapshot('v', { maxSnapshots: 10 }));
    expect(result.current.boundaryProps.maxSnapshots).toBe(10);
  });
});
