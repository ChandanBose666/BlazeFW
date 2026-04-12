import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** JSON shape returned by the ultimate-compiler binary or WASM module. */
export interface SliceResult {
  server_js: string;
  client_js: string;
}

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

/**
 * Returns the path to the pre-built native binary, or null if not found.
 *
 * Priority:
 *  1. ULTIMATE_COMPILER_BIN env var (CI override)
 *  2. Release build  packages/compiler/target/release/
 *  3. Debug build    packages/compiler/target/debug/
 */
function findBinaryPath(): string | null {
  const fromEnv = process.env["ULTIMATE_COMPILER_BIN"];
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;

  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "ultimate-compiler.exe" : "ultimate-compiler";
  const compilerRoot = resolve(__dirname, "../../../compiler");

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
    // Resolve relative to the compiler package, not this package.
    const wasmEntry = require.resolve("@blazefw/compiler/wasm");
    const mod = await import(wasmEntry);
    _wasmCompile = mod.compile as (src: string) => Promise<SliceResult>;
    return _wasmCompile;
  } catch {
    throw new Error(
      `[ultimatejs] No compiler available.\n` +
        `  Option A: Build the native binary → cd packages/compiler && cargo build --release\n` +
        `  Option B: Build the WASM fallback → cd packages/compiler && pnpm build:wasm\n` +
        `  Option C: Set ULTIMATE_COMPILER_BIN=/path/to/ultimate-compiler`
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Slices a JS/TS source string into server + client bundles.
 *
 * Tries the native Rust binary first (fast, local dev).
 * Falls back to the WASM module when the binary is not present (Vercel CI).
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
      throw new Error(`[ultimatejs] Failed to spawn compiler: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(
        `[ultimatejs] Compiler exited with code ${result.status}:\n${result.stderr}`
      );
    }
    try {
      return JSON.parse(result.stdout) as SliceResult;
    } catch {
      throw new Error(`[ultimatejs] Compiler returned invalid JSON:\n${result.stdout}`);
    }
  }

  // --- WASM fallback path (CI / no Rust installed) ---
  console.log("[blazefw] Native binary not found — using WASM compiler fallback");
  const wasmCompile = await loadWasm();
  return wasmCompile(source);
}
