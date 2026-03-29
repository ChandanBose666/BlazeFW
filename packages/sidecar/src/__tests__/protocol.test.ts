import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  isWorkerMessage,
  isMainMessage,
  nextId,
  resetIdCounter,
  SIDECAR_SCRIPT_TYPE,
} from '../protocol.js';

// ---------------------------------------------------------------------------
// isWorkerMessage
// ---------------------------------------------------------------------------

describe('isWorkerMessage', () => {
  it('returns true for a get message', () => {
    expect(isWorkerMessage({ type: 'get', id: 1, path: ['document', 'title'] })).toBe(true);
  });

  it('returns true for a set message', () => {
    expect(isWorkerMessage({ type: 'set', id: 2, path: ['dataLayer'], value: [] })).toBe(true);
  });

  it('returns true for a call message', () => {
    expect(isWorkerMessage({ type: 'call', id: 3, path: ['dataLayer', 'push'], args: [{}] })).toBe(
      true
    );
  });

  it('returns false for a response message', () => {
    expect(isWorkerMessage({ type: 'response', id: 1, value: 'hello' })).toBe(false);
  });

  it('returns false for an error message', () => {
    expect(isWorkerMessage({ type: 'error', id: 1, message: 'oops' })).toBe(false);
  });

  it('returns false for a load message', () => {
    expect(isWorkerMessage({ type: 'load', url: 'https://example.com/gtm.js' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isWorkerMessage(null)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isWorkerMessage('get')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isMainMessage
// ---------------------------------------------------------------------------

describe('isMainMessage', () => {
  it('returns true for a response message', () => {
    expect(isMainMessage({ type: 'response', id: 1, value: 42 })).toBe(true);
  });

  it('returns true for an error message', () => {
    expect(isMainMessage({ type: 'error', id: 1, message: 'fail' })).toBe(true);
  });

  it('returns true for a load message', () => {
    expect(isMainMessage({ type: 'load', url: 'https://example.com/gtm.js' })).toBe(true);
  });

  it('returns false for a get message', () => {
    expect(isMainMessage({ type: 'get', id: 1, path: [] })).toBe(false);
  });

  it('returns false for a set message', () => {
    expect(isMainMessage({ type: 'set', id: 1, path: [], value: null })).toBe(false);
  });

  it('returns false for an object with an unknown type', () => {
    expect(isMainMessage({ type: 'ping' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nextId / resetIdCounter
// ---------------------------------------------------------------------------

describe('nextId', () => {
  beforeEach(() => resetIdCounter());

  it('starts at 1 after reset', () => {
    expect(nextId()).toBe(1);
  });

  it('increments on each call', () => {
    expect(nextId()).toBe(1);
    expect(nextId()).toBe(2);
    expect(nextId()).toBe(3);
  });

  it('never returns the same value twice in sequence', () => {
    const ids = Array.from({ length: 10 }, nextId);
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// SIDECAR_SCRIPT_TYPE
// ---------------------------------------------------------------------------

describe('SIDECAR_SCRIPT_TYPE', () => {
  it('equals "text/ultimatejs"', () => {
    expect(SIDECAR_SCRIPT_TYPE).toBe('text/ultimatejs');
  });
});
