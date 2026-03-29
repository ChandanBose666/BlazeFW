/**
 * worker-entry.ts — bootstrap for the sidecar Web Worker
 *
 * This file runs INSIDE a Web Worker. It:
 *
 * 1. Builds a `window` proxy that intercepts DOM accesses and forwards them
 *    to the main thread via postMessage.
 * 2. Listens for `load` messages from the main thread.
 * 3. Fetches each 3rd-party script's source, then runs it inside a Function
 *    wrapper with our proxy as `window`, `document`, and `globalThis` — so
 *    all DOM calls are intercepted.
 * 4. Forwards `response` / `error` messages back to pending proxy Promises.
 *
 * Design note — why fetch+Function rather than importScripts?
 * `importScripts` executes the script in the Worker's native global scope.
 * We would have no way to intercept `window` or `document` accesses because
 * the Worker simply doesn't have those globals. By fetching the source text
 * and running it with `new Function('window','document',…, source)` we
 * explicitly supply our proxies, giving us full interception.
 */

import {
  isMainMessage,
  type ProxyGet,
  type ProxySet,
  type ProxyCall,
} from './protocol.js';
import {
  createPendingMap,
  resolveResponse,
  buildWindowProxy,
} from './worker-proxy.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const pending = createPendingMap();

function sendToMain(msg: ProxyGet | ProxySet | ProxyCall): void {
  // `postMessage` is available in the Worker global scope
  postMessage(msg);
}

const proxyWindow = buildWindowProxy(pending, sendToMain);

// Assign proxy globals so that scripts relying on `window` / `document`
// at the top of the worker scope also get our proxy.
(globalThis as Record<string, unknown>)['window'] = proxyWindow;
(globalThis as Record<string, unknown>)['document'] = buildWindowProxy(pending, sendToMain);

// ---------------------------------------------------------------------------
// Script loader
// ---------------------------------------------------------------------------

async function loadScript(url: string): Promise<void> {
  try {
    const source = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });

    // Run the 3rd-party script with our proxy as window/document.
    // eslint-disable-next-line no-new-func
    new Function(
      'window',
      'document',
      'globalThis',
      source
    )(
      proxyWindow,
      (globalThis as Record<string, unknown>)['document'],
      globalThis
    );
  } catch (e) {
    console.error('[ultimatejs/sidecar] Failed to load script:', url, e);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

addEventListener('message', (event: MessageEvent<unknown>) => {
  const msg = event.data;
  if (!isMainMessage(msg)) return;

  if (msg.type === 'load') {
    void loadScript(msg.url);
  } else if (msg.type === 'response' || msg.type === 'error') {
    resolveResponse(pending, msg);
  }
});
