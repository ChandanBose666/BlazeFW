/** Default `type` attribute value that opts a script tag into the sidecar worker. */
export const SIDECAR_SCRIPT_TYPE = 'text/ultimatejs';

// ---------------------------------------------------------------------------
// Worker → Main (proxy access requests)
// ---------------------------------------------------------------------------

export interface ProxyGet {
  type: 'get';
  id: number;
  path: string[];
}

export interface ProxySet {
  type: 'set';
  id: number;
  path: string[];
  value: unknown;
}

export interface ProxyCall {
  type: 'call';
  id: number;
  path: string[];
  args: unknown[];
}

// ---------------------------------------------------------------------------
// Main → Worker (responses + load commands)
// ---------------------------------------------------------------------------

export interface ProxyResponse {
  type: 'response';
  id: number;
  value: unknown;
}

export interface ProxyError {
  type: 'error';
  id: number;
  message: string;
}

export interface LoadScript {
  type: 'load';
  url: string;
}

// ---------------------------------------------------------------------------
// Union types
// ---------------------------------------------------------------------------

/** Messages the worker sends to the main thread (DOM proxy requests). */
export type WorkerToMain = ProxyGet | ProxySet | ProxyCall;

/** Messages the main thread sends to the worker (responses + script load commands). */
export type MainToWorker = ProxyResponse | ProxyError | LoadScript;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isWorkerMessage(msg: unknown): msg is WorkerToMain {
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return false;
  const t = (msg as { type: string }).type;
  return t === 'get' || t === 'set' || t === 'call';
}

export function isMainMessage(msg: unknown): msg is MainToWorker {
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return false;
  const t = (msg as { type: string }).type;
  return t === 'response' || t === 'error' || t === 'load';
}

// ---------------------------------------------------------------------------
// Monotonic ID counter (shared across both sides via import)
// ---------------------------------------------------------------------------

let _id = 0;

export function nextId(): number {
  return ++_id;
}

/** Reset to zero — for tests only. */
export function resetIdCounter(): void {
  _id = 0;
}
