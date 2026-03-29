import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** JSON shape returned by the ultimate-compiler binary. */
export interface SliceResult {
  server_js: string;
  client_js: string;
}

/**
 * Resolves the path to the pre-built ultimate-compiler binary.
 *
 * Priority:
 *  1. ULTIMATE_COMPILER_BIN env var (override for CI / custom installs)
 *  2. Release build next to this package  (packages/compiler/target/release/)
 *  3. Debug build                          (packages/compiler/target/debug/)
 *
 * Throws if none of the locations exist, with a clear action message.
 */
function resolveBinaryPath(): string {
  const fromEnv = process.env["ULTIMATE_COMPILER_BIN"];
  if (fromEnv) return fromEnv;

  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "ultimate-compiler.exe" : "ultimate-compiler";

  // Walk up from packages/vite-plugin/src → packages/compiler/target/…
  const compilerRoot = resolve(__dirname, "../../../compiler");

  const candidates = [
    resolve(compilerRoot, "target", "release", binaryName),
    resolve(compilerRoot, "target", "debug", binaryName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `[ultimatejs] ultimate-compiler binary not found.\n` +
      `Run: cd packages/compiler && cargo build --release\n` +
      `Or set ULTIMATE_COMPILER_BIN=/path/to/ultimate-compiler`
  );
}

/**
 * Calls the Rust slicer synchronously.
 * Passes `source` via stdin, reads JSON from stdout.
 *
 * @throws if the binary exits with a non-zero code or produces invalid JSON.
 */
export function sliceSource(source: string): SliceResult {
  const bin = resolveBinaryPath();

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
    throw new Error(
      `[ultimatejs] Compiler returned invalid JSON:\n${result.stdout}`
    );
  }
}
