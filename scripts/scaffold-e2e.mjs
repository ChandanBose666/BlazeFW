#!/usr/bin/env node
/**
 * Scaffold-build E2E gate.
 *
 * 1. Generates a project with `create-blazefw`'s `scaffold()` and sanity-checks
 *    the generated `vite.config.ts` / `package.json`.
 * 2. Runs the real BlazeFW compiler over every generated `*.blazefw.tsx` — via
 *    the Vite-plugin bridge AND the WASM build directly (a fast smoke).
 * 3. Packs every `@blazefw/*` workspace package, installs the scaffolded project
 *    against those tarballs (so `workspace:*` is resolved exactly as a published
 *    consumer sees it), and runs `pnpm build` (`tsc && vite build`) — asserting
 *    `dist/index.html` is produced. This is the gate that catches "generated
 *    project doesn't type-check / doesn't build" before it ships.
 *
 * Exits non-zero on any failure.
 *
 * Prereqs (the `scaffold-e2e` CI job does these):
 *   pnpm install --frozen-lockfile
 *   pnpm build                                  # compiles dist/, builds native compiler + crdt pkg/
 *   pnpm --filter @blazefw/compiler build:wasm  # builds packages/compiler/pkg-node
 *   # plus Rust + wasm-pack on PATH (phase 3 needs the real WASM in the @blazefw/compiler tarball)
 *
 * Run locally from the repo root:  node scripts/scaffold-e2e.mjs
 * (Phase 3 is skipped automatically if `wasm-pack` / `pnpm` isn't on PATH.)
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let failed = false;
const fail = (msg) => { console.error(`  FAIL  ${msg}`); failed = true; };
const ok = (msg) => console.log(`  OK    ${msg}`);
const info = (msg) => console.log(`  ..    ${msg}`);

function onPath(cmd) {
  try { execSync(`${cmd} --version`, { stdio: 'ignore' }); return true; } catch { return false; }
}
function run(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

// --- locate built artifacts -------------------------------------------------
const SCAFFOLD_JS = join(ROOT, 'packages/create-blazefw/dist/scaffold.js');
const BRIDGE_JS = join(ROOT, 'packages/vite-plugin/dist/bridge.js');
const COMPILER_WASM_JS = join(ROOT, 'packages/compiler/wasm.js');
for (const [label, p, hint] of [
  ['create-blazefw build', SCAFFOLD_JS, '`pnpm --filter create-blazefw build`'],
  ['vite-plugin build', BRIDGE_JS, '`pnpm --filter @blazefw/vite-plugin build`'],
  ['compiler WASM build', join(ROOT, 'packages/compiler/pkg-node/compiler.js'), '`pnpm --filter @blazefw/compiler build:wasm`'],
]) {
  if (!existsSync(p)) { console.error(`Missing ${label} (${p}). Run ${hint} (or just \`pnpm build\`).`); process.exit(1); }
}

const { scaffold } = await import(pathToFileURL(SCAFFOLD_JS).href);
const { sliceSource } = await import(pathToFileURL(BRIDGE_JS).href);
const { compile: wasmCompile } = await import(pathToFileURL(COMPILER_WASM_JS).href);

// --- scaffold ---------------------------------------------------------------
const dest = mkdtempSync(join(tmpdir(), 'blazefw-scaffold-e2e-'));
const tarballs = mkdtempSync(join(tmpdir(), 'blazefw-tarballs-'));
console.log(`Scaffolding into ${dest}`);

try {
  const { notes } = scaffold({
    destDir: dest,
    projectName: 'scaffold-e2e-app',
    renderer: 'web',
    features: ['sync', 'sidecar', 'inspector', 'snapshot', 'a11y'],
  });

  // --- phase 1: static sanity ----------------------------------------------
  const viteConfig = readFileSync(join(dest, 'vite.config.ts'), 'utf8');
  if (/blazefw\(\)\(\)/.test(viteConfig)) fail('vite.config.ts has the blazefw()() double-invocation bug');
  if (!/\bblazefw\(/.test(viteConfig)) fail('vite.config.ts never calls blazefw()');
  if (!/@vitejs\/plugin-react/.test(viteConfig)) fail('vite.config.ts does not import @vitejs/plugin-react');

  const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'));
  const scaffoldDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const d of ['@blazefw/compiler', '@blazefw/vite-plugin', '@vitejs/plugin-react', 'react', 'react-dom']) {
    if (!scaffoldDeps[d]) fail(`generated package.json is missing dependency: ${d}`);
  }
  if (!failed) ok('static checks (vite.config.ts, package.json deps)');

  // --- phase 2: slice every *.blazefw.tsx (bridge + WASM) -------------------
  const blazefwFiles = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.blazefw\.tsx?$/.test(e.name)) blazefwFiles.push(p);
    }
  })(dest);
  if (blazefwFiles.length === 0) fail('scaffold produced no *.blazefw.tsx files');
  for (const file of blazefwFiles) {
    const rel = relative(dest, file);
    const src = readFileSync(file, 'utf8');
    try {
      const viaBridge = await sliceSource(src);
      if (typeof viaBridge?.client_js !== 'string' || typeof viaBridge?.server_js !== 'string' || viaBridge.client_js.length === 0) throw new Error('bridge returned empty/invalid result');
      const viaWasm = await wasmCompile(src);
      if (typeof viaWasm?.client_js !== 'string' || viaWasm.client_js.length === 0) throw new Error('WASM build returned empty/invalid result');
      ok(`sliced ${rel}  (bridge ${viaBridge.client_js.length}b/${viaBridge.server_js.length}b, wasm ${viaWasm.client_js.length}b)`);
    } catch (e) {
      fail(`could not slice ${rel}: ${String(e?.message ?? e).split('\n')[0]}`);
    }
  }

  // --- phase 3: install the scaffolded project against local tarballs, build it
  if (!onPath('pnpm')) {
    info('phase 3 (install + build) SKIPPED — `pnpm` not on PATH');
  } else if (!onPath('wasm-pack')) {
    info('phase 3 (install + build) SKIPPED — `wasm-pack` not on PATH (the @blazefw/compiler tarball needs the real WASM); install it for the full gate');
  } else {
    // 3a. pack every non-private package under packages/*
    const overrides = {};
    for (const name of readdirSync(join(ROOT, 'packages'))) {
      const pjPath = join(ROOT, 'packages', name, 'package.json');
      if (!existsSync(pjPath)) continue;
      const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
      if (pj.private) continue;
      run(`pnpm pack --pack-destination "${tarballs}"`, join(ROOT, 'packages', name));
      // wasm-pack / npm name the tarball <name-without-scope>-<version>.tgz
      const tgz = `${pj.name.replace('@', '').replace('/', '-')}-${pj.version}.tgz`;
      const tgzPath = join(tarballs, tgz);
      if (!existsSync(tgzPath)) { fail(`pnpm pack produced no ${tgz}`); continue; }
      // file: dep relative to the scaffolded package.json (works cross-platform)
      overrides[pj.name] = `file:${relative(dest, tgzPath).replace(/\\/g, '/')}`;
    }

    // 3b. point every @blazefw/* dep at its local tarball (transitively, via pnpm.overrides)
    pkg.pnpm = { ...(pkg.pnpm ?? {}), overrides: { ...(pkg.pnpm?.overrides ?? {}), ...overrides } };
    writeFileSync(join(dest, 'package.json'), JSON.stringify(pkg, null, 2));

    // 3c. install + build
    try {
      info('pnpm install (scaffolded project, @blazefw/* from local tarballs) …');
      run('pnpm install --ignore-workspace --silent', dest);
      info('pnpm build (tsc && vite build) …');
      const out = run('pnpm run build', dest);
      const dist = join(dest, 'dist', 'index.html');
      if (existsSync(dist) && statSync(dist).size > 0) {
        const assets = existsSync(join(dest, 'dist', 'assets')) ? readdirSync(join(dest, 'dist', 'assets')).join(', ') : '';
        ok(`scaffolded project builds  → dist/index.html (${statSync(dist).size}b)${assets ? ' + assets/{' + assets + '}' : ''}`);
      } else {
        fail(`pnpm build produced no dist/index.html\n${out.split('\n').slice(-12).join('\n')}`);
      }
    } catch (e) {
      const o = (e?.stdout ?? '') + (e?.stderr ?? '') || String(e?.message ?? e);
      fail(`scaffolded project install/build failed:\n${o.split('\n').slice(-20).join('\n')}`);
    }
  }

  if (notes.length) console.log(`  (feature notes: ${notes.join(' | ')})`);
} finally {
  rmSync(dest, { recursive: true, force: true });
  rmSync(tarballs, { recursive: true, force: true });
}

if (failed) { console.error('\nscaffold-e2e: FAILED'); process.exit(1); }
console.log('\nscaffold-e2e: OK');
