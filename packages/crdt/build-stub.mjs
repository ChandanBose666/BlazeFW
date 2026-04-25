/**
 * Generates a stub pkg/ directory when wasm-pack is not available (CI/Vercel).
 * Provides type declarations and a JS shim so downstream packages (e.g. @blazefw/core)
 * can compile. The actual WASM functionality is not available — only for static deploys
 * where sync is disabled.
 */
import { mkdirSync, writeFileSync } from 'fs'

console.log('[blazefw/crdt] wasm-pack not found — generating type stubs for CI')

mkdirSync('pkg', { recursive: true })

// Type declarations — matches wasm-pack output
writeFileSync('pkg/ultimate_crdt.d.ts', `
export class CrdtDoc {
  free(): void;
  [Symbol.dispose](): void;
  delete(key: string): void;
  get(key: string): string | undefined;
  get_json(key: string): string;
  keys(): string;
  static load(data: Uint8Array): CrdtDoc;
  merge(data: Uint8Array): void;
  constructor();
  save(): Uint8Array;
  set(key: string, value: string): void;
  set_bool(key: string, value: boolean): void;
  set_number(key: string, value: number): void;
}
export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export interface InitOutput { readonly memory: WebAssembly.Memory; }
export type SyncInitInput = BufferSource | WebAssembly.Module;
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
export default function __wbg_init(module_or_path?: any): Promise<InitOutput>;
`)

// JS shim — throws at runtime if anyone actually tries to use it
writeFileSync('pkg/ultimate_crdt.js', `
const STUB_ERROR = '[blazefw/crdt] WASM module not built — run wasm-pack or enable Rust in your environment';
export class CrdtDoc {
  constructor() { throw new Error(STUB_ERROR); }
}
export function initSync() { throw new Error(STUB_ERROR); }
export default function __wbg_init() { return Promise.reject(new Error(STUB_ERROR)); }
`)

// WASM type stub
writeFileSync('pkg/ultimate_crdt_bg.wasm.d.ts', `
export const memory: WebAssembly.Memory;
`)

console.log('[blazefw/crdt] Stubs written to pkg/ — TypeScript compilation will succeed')
