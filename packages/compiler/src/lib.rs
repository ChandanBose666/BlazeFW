pub mod accessibility_scanner;
pub mod scanner;
pub mod secret_scanner;
pub mod slicer;
pub mod triggers;

use wasm_bindgen::prelude::*;

/// Runs once when the WASM module is instantiated. Installs a panic hook so a
/// Rust `panic!` surfaces as a readable `console.error` message instead of an
/// opaque `RuntimeError: unreachable` trap.
#[wasm_bindgen(start)]
pub fn __blazefw_compiler_init() {
    console_error_panic_hook::set_once();
}

/// WASM entry point — mirrors the CLI binary's stdin/stdout contract.
///
/// Accepts a JavaScript/TypeScript (`.ultimate.tsx`) source string and returns
/// a JSON object: `{ "server_js": "...", "client_js": "..." }`.
///
/// On a parse error it throws a `string` describing the failure (the Vite
/// plugin reports it as a build error) — it does not panic.
///
/// Used by the Vite plugin when the native Rust binary is unavailable (e.g. Vercel CI).
#[wasm_bindgen]
pub fn compile(source: &str) -> Result<String, JsValue> {
    let result = slicer::transformer::Transformer::transform(source)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    serde_json::to_string(&serde_json::json!({
        "server_js": result.server_js,
        "client_js": result.client_js,
    }))
    .map_err(|e| JsValue::from_str(&e.to_string()))
}
