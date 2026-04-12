// WASM fallback entry point for @blazefw/compiler/wasm
// Lazy-loads the wasm-pack Node.js output the first time compile() is called.
// Used by the Vite plugin when the native Rust binary is not available (e.g. Vercel CI).

let _mod = null

async function load() {
  if (_mod) return _mod
  // wasm-pack --target nodejs emits a CJS bundle that self-initialises on require.
  // Dynamic import works for both CJS and ESM consumers.
  _mod = await import('./pkg-node/compiler.js')
  return _mod
}

/**
 * Slice a JS/TS source string into server and client bundles.
 *
 * @param {string} source  Raw source code of the .ultimate.tsx file
 * @returns {Promise<{ server_js: string, client_js: string }>}
 */
export async function compile(source) {
  const mod = await load()
  const json = mod.compile(source)
  return JSON.parse(json)
}
