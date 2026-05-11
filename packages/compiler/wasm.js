// WASM fallback entry point for @blazefw/compiler/wasm
// Lazy-loads the wasm-pack Node.js output (pkg-node/) the first time compile()
// is called. Used by the Vite plugin when the native Rust binary is unavailable
// (e.g. Vercel CI). When neither the native binary, the WASM build, nor the CI
// stub exist, this throws a clear, actionable error instead of a bare
// ERR_MODULE_NOT_FOUND.

let _mod = null

const NO_COMPILER =
  '[blazefw/compiler] No compiler build found (pkg-node/compiler.js missing).\n' +
  '  Option A: build the native binary  -> cd packages/compiler && cargo build --release\n' +
  '  Option B: build the WASM fallback  -> cd packages/compiler && pnpm build:wasm\n' +
  '  Option C: regenerate the CI stub   -> cd packages/compiler && node build-stub.mjs'

async function load() {
  if (_mod) return _mod
  try {
    // wasm-pack --target nodejs emits a CJS bundle that self-initialises on require.
    // Dynamic import works for both CJS and ESM consumers.
    _mod = await import('./pkg-node/compiler.js')
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(NO_COMPILER)
    }
    throw err
  }
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
