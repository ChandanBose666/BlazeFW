# DEPLOY_FIX_BLAZEFW.md
# BlazeFW — Vercel Production Deployment Fix Guide

> Feed this file to Claude Code inside the BlazeFW project root.
> Work through every phase in order. Do not skip ahead.
> Each phase ends with a verification step — do not proceed until it passes.

---

## Context

BlazeFW currently has no production deployment path. Three things block it:

1. The Rust compiler binary (`ultimate-compiler`) is unavailable in Vercel CI
2. `.wasm` files are served with the wrong MIME type, breaking browser instantiation
3. The CRDT WebSocket sync server is a persistent process — incompatible with serverless

This guide fixes all three for a **static portfolio deployment** (no `useSync()` required).
Full SSR + sync server deployment is a separate, later milestone.

---

## Phase 0 — Understand the current build

Before writing any code, read the existing files to understand the current state.

### 0.1 — Read these files in full

```
packages/vite-plugin/src/index.ts     (or index.js — the Vite plugin entry)
packages/compiler/src/main.rs         (or lib.rs — Rust compiler entry)
apps/web/vite.config.ts               (demo app Vite config)
apps/web/package.json                 (demo app scripts)
turbo.json                            (Turborepo pipeline)
pnpm-workspace.yaml                   (workspace structure)
```

### 0.2 — Run the existing build and capture the output

```bash
pnpm install
pnpm build 2>&1 | tee /tmp/blazefw-build-log.txt
```

Record:
- Does it succeed or fail?
- What is the output directory of `apps/web`? (likely `apps/web/dist`)
- Does the Vite plugin invoke the Rust binary? At what step?
- Is there any reference to a WASM fallback path?

### 0.3 — Check whether the WASM fallback is already wired

Search the vite-plugin source for any reference to WASM fallback:

```bash
grep -r "wasm" packages/vite-plugin/src/ --include="*.ts" --include="*.js" -l
grep -r "fallback" packages/vite-plugin/src/ --include="*.ts" --include="*.js"
grep -r "ultimate-compiler" packages/vite-plugin/src/ --include="*.ts" --include="*.js"
```

Report what you find before proceeding.

---

## Phase 1 — Fix the Rust compiler / WASM fallback

This is the most critical blocker. Vercel's build environment has Node.js but
NOT Rust (`cargo`, `rustc`). The vite-plugin calls the Rust binary at build time
and will crash in CI.

### 1.1 — Add binary detection to the vite-plugin

Open `packages/vite-plugin/src/index.ts` (or equivalent entry file).

Find where the Rust binary is invoked. It will look something like:

```ts
// Current pattern — crashes if binary missing
const result = spawnSync('ultimate-compiler', [...args], { input: JSON.stringify(payload) })
```

Replace the binary invocation with a detection wrapper:

```ts
// packages/vite-plugin/src/compiler-bridge.ts  (create this new file)
import { spawnSync, execSync } from 'child_process'
import path from 'path'

function isRustAvailable(): boolean {
  try {
    execSync('ultimate-compiler --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isWasmAvailable(): boolean {
  // Check if the pre-compiled WASM file exists in the crdt/compiler package
  try {
    require.resolve('@blazefw/compiler/wasm')
    return true
  } catch {
    return false
  }
}

export async function runCompiler(payload: unknown): Promise<unknown> {
  // 1. Try native Rust binary (local dev with Rust installed)
  if (isRustAvailable()) {
    console.log('[blazefw] Using native Rust compiler')
    const result = spawnSync('ultimate-compiler', [], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
    })
    if (result.status !== 0) throw new Error(result.stderr)
    return JSON.parse(result.stdout)
  }

  // 2. Try WASM fallback (CI environments like Vercel — no Rust required)
  if (isWasmAvailable()) {
    console.log('[blazefw] Rust not found — using WASM compiler fallback')
    const { compile } = await import('@blazefw/compiler/wasm')
    return compile(payload)
  }

  // 3. Neither available — fail with a helpful message
  throw new Error(
    '[blazefw] No compiler available.\n' +
    '  Option A: Install Rust → https://rustup.rs then: cargo build --release\n' +
    '  Option B: Install the WASM compiler → pnpm add @blazefw/compiler\n'
  )
}
```

### 1.2 — Build and publish a WASM entry point in the compiler package

Open `packages/compiler/`. This package currently builds a native binary.
Add a WASM export alongside it.

Check if `wasm-pack` is already used:

```bash
cat packages/compiler/Cargo.toml | grep -i wasm
ls packages/compiler/pkg/  # wasm-pack output folder if it exists
```

If `wasm-pack` is NOT yet set up, add it now:

**`packages/compiler/Cargo.toml`** — ensure these features exist:

```toml
[lib]
crate-type = ["cdylib", "rlib"]   # cdylib = needed for wasm-pack

[dependencies]
wasm-bindgen = "0.2"
# ... existing deps
```

