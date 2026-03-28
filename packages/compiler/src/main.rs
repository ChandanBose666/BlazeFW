use std::io::{self, Read};
use compiler::slicer::transformer::Transformer;

/// CLI entry point for the Nexus compiler.
///
/// Reads JavaScript/TypeScript source from stdin, runs the Slicer,
/// and writes a JSON object to stdout:
///
/// ```json
/// { "server_js": "...", "client_js": "..." }
/// ```
///
/// The Vite plugin calls this binary as a subprocess, passing the
/// file contents via stdin and reading the JSON result.
fn main() {
    let mut source = String::new();
    io::stdin()
        .read_to_string(&mut source)
        .expect("nexus-compiler: failed to read stdin");

    let result = Transformer::transform(&source);

    let json = serde_json::json!({
        "server_js": result.server_js,
        "client_js": result.client_js,
    });

    println!("{}", json);
}
