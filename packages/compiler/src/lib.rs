pub mod accessibility_scanner;
pub mod scanner;
pub mod secret_scanner;
pub mod slicer;
pub mod triggers;

use wasm_bindgen::prelude::*;

/// WASM entry point — mirrors the CLI binary's stdin/stdout contract.
///
/// Accepts a JavaScript/TypeScript source string and returns a JSON object:
/// `{ "server_js": "...", "client_js": "..." }`
///
/// Used by the Vite plugin when the native Rust binary is unavailable (e.g. Vercel CI).
#[wasm_bindgen]
pub fn compile(source: &str) -> Result<String, JsValue> {
    let result = slicer::transformer::Transformer::transform(source);
    serde_json::to_string(&serde_json::json!({
        "server_js": result.server_js,
        "client_js": result.client_js,
    }))
    .map_err(|e| JsValue::from_str(&e.to_string()))
}
