/**
 * Generates a stub pkg-node/ directory when wasm-pack (and cargo) are not
 * available — e.g. a fresh clone without Rust, or Vercel CI.
 *
 * It provides a CommonJS module that satisfies the `@blazefw/compiler` and
 * `@blazefw/compiler/wasm` entry points so downstream packages resolve and
 * `import()` without crashing. Calling `compile()` throws a clear, actionable
 * error — the real slicer needs the native binary (`cargo build --release`)
 * or the WASM build (`pnpm build:wasm`).
 *
 * Mirrors packages/crdt/build-stub.mjs. Idempotent: if a real wasm-pack build
 * is already present (pkg-node/compiler.js exists), it is left untouched.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'pkg-node';
const ENTRY = join(OUT_DIR, 'compiler.js');

if (existsSync(ENTRY)) {
  console.log('[blazefw/compiler] pkg-node/compiler.js already exists — keeping the real build');
  process.exit(0);
}

console.log('[blazefw/compiler] wasm-pack output not found — generating CI stub for pkg-node/');

mkdirSync(OUT_DIR, { recursive: true });

// CommonJS module — matches the `wasm-pack build --target nodejs` output shape
// (single named `compile(source: string): string` export), but throws instead
// of running the (unavailable) WebAssembly module.
writeFileSync(
  join(OUT_DIR, 'compiler.js'),
  `/* @ts-self-types="./compiler.d.ts" */
// Auto-generated stub — replaced by \`wasm-pack build --target nodejs --out-dir pkg-node\`
// or shadowed by the native binary (\`cargo build --release\`) at slice time.
'use strict';

const STUB_ERROR =
  '[blazefw/compiler] WASM compiler not built. A .blazefw.tsx file needs the slicer.\\n' +
  '  Option A: build the native binary  -> cd packages/compiler && cargo build --release\\n' +
  '  Option B: build the WASM fallback  -> cd packages/compiler && pnpm build:wasm\\n' +
  '  Option C: set BLAZEFW_COMPILER_BIN=/path/to/blazefw-compiler\\n' +
  '  (Install Rust at https://rustup.rs — the JS-only build cannot slice components.)';

function compile(_source) {
  throw new Error(STUB_ERROR);
}

exports.compile = compile;
`,
);

// Type declarations — matches the wasm-pack --target nodejs output.
writeFileSync(
  join(OUT_DIR, 'compiler.d.ts'),
  `/* tslint:disable */
/* eslint-disable */

/**
 * WASM entry point — mirrors the CLI binary's stdin/stdout contract.
 *
 * Accepts a JavaScript/TypeScript source string and returns a JSON object:
 * \`{ "server_js": "...", "client_js": "..." }\`
 *
 * This declaration covers both the real wasm-pack build and the CI stub.
 */
export function compile(source: string): string;
`,
);

writeFileSync(
  join(OUT_DIR, 'compiler_bg.wasm.d.ts'),
  `/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
`,
);

writeFileSync(
  join(OUT_DIR, 'package.json'),
  JSON.stringify(
    {
      name: 'compiler',
      version: '0.1.0',
      files: ['compiler.js', 'compiler.d.ts'],
      main: 'compiler.js',
      types: 'compiler.d.ts',
    },
    null,
    2,
  ) + '\n',
);

console.log('[blazefw/compiler] Stub written to pkg-node/ — resolution + TypeScript compile will succeed');