**`packages/compiler/src/lib.rs`** — add a wasm-bindgen export:

```rust
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// Your existing compiler logic stays untouched.
// Just add this WASM entry point at the bottom:

#[wasm_bindgen]
pub fn compile(payload: &str) -> Result<String, JsValue> {
    let input: CompilerInput = serde_json::from_str(payload)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let output = run_compiler_pipeline(input)  // your existing function
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    serde_json::to_string(&output)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
```

**Build the WASM package:**

```bash
cd packages/compiler
cargo install wasm-pack   # if not installed
wasm-pack build --target nodejs --out-dir pkg-node   # for Node/Vercel CI
wasm-pack build --target web --out-dir pkg-web       # for browser
```

**Add a JS wrapper in `packages/compiler/wasm.js`:**

```js
// packages/compiler/wasm.js
// This is what the vite-plugin imports as @blazefw/compiler/wasm

let _compiler = null

export async function compile(payload) {
  if (!_compiler) {
    // Lazy-load the WASM binary
    const wasmModule = await import('./pkg-node/blazefw_compiler.js')
    await wasmModule.default()   // initialise WASM
    _compiler = wasmModule
  }
  const result = _compiler.compile(JSON.stringify(payload))
  return JSON.parse(result)
}
```

**Add the export to `packages/compiler/package.json`:**

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./wasm": "./wasm.js"
  }
}
```

### 1.3 — Verification

```bash
# Simulate Vercel environment — rename the binary so it can't be found
mv $(which ultimate-compiler) /tmp/ultimate-compiler-backup 2>/dev/null || true

# Run the build — should fall through to WASM
cd apps/web && pnpm build

# Check output
ls apps/web/dist/

# Restore binary
mv /tmp/ultimate-compiler-backup $(which ultimate-compiler) 2>/dev/null || true
```

Expected: build succeeds, `apps/web/dist/` contains `index.html` and assets.
If it fails, read the error and fix before continuing.

---

## Phase 2 — Fix the WASM MIME type for Vercel

Browsers require `Content-Type: application/wasm` to use
`WebAssembly.instantiateStreaming()`. Vercel serves `.wasm` files as
`application/octet-stream` by default, which causes a runtime error.

### 2.1 — Create `vercel.json` at the BlazeFW project root

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "apps/web/dist",
  "installCommand": "pnpm install",
  "framework": null,
  "headers": [
    {
      "source": "/(.*)\\.wasm",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/wasm"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

> **Note on `outputDirectory`:** If Phase 0 revealed the output is somewhere
> other than `apps/web/dist`, update this field accordingly.

### 2.2 — Verify WASM is loading correctly in the built app

```bash
# Build the app
cd apps/web && pnpm build

# Serve it locally and check MIME types
npx serve dist -p 4000 &

# In another terminal, check the MIME type of the .wasm file
curl -I http://localhost:4000/$(find dist -name "*.wasm" | head -1 | sed 's|dist/||')
# Should show: Content-Type: application/wasm
```

---

## Phase 3 — Make the sync server optional (static mode)

The `@blazefw/sync-server` WebSocket process cannot run on Vercel.
For static deployments (portfolio, docs, marketing sites), it should be
opt-out, not opt-in.

### 3.1 — Add a `sync` flag to the vite-plugin options

Open `packages/vite-plugin/src/index.ts`. Find the plugin options interface
and add:

```ts
export interface UltimatePluginOptions {
  sync?: boolean       // default: true — set to false for static deployments
  sidecar?: boolean    // default: true
  inspector?: boolean  // default: true in dev, false in prod
  a11y?: boolean       // default: true
}
```

### 3.2 — Gate the sync-server import behind the flag

Find where `@blazefw/sync-server` or `@blazefw/crdt` is imported or
referenced in the plugin. Wrap it:

```ts
export function ultimatePlugin(options: UltimatePluginOptions = {}) {
  const {
    sync = true,
    sidecar = true,
    inspector = true,
    a11y = true,
  } = options

  return {
    name: 'blazefw-vite-plugin',

    async buildStart() {
      if (sync) {
        // CRDT + WebSocket sync — only for environments with a server
        const { startSyncServer } = await import('@blazefw/sync-server')
        // ... existing sync setup
      } else {
        console.log('[blazefw] Sync server disabled — static mode')
        // Replace useSync() calls with a no-op stub at build time
        await injectSyncStub()
      }
    },

    // ... rest of plugin
  }
}

// Stub that replaces useSync() in static mode
async function injectSyncStub() {
  // Inject a virtual module that replaces @blazefw/core's useSync
  // with a local useState equivalent — no WebSocket, no CRDT
}
```

### 3.3 — Update `apps/web/vite.config.ts` for static-safe build

```ts
import { defineConfig } from 'vite'
import { ultimatePlugin } from '@blazefw/vite-plugin'

