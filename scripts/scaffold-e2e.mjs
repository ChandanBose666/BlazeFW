#!/usr/bin/env node
/**
 * Scaffold-build E2E gate.
 *
 * Generates a project with `create-blazefw`'s `scaffold()`, sanity-checks the
 * generated `vite.config.ts`, then runs the *real* BlazeFW compiler over every
 * generated `*.blazefw.tsx` file — both through the Vite-plugin bridge
 * (`sliceSource`, which uses the native binary when present) and through the
 * WASM build directly (`@blazefw/compiler/wasm`, the path published consumers
 * use). Exits non-zero on any failure.
 *
 * This is the gate that would have caught: the `blazefw()()` double-call,
 * the missing `@vitejs/plugin-react`/`@blazefw/compiler` deps, the `bridge.ts`
 * binary-path bug, and "the compiler can't parse JSX".
 *
 * Prereqs (the `scaffold-e2e` CI job does these):
 *   pnpm build                                  # builds create-blazefw, vite-plugin; native compiler if Rust present
 *   pnpm --filter @blazefw/compiler build:wasm  # builds packages/compiler/pkg-node
 *
 * Run locally from the repo root:  node scripts/scaffold-e2e.mjs
 */
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const fail = (msg) => {
  console.error(`  FAIL  ${msg}`);
  failed = true;
};
let failed = false;

// --- locate the built artifacts we need ----------------------------------
const SCAFFOLD_JS = join(ROOT, 'packages/create-blazefw/dist/scaffold.js');
const BRIDGE_JS = join(ROOT, 'packages/vite-plugin/dist/bridge.js');
const COMPILER_WASM_JS = join(ROOT, 'packages/compiler/wasm.js');
const COMPILER_PKG_NODE = join(ROOT, 'packages/compiler/pkg-node/compiler.js');

for (const [label, p, hint] of [
  ['create-blazefw build', SCAFFOLD_JS, 'run `pnpm --filter create-blazefw build`'],
  ['vite-plugin build', BRIDGE_JS, 'run `pnpm --filter @blazefw/vite-plugin build`'],
  ['compiler WASM build', COMPILER_PKG_NODE, 'run `pnpm --filter @blazefw/compiler build:wasm`'],
]) {
  if (!existsSync(p)) {
    console.error(`Missing ${label} (${p}). ${hint}.`);
    process.exit(1);
  }
}

const { scaffold } = await import(pathToFileURL(SCAFFOLD_JS).href);
const { sliceSource } = await import(pathToFileURL(BRIDGE_JS).href);
const { compile: wasmCompile } = await import(pathToFileURL(COMPILER_WASM_JS).href);

// --- scaffold a project --------------------------------------------------
const dest = mkdtempSync(join(tmpdir(), 'blazefw-scaffold-e2e-'));
console.log(`Scaffolding into ${dest} …`);

try {
  const { notes } = scaffold({
    destDir: dest,
    projectName: 'scaffold-e2e-app',
    renderer: 'web',
    features: ['sync', 'sidecar', 'inspector', 'snapshot', 'a11y'],
  });

  // --- vite.config.ts sanity ---------------------------------------------
  const viteConfig = readFileSync(join(dest, 'vite.config.ts'), 'utf8');
  if (/blazefw\(\)\(\)/.test(viteConfig)) fail('vite.config.ts has the blazefw()() double-invocation bug');
  if (!/\bblazefw\(/.test(viteConfig)) fail('vite.config.ts never calls blazefw()');
  if (!/@vitejs\/plugin-react/.test(viteConfig)) fail('vite.config.ts does not import @vitejs/plugin-react');

  // generated package.json must include the build-time deps that make `vite dev` work
  const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const d of ['@blazefw/compiler', '@blazefw/vite-plugin', '@vitejs/plugin-react', 'react', 'react-dom']) {
    if (!allDeps[d]) fail(`generated package.json is missing dependency: ${d}`);
  }

  // --- find every *.blazefw.ts(x) file ----------------------------------
  const blazefwFiles = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/.blazefw.tsx?$/.test(e.name)) blazefwFiles.push(p);
    }
  })(dest);
  if (blazefwFiles.length === 0) fail('scaffold produced no *.blazefw.tsx files');

  // --- slice each one, both ways -----------------------------------------
  for (const file of blazefwFiles) {
    const rel = relative(dest, file);
    const src = readFileSync(file, 'utf8');
    try {
      const viaBridge = await sliceSource(src);
      if (!viaBridge || typeof viaBridge.client_js !== 'string' || typeof viaBridge.server_js !== 'string' || viaBridge.client_js.length === 0) {
        throw new Error('bridge returned an empty/invalid result');
      }
      const viaWasm = await wasmCompile(src); // wasm.js already JSON.parses
      if (!viaWasm || typeof viaWasm.client_js !== 'string' || viaWasm.client_js.length === 0) {
        throw new Error('WASM build returned an empty/invalid result');
      }
      console.log(`  OK    sliced ${rel}  (bridge: ${viaBridge.client_js.length}b client / ${viaBridge.server_js.length}b server; wasm: ${viaWasm.client_js.length}b client)`);
    } catch (e) {
      fail(`could not slice ${rel}: ${(e && e.message ? e.message : String(e)).split('\n')[0]}`);
    }
  }

  if (notes.length) console.log(`  (feature notes: ${notes.join(' | ')})`);
} finally {
  rmSync(dest, { recursive: true, force: true });
}

if (failed) {
  console.error('\nscaffold-e2e: FAILED');
  process.exit(1);
}
console.log('\nscaffold-e2e: OK');
