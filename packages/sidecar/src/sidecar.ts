/**
 * sidecar.ts — main-thread entry point
 *
 * Responsibilities:
 * 1. Scan the document for `<script type="text/ultimatejs">` tags.
 * 2. Spawn a Web Worker and forward each script URL to it.
 * 3. Observe the DOM for dynamically injected sidecar scripts.
 * 4. Handle DOM proxy requests from the worker (get / set / call).
 * 5. Return a handle that lets the caller tear everything down.
 */

import {
  SIDECAR_SCRIPT_TYPE,
  isWorkerMessage,
  type WorkerToMain,
  type MainToWorker,
  type ProxyResponse,
  type ProxyError,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SidecarOptions {
  /**
   * The `type` attribute value that opts a `<script>` tag into the sidecar
   * worker. Defaults to `"text/ultimatejs"`.
   */
  scriptType?: string;

  /**
   * URL of the compiled sidecar worker script.
   * Defaults to `"./sidecar.worker.js"`.
   *
   * In a Vite project you can use:
   *   `import workerUrl from '@blazefw/sidecar/worker?url'`
   */
  workerUrl?: string;
}

export interface SidecarHandle {
  /** The underlying Worker instance. */
  readonly worker: Worker;
  /** Disconnect the MutationObserver and terminate the Worker. */
  destroy(): void;
}

/**
 * Minimal interface for a DOM container that supports `querySelectorAll`.
 * Accepting this instead of `Document` directly makes `collectSidecarScripts`
 * testable in Node without jsdom.
 */
export interface ScriptContainer {
  querySelectorAll(selector: string): ArrayLike<{ src: string }>;
}

// ---------------------------------------------------------------------------
// Script collection
// ---------------------------------------------------------------------------

/**
 * Return the `src` URLs of all `<script>` elements in `container` whose
 * `type` attribute equals `scriptType`. Inline scripts (no `src`) are skipped.
 */
export function collectSidecarScripts(
  container: ScriptContainer,
  scriptType = SIDECAR_SCRIPT_TYPE
): string[] {
  const nodes = container.querySelectorAll(`script[type="${scriptType}"]`);
  const urls: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const src = nodes[i].src;
    if (src) urls.push(src);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// DOM proxy request handler
// ---------------------------------------------------------------------------

/**
 * Navigate `path` on `root`, returning the final parent object and key.
 * Returns `null` when any intermediate segment is not an object.
 */
function resolvePath(
  root: Record<string, unknown>,
  path: string[]
): { parent: Record<string, unknown>; key: string } | null {
  if (path.length === 0) return null;
  let obj: unknown = root;
  for (let i = 0; i < path.length - 1; i++) {
    if (obj == null || typeof obj !== 'object') return null;
    obj = (obj as Record<string, unknown>)[path[i]];
  }
  if (obj == null || typeof obj !== 'object') return null;
  return { parent: obj as Record<string, unknown>, key: path[path.length - 1] };
}

/**
 * Execute a proxy request from the worker against the real window object.
 *
 * - `get` → returns the property value
 * - `set` → assigns the value; returns `undefined`
 * - `call` → invokes the function with the given args; returns the result
 *
 * Returns `undefined` when the path cannot be resolved.
 */
export function handleProxyRequest(
  win: Record<string, unknown>,
  msg: WorkerToMain
): unknown {
  const resolved = resolvePath(win, msg.path);
  if (!resolved) return undefined;
  const { parent, key } = resolved;

  switch (msg.type) {
    case 'get':
      return parent[key];

    case 'set':
      parent[key] = msg.value;
      return undefined;

    case 'call': {
      const fn = parent[key];
      if (typeof fn !== 'function') return undefined;
      return (fn as (...a: unknown[]) => unknown).apply(parent, msg.args);
    }
  }
}

// ---------------------------------------------------------------------------
// initSidecar
// ---------------------------------------------------------------------------

const DEFAULT_WORKER_URL = './sidecar.worker.js';

/**
 * Initialise the sidecar on the main thread.
 *
 * 1. Creates the Worker.
 * 2. Collects existing sidecar script tags and sends `load` messages.
 * 3. Sets up a MutationObserver for dynamically added scripts.
 * 4. Handles proxy requests from the Worker and replies with results.
 */
export function initSidecar(opts?: SidecarOptions): SidecarHandle {
  const scriptType = opts?.scriptType ?? SIDECAR_SCRIPT_TYPE;
  const workerUrl = opts?.workerUrl ?? DEFAULT_WORKER_URL;

  const worker = new Worker(workerUrl, { type: 'module' });

  // Send already-present sidecar scripts to the worker
  const urls = collectSidecarScripts(document, scriptType);
  for (const url of urls) {
    worker.postMessage({ type: 'load', url } satisfies MainToWorker);
  }

  // Handle DOM proxy requests from the worker
  const win = globalThis as unknown as Record<string, unknown>;

  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    const msg = event.data;
    if (!isWorkerMessage(msg)) return;

    // 'set' is fire-and-forget — no reply needed
    if (msg.type === 'set') {
      try {
        handleProxyRequest(win, msg);
      } catch {
        // ignore set errors silently
      }
      return;
    }

    let value: unknown;
    let errorMsg: string | undefined;
    try {
      value = handleProxyRequest(win, msg);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    const reply: MainToWorker = errorMsg
      ? ({ type: 'error', id: msg.id, message: errorMsg } satisfies ProxyError)
      : ({ type: 'response', id: msg.id, value } satisfies ProxyResponse);

    worker.postMessage(reply);
  });

  // Watch for scripts added after page load (e.g. via tag managers)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLScriptElement &&
          node.type === scriptType &&
          node.src
        ) {
          worker.postMessage({ type: 'load', url: node.src } satisfies MainToWorker);
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  return {
    worker,
    destroy() {
      observer.disconnect();
      worker.terminate();
    },
  };
}
