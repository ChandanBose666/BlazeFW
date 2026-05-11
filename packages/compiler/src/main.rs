use std::io::{self, Read};
use std::process::ExitCode;
use compiler::slicer::transformer::Transformer;

/// CLI entry point for the BlazeFW compiler.
///
/// Reads JavaScript/TypeScript (`.ultimate.tsx`) source from stdin, runs the
/// Slicer, and writes a JSON object to stdout:
///
/// ```json
/// { "server_js": "...", "client_js": "..." }
/// ```
///
/// On a parse error it writes the message to stderr and exits non-zero — the
/// Vite plugin surfaces that as a build error. It does not panic on bad input.
fn main() -> ExitCode {
    let mut source = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut source) {
        eprintln!("blazefw-compiler: failed to read stdin: {e}");
        return ExitCode::FAILURE;
    }

    let result = match Transformer::transform(&source) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("blazefw-compiler: {e}");
            return ExitCode::FAILURE;
        }
    };

    let json = serde_json::json!({
        "server_js": result.server_js,
        "client_js": result.client_js,
    });

    println!("{json}");
    ExitCode::SUCCESS
}