export default defineConfig({
  plugins: [
    ultimatePlugin({
      sync: false,       // no WebSocket server needed for static deploy
      sidecar: true,     // Web Worker offloading still works statically
      inspector: false,  // dev overlay — not needed in production
      a11y: true,        // WCAG scanner and runtime utilities always on
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'blazefw-runtime': ['@blazefw/web', '@blazefw/a11y'],
        }
      }
    }
  }
})
```

### 3.4 — Verification

```bash
pnpm build

# Check that no sync-server or CRDT references are in the output bundle
grep -r "sync-server\|automerge\|CrdtDoc" apps/web/dist/ 2>/dev/null
# Should return nothing (or only in source maps if you kept them)
```

---

## Phase 4 — Add a GitHub Actions CI pipeline

This ensures every push to `main` confirms the build works without Rust.

### 4.1 — Create `.github/workflows/deploy.yml`

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    # NOTE: No Rust installed — this validates the WASM fallback path

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build (WASM fallback — no Rust)
        run: pnpm build
        env:
          NODE_ENV: production

      - name: Verify output exists
        run: |
          test -f apps/web/dist/index.html || (echo "Build output missing" && exit 1)
          echo "Build output verified:"
          ls -lh apps/web/dist/

      - name: Check WASM files present
        run: |
          WASM_COUNT=$(find apps/web/dist -name "*.wasm" | wc -l)
          echo "Found $WASM_COUNT .wasm files"

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          NODE_ENV: production
      - name: Deploy to Vercel
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 4.2 — Add secrets to GitHub repository

Go to GitHub repo → Settings → Secrets → Actions. Add:

```
VERCEL_TOKEN       — from vercel.com/account/tokens
VERCEL_ORG_ID      — from .vercel/project.json after first deploy
VERCEL_PROJECT_ID  — from .vercel/project.json after first deploy
```

To get org/project IDs, run once locally:

```bash
cd apps/web
npx vercel link   # links the project, creates .vercel/project.json
cat .vercel/project.json
```

---

## Phase 5 — First Vercel deploy

### 5.1 — Deploy from CLI

```bash
# From the BlazeFW root
npx vercel --prod

# Vercel will ask:
# - Which scope? → your account
# - Link to existing project? → No (first time)
# - Project name? → blazefw-demo (or your choice)
# - Which directory? → ./   (root, vercel.json handles the rest)
```

### 5.2 — Verify the live deployment

Once deployed, open the Vercel URL and:

```bash
# Check WASM MIME type on the live URL
curl -I https://your-deployment.vercel.app/assets/blazefw_compiler_bg.wasm
# Must show: Content-Type: application/wasm

# Check the app loads and components render
# Open browser devtools → Network → filter by .wasm → confirm 200 status
```

### 5.3 — Check the Vercel build logs

In the Vercel dashboard, open the deployment → Build Logs. Confirm you see:

```
[blazefw] Rust not found — using WASM compiler fallback
```

This confirms the WASM path is working in CI.

---

## Phase 6 — Update README

Add a deployment section to the BlazeFW README:

```markdown
## Deployment

### Static deployment (Vercel, Netlify, GitHub Pages)

BlazeFW supports static deployment without a Rust compiler installed.
The build pipeline automatically falls back to the WASM compiler in CI
environments where Rust is not available.

**Vercel (recommended):**
\`\`\`bash
npx vercel --prod
\`\`\`

A `vercel.json` is included that handles WASM MIME types and client-side routing.

**For static-only apps** (no real-time sync):
\`\`\`ts
// vite.config.ts
ultimatePlugin({ sync: false })
\`\`\`

### Full-stack deployment (with Zero-Fetch Sync)

The CRDT WebSocket sync server (`@blazefw/sync-server`) requires a
persistent runtime. Deploy it separately:

- [Fly.io guide](#) — recommended for the sync server
- [Railway guide](#)
- [Cloudflare Durable Objects](#) — future roadmap target
```

---

## Completion Checklist

```
[ ] Phase 0: Existing build understood, output directory confirmed
[ ] Phase 1: WASM fallback implemented and tested without Rust binary
[ ] Phase 1: wasm-pack builds successfully → pkg-node/ exists
[ ] Phase 1: @blazefw/compiler/wasm export resolves correctly
[ ] Phase 2: vercel.json created with correct outputDirectory
[ ] Phase 2: WASM MIME type verified locally (application/wasm)
[ ] Phase 3: sync: false flag implemented in vite-plugin
[ ] Phase 3: Static build produces no sync-server references in bundle
[ ] Phase 4: GitHub Actions CI pipeline passing (no Rust, WASM path)
[ ] Phase 5: Live Vercel deployment accessible
[ ] Phase 5: WASM MIME type confirmed on live URL
[ ] Phase 5: Build log shows WASM fallback message
[ ] Phase 6: README deployment section updated
```

---

*Estimated total time: 3–5 days depending on how much of the WASM
infrastructure is already in place from the existing wasm-bindgen work.*
