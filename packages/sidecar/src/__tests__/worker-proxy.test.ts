import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  buildProxy,
  buildWindowProxy,
  createPendingMap,
  resolveResponse,
} from '../worker-proxy.js';
import { resetIdCounter } from '../protocol.js';
import type { ProxyGet, ProxySet, ProxyCall } from '../protocol.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SentMessage = ProxyGet | ProxySet | ProxyCall;

function makeContext() {
  const sent: SentMessage[] = [];
  const pending = createPendingMap();
  const send = (msg: SentMessage) => sent.push(msg);
  return { sent, pending, send };
}

// ---------------------------------------------------------------------------
// buildProxy — apply trap (call)
// ---------------------------------------------------------------------------

describe('buildProxy — call', () => {
  beforeEach(() => resetIdCounter());

  it('sends a call message when invoked', () => {
    const { sent, pending, send } = makeContext();
    const fn = buildProxy(['dataLayer', 'push'], pending, send) as (...a: unknown[]) => unknown;
    void fn({ event: 'pageview' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'call', path: ['dataLayer', 'push'] });
  });

  it('includes the supplied args in the call message', () => {
    const { sent, pending, send } = makeContext();
    const fn = buildProxy(['console', 'log'], pending, send) as (...a: unknown[]) => unknown;
    void fn('hello', 42);
    expect(sent[0]).toMatchObject({ type: 'call', args: ['hello', 42] });
  });

  it('returns a Promise', () => {
    const { pending, send } = makeContext();
    const fn = buildProxy(['fn'], pending, send) as (...a: unknown[]) => unknown;
    const result = fn();
    expect(result).toBeInstanceOf(Promise);
  });

  it('Promise resolves with the response value', async () => {
    const { sent, pending, send } = makeContext();
    const fn = buildProxy(['fn'], pending, send) as (...a: unknown[]) => Promise<unknown>;
    const promise = fn('arg');
    // Simulate main-thread response
    resolveResponse(pending, { type: 'response', id: (sent[0] as ProxyCall).id, value: 'result' });
    await expect(promise).resolves.toBe('result');
  });

  it('Promise rejects on an error response', async () => {
    const { sent, pending, send } = makeContext();
    const fn = buildProxy(['fn'], pending, send) as (...a: unknown[]) => Promise<unknown>;
    const promise = fn();
    resolveResponse(pending, {
      type: 'error',
      id: (sent[0] as ProxyCall).id,
      message: 'not a function',
    });
    await expect(promise).rejects.toThrow('not a function');
  });
});

// ---------------------------------------------------------------------------
// buildProxy — set trap
// ---------------------------------------------------------------------------

describe('buildProxy — set', () => {
  beforeEach(() => resetIdCounter());

  it('sends a set message when a property is assigned', () => {
    const { sent, pending, send } = makeContext();
    const proxy = buildProxy([], pending, send) as Record<string, unknown>;
    proxy['dataLayer'] = [];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'set', path: ['dataLayer'], value: [] });
  });
});

// ---------------------------------------------------------------------------
// buildProxy — get trap (returns sub-proxy)
// ---------------------------------------------------------------------------

describe('buildProxy — get', () => {
  beforeEach(() => resetIdCounter());

  it('returns a truthy value (sub-proxy) without sending a message', () => {
    const { sent, pending, send } = makeContext();
    const proxy = buildProxy([], pending, send) as Record<string, unknown>;
    const sub = proxy['dataLayer'];
    expect(sub).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('accumulates the path so the eventual call uses the full path', () => {
    const { sent, pending, send } = makeContext();
    const win = buildProxy([], pending, send) as Record<string, unknown>;
    const layer = win['dataLayer'] as Record<string, unknown>;
    const push = layer['push'] as (...a: unknown[]) => unknown;
    void push({ event: 'click' });
    expect(sent[0]).toMatchObject({ type: 'call', path: ['dataLayer', 'push'] });
  });

  it('returns undefined for the "then" property (not thenable)', () => {
    const { pending, send } = makeContext();
    const proxy = buildProxy(['x'], pending, send) as Record<string, unknown>;
    expect(proxy['then']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveResponse
// ---------------------------------------------------------------------------

describe('resolveResponse', () => {
  beforeEach(() => resetIdCounter());

  it('resolves the matching pending entry', async () => {
    const pending = createPendingMap();
    const p = new Promise<unknown>((resolve, reject) => pending.set(7, { resolve, reject }));
    resolveResponse(pending, { type: 'response', id: 7, value: 'ok' });
    await expect(p).resolves.toBe('ok');
  });

  it('rejects the matching pending entry on error', async () => {
    const pending = createPendingMap();
    const p = new Promise<unknown>((resolve, reject) => pending.set(8, { resolve, reject }));
    resolveResponse(pending, { type: 'error', id: 8, message: 'boom' });
    await expect(p).rejects.toThrow('boom');
  });

  it('silently ignores an unknown id', () => {
    const pending = createPendingMap();
    expect(() =>
      resolveResponse(pending, { type: 'response', id: 999, value: null })
    ).not.toThrow();
  });

  it('removes the entry from the map after resolution', async () => {
    const pending = createPendingMap();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    pending.set(5, { resolve: () => {}, reject: () => {} });
    resolveResponse(pending, { type: 'response', id: 5, value: undefined });
    expect(pending.has(5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildWindowProxy
// ---------------------------------------------------------------------------

describe('buildWindowProxy', () => {
  beforeEach(() => resetIdCounter());

  it('forwards a set to the main thread', () => {
    const { sent, pending, send } = makeContext();
    const win = buildWindowProxy(pending, send);
    win['dataLayer'] = [];
    expect(sent[0]).toMatchObject({ type: 'set', path: ['dataLayer'], value: [] });
  });

  it('returns undefined for native worker globals (no proxy needed)', () => {
    const { pending, send } = makeContext();
    const win = buildWindowProxy(pending, send);
    // 'fetch' is a native worker global — should not return a proxy
    expect(win['fetch']).toBeUndefined();
  });

  it('returns a truthy proxy for non-native properties', () => {
    const { pending, send } = makeContext();
    const win = buildWindowProxy(pending, send);
    expect(win['dataLayer']).toBeTruthy();
  });
});
