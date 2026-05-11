import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** JSON shape returned by the blazefw-compiler binary or WASM module. */
export interface SliceResult {
  server_js: string;
  client_js: string;
}

// ---------------------------------------------------------------------------
// Locating the @blazefw/compiler package
// ---------------------------------------------------------------------------

/**
 * Absolute path to the `@blazefw/compiler` package directory, or null if it
 * cannot be resolved (then there is no compiler at all and slicing will fail
 * with a clear error).
 *
 * Resolved by following `@blazefw/compiler/wasm` — works in the monorepo, in a
 * flat npm install, and in a pnpm isolated layout alike.
 */
function findCompilerPackageRoot(): string | null {
  // (The dist build of @blazefw/compiler always ships wasm.js.)
  try {
    return dirname(require.resolve("@blazefw/compiler/wasm"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Native binary resolution
// ---------------------------------------------------------------------------

/**
 * Returns the path to the pre-built native binary, or null if not found.
 *
 * Priority:
 *  1. BLAZEFW_COMPILER_BIN env var
 *  2. Release build  <@blazefw/compiler>/target/release/
 *  3. Debug build    <@blazefw/compiler>/target/debug/
 *
 * Published consumers never have a `target/` dir, so this returns null there
 * and the WASM build (which ships with the package) is used instead.
 */
function findBinaryPath(): string | null {
  const fromEnv = process.env["BLAZEFW_COMPILER_BIN"];
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;

  const compilerRoot = findCompilerPackageRoot();
  if (!compilerRoot) return null;

  const binaryName =
    process.platform === "win32" ? "blazefw-compiler.exe" : "blazefw-compiler";

  const candidates = [
    resolve(compilerRoot, "target", "release", binaryName),
    resolve(compilerRoot, "target", "debug", binaryName),
  ];

  return candidates.find(existsSync) ?? null;
}

// ---------------------------------------------------------------------------
// WASM fallback
// ---------------------------------------------------------------------------

/** Cached WASM compile function once loaded. */
let _wasmCompile: ((src: string) => Promise<SliceResult>) | null = null;

async function loadWasm(): Promise<(src: string) => Promise<SliceResult>> {
  if (_wasmCompile) return _wasmCompile;
  try {
    // `require.resolve` returns a filesystem path; on Windows `import()` needs a
    // file:// URL, not a bare `C:\...` path (ERR_UNSUPPORTED_ESM_URL_SCHEME).
    const wasmEntry = pathToFileURL(require.resolve("@blazefw/compiler/wasm")).href;
    const mod = await import(wasmEntry);
    _wasmCompile = mod.compile as (src: string) => Promise<SliceResult>;
    return _wasmCompile;
  } catch (cause) {
    throw new Error(
      "[blazefw] No compiler available — could not load the @blazefw/compiler WASM build.\n" +
        "  In a project: make sure @blazefw/compiler is installed (it ships a WASM build).\n" +
        "  In the BlazeFW monorepo: run `pnpm --filter @blazefw/compiler build:wasm`,\n" +
        "    or build the native binary with `cargo build --release` in packages/compiler.\n" +
        "  Override the binary path with BLAZEFW_COMPILER_BIN=/path/to/blazefw-compiler.",
      { cause },
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Slices a JS/TS (`.blazefw.tsx`) source string into server + client bundles.
 *
 * Tries the native Rust binary first (fast, local dev with Rust installed).
 * Falls back to the WASM build that ships with `@blazefw/compiler` otherwise.
 */
export async function sliceSource(source: string): Promise<SliceResult> {
  const bin = findBinaryPath();

  if (bin) {
    // --- Native path ---
    const result = spawnSync(bin, [], {
      input: source,
      encoding: "utf8",
      timeout: 10_000,
    });

    if (result.error) {
      throw new Error(`[blazefw] Failed to spawn compiler: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(
        `[blazefw] Compiler exited with code ${result.status}:\n${result.stderr ?? ""}`,
      );
    }
    try {
      return JSON.parse(result.stdout) as SliceResult;
    } catch {
      throw new Error(`[blazefw] Compiler returned invalid JSON:\n${result.stdout}`);
    }
  }

  // --- WASM fallback path (no native binary / no Rust installed) ---
  const wasmCompile = await loadWasm();
  return wasmCompile(source);
}
