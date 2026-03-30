/**
 * Lazy singleton loader for the @blazefw/crdt WASM module.
 *
 * wasm-pack's `--target web` output requires an explicit async `init()`
 * call before any WASM functions can be used. This module ensures the
 * init runs exactly once across the entire app, regardless of how many
 * useSync hooks are mounted concurrently.
 */

import type { CrdtDoc } from "@blazefw/crdt";

// The wasm-pack generated entry point. We import it as a type-only module
// here and dynamically import at runtime so the WASM binary is only fetched
// when actually needed (lazy-loading friendly).
type CrdtModule = {
  default: (input?: unknown) => Promise<unknown>;
  CrdtDoc: typeof CrdtDoc;
};

let moduleCache: CrdtModule | null = null;
let initPromise: Promise<CrdtModule> | null = null;

/**
 * Load and initialise the CRDT WASM module exactly once.
 * Safe to call concurrently — all callers await the same promise.
 */
export async function loadCrdtModule(): Promise<CrdtModule> {
  if (moduleCache) return moduleCache;

  if (!initPromise) {
    initPromise = (async () => {
      // Dynamic import keeps the WASM out of the initial bundle.
      const mod = (await import("@blazefw/crdt")) as CrdtModule;
      // Run the wasm-bindgen init (fetches + compiles the .wasm binary).
      await mod.default();
      moduleCache = mod;
      return mod;
    })();
  }

  return initPromise;
}

/**
 * Create a fresh CrdtDoc once the WASM module is ready.
 */
export async function createDoc(): Promise<CrdtDoc> {
  const mod = await loadCrdtModule();
  return new mod.CrdtDoc();
}

/**
 * Load a CrdtDoc from serialised bytes (e.g. received from the server).
 */
export async function loadDoc(data: Uint8Array): Promise<CrdtDoc> {
  const mod = await loadCrdtModule();
  return mod.CrdtDoc.load(data);
}
