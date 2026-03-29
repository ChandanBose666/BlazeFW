/**
 * worker-proxy.ts
 *
 * Builds a recursive Proxy tree that intercepts property accesses, sets, and
 * function calls — forwarding each as a typed message to the main thread and
 * awaiting the response via a Promise.
 *
 * This module has NO dependency on Worker globals so it is fully testable in
 * Node. The actual Worker entry point (worker-entry.ts) wires up the send
 * function to `postMessage` and feeds responses into `resolveResponse`.
 */

import type { ProxyGet, ProxySet, ProxyCall, ProxyResponse, ProxyError } from './protocol.js';
import { nextId } from './protocol.js';

// ---------------------------------------------------------------------------
// Pending-call registry
// ---------------------------------------------------------------------------

export type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export type PendingMap = Map<number, PendingEntry>;

export function createPendingMap(): PendingMap {
  return new Map();
}

/**
 * Resolve or reject a pending call when the main thread responds.
 * Silently ignores unknown IDs (can happen for 'set' messages which have no
 * corresponding pending entry).
 */
export function resolveResponse(
  pending: PendingMap,
  msg: ProxyResponse | ProxyError
): void {
  const entry = pending.get(msg.id);
  if (!entry) return;
  pending.delete(msg.id);
  if (msg.type === 'error') {
    entry.reject(new Error(msg.message));
  } else {
    entry.resolve(msg.value);
  }
}

// ---------------------------------------------------------------------------
// Proxy builder
// ---------------------------------------------------------------------------

export type SendFn = (msg: ProxyGet | ProxySet | ProxyCall) => void;

/**
 * Build a recursive callable Proxy that accumulates a property path.
 *
 * - **get** trap → returns a new sub-proxy with the property appended to the
 *   path (lazy; no message is sent until a call or set is made).
 * - **set** trap → sends a `set` message to the main thread (fire-and-forget).
 * - **apply** trap → sends a `call` message and returns a Promise that
 *   resolves when the main thread responds.
 *
 * The `then` property returns `undefined` so the proxy is not mistaken for a
 * thenable by `await` or `Promise.resolve()`.
 */
export function buildProxy(
  path: string[],
  pending: PendingMap,
  send: SendFn
): unknown {
  // The target must be a function so the apply trap fires when the proxy is called.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const target = function () {} as unknown as object;

  return new Proxy(target, {
    get(_t, prop: string | symbol): unknown {
      if (typeof prop === 'symbol') return undefined;
      // Prevent async machinery from treating this proxy as a thenable.
      if (prop === 'then') return undefined;
      return buildProxy([...path, prop], pending, send);
    },

    set(_t, prop: string | symbol, value: unknown): boolean {
      if (typeof prop === 'symbol') return false;
      const id = nextId();
      send({ type: 'set', id, path: [...path, prop], value });
      return true;
    },

    apply(_t, _thisArg: unknown, args: unknown[]): Promise<unknown> {
      const id = nextId();
      return new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ type: 'call', id, path: [...path], args });
      });
    },
  });
}

// ---------------------------------------------------------------------------
// window-shaped proxy for the Worker global scope
// ---------------------------------------------------------------------------

/**
 * Worker globals that exist natively — we let the Worker use its own
 * implementations rather than proxying them to the main thread.
 */
const NATIVE_WORKER_GLOBALS = new Set([
  'fetch',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask',
  'Promise',
  'Math',
  'JSON',
  'console',
  'performance',
  'crypto',
  'self',
  'globalThis',
  'postMessage',
  'close',
  'importScripts',
  'undefined',
]);

/**
 * Build a proxy that looks like `window` from inside a Web Worker.
 *
 * - Reads of native worker globals return `undefined` so the caller falls
 *   back to the real `globalThis` value.
 * - All other reads return a `buildProxy` sub-proxy for that top-level key.
 * - Writes are forwarded as `set` messages to the main thread.
 */
export function buildWindowProxy(
  pending: PendingMap,
  send: SendFn
): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string | symbol): unknown {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then') return undefined;
      if (NATIVE_WORKER_GLOBALS.has(prop as string)) return undefined;
      return buildProxy([prop as string], pending, send);
    },

    set(_t, prop: string | symbol, value: unknown): boolean {
      if (typeof prop === 'symbol') return false;
      const id = nextId();
      send({ type: 'set', id, path: [prop as string], value });
      return true;
    },
  });
}
