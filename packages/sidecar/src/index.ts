// Main-thread API
export { initSidecar, collectSidecarScripts, handleProxyRequest } from './sidecar.js';
export type { SidecarOptions, SidecarHandle, ScriptContainer } from './sidecar.js';

// Shared protocol
export { SIDECAR_SCRIPT_TYPE } from './protocol.js';
export type {
  WorkerToMain,
  MainToWorker,
  ProxyGet,
  ProxySet,
  ProxyCall,
  ProxyResponse,
  ProxyError,
  LoadScript,
} from './protocol.js';

// Worker-proxy utilities (useful for custom worker implementations)
export { createPendingMap, resolveResponse, buildProxy, buildWindowProxy } from './worker-proxy.js';
export type { PendingMap, SendFn } from './worker-proxy.js';
