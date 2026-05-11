# Compiler distribution

How `@blazefw/compiler` (the Rust/SWC slicer + accessibility scanner) reaches a
developer's machine, why it's set up this way, and where it's headed.

> TL;DR: the **WebAssembly build is the canonical artifact** — it ships inside the
> npm tarball and works on any Node 20+/Bun/Deno with zero config. A native binary
> is a pure local-dev optimization. There's a build-stub safety net for fresh
> clones of this monorepo without Rust.

---

## How it works today (Phase 0 — done)

`@blazefw/vite-plugin`'s `bridge.ts` resolves a compiler in this order
(`sliceSource()`):

1. **`BLAZEFW_COMPILER_BIN`** (or legacy `BLAZEFW_COMPILER_BIN`) env var — explicit
   path to a `blazefw-compiler` binary. Override for CI / custom builds.
2. **Native binary** — `<@blazefw/compiler>/target/release/blazefw-compiler[.exe]`
   (then `target/debug/…`). Present only inside this monorepo after `cargo build
   --release`. Published consumers never have a `target/` dir, so this is skipped
   there. Fastest path; spawned per-file via stdin/stdout JSON.
3. **WASM build** — `@blazefw/compiler/wasm` → `pkg-node/compiler_bg.wasm` + JS
   glue. **This is what ships in the npm package** and what every published
   consumer uses. Built by `wasm-pack build --target nodejs --out-dir pkg-node`.

### Making sure the WASM ships

`@blazefw/compiler/package.json` has:

```jsonc
"scripts": {
  "build:wasm": "wasm-pack build --target nodejs --out-dir pkg-node",
  "prepack":    "pnpm run build:wasm || node build-stub.mjs"   // runs on `pnpm pack` AND `pnpm publish`
},
"files": [
  "pkg-node/compiler.js", "pkg-node/compiler.d.ts",
  "pkg-node/compiler_bg.wasm", "pkg-node/compiler_bg.wasm.d.ts",
  "pkg-node/package.json",     // CJS shield — the wasm-pack `--target nodejs` glue is CommonJS
  "wasm.js", "build-stub.mjs"
]
```

`prepack` regenerates `pkg-node/` from source before every `pnpm pack`/`pnpm publish`,
so the tarball is never missing the WASM. `files` lists the artifacts explicitly
(the `pkg-node/` directory itself is git-ignored via `packages/compiler/.gitignore`;
listing files explicitly avoids npm honoring a nested ignore and shipping an empty
directory). Verify with `cd packages/compiler && pnpm pack && tar -tzf blazefw-compiler-*.tgz`
— `pkg-node/compiler_bg.wasm` must be in the list.

### The build-stub (`build-stub.mjs`)

On a fresh clone of **this monorepo** with neither `cargo` nor `wasm-pack`,
`pnpm build` runs `cargo build --release || node build-stub.mjs`. The stub writes
a placeholder `pkg-node/compiler.js` (CJS) whose `compile()` throws a clear
"build the compiler" error, plus the `.d.ts` files — so `import('@blazefw/compiler')`
and `@blazefw/compiler/wasm` resolve and TypeScript compiles. It's a dev-repo
safety net, not something published consumers ever hit (they get the real WASM).
It's idempotent: if `pkg-node/compiler.js` already exists (a real build), it does
nothing.

### Error behavior

`Transformer::transform` returns `Result<SliceResult, TransformError>` — a malformed
`.blazefw.tsx` produces a diagnostic, never a panic. The CLI prints to stderr +
exits non-zero; the WASM `compile()` throws a string. `console_error_panic_hook`
(installed via `#[wasm_bindgen(start)]`) means any *other* unexpected panic surfaces
a readable message instead of `RuntimeError: unreachable`.

### Source format

Source is parsed as **TypeScript + JSX** (`Syntax::Typescript { tsx: true }`) —
`.blazefw.tsx` files are React components. `.blazefw.ts` files are also parsed in
TSX mode, so old-style `<T>x` type assertions must be written `x as T`.

---

## Trade-offs

| | Native binary | WASM (`pkg-node/`) | build-stub |
|---|---|---|---|
| Ships to consumers | no (`target/` not packed) | **yes** | no |
| Setup needed | Rust toolchain | none — in the tarball | none |
| Speed | fastest | ~2–5× slower, parse-heavy | n/a (throws) |
| Size | ~MBs, per-platform | ~2.4 MB, one file, universal | ~1 KB |

WASM-first is the [`@swc/core`](https://www.npmjs.com/package/@swc/core) model:
universal baseline, native prebuilds layered on as an optimization.

---

## Roadmap

### Phase 1 — native prebuilds via `optionalDependencies` (speed tier, when users ask)
Publish `@blazefw/compiler-{darwin-arm64,linux-x64-gnu,linux-x64-musl,win32-x64-msvc,…}`,
each just the binary for that platform; list them all as `optionalDependencies` of
`@blazefw/compiler`; a tiny resolver shim picks the matching one. CI matrix on
macOS/Linux/Windows + cross-compile for arm/musl. `bridge.ts` already has the
binary-resolution hook. This is exactly the esbuild / `@swc/core` / `lightningcss`
pattern. Orthogonal to everything below.

### Phase 2 — WASM Component Model (the root-cause "ship the Rust core" fix)
Migrate from `wasm-bindgen` to the [Component Model](https://component-model.bytecodealliance.org/)
(`cargo component` + a [WIT](https://component-model.bytecodealliance.org/design/wit.html)
interface). Define the compiler's contract once:

```wit
package blazefw:compiler@0.2.0;
world slicer {
  enum target { web, native, email }
  record diagnostic { rule: string, message: string, severity: severity, span: span }
  record slice-result { server-js: string, client-js: string, diagnostics: list<diagnostic> }
  export slice:        func(source: string, target: target) -> result<slice-result, list<diagnostic>>;
  export scan-a11y:    func(source: string) -> list<diagnostic>;
  export scan-secrets: func(source: string) -> list<diagnostic>;
}
```

Ship one `blazefw_compiler.wasm` component. Consumers transpile it with
[`jco`](https://github.com/bytecodealliance/jco) (or run it directly in a WASI
host). Now the Vite plugin, a future Bun/Rspack/Farm plugin, a standalone
`blazefw build` CLI, a browser playground, an edge "compile service" — all drive
the **same component through the same contract**. "How do we ship the Rust core"
stops being a recurring question.

### Phase 3 — persistent compiler instance
`bridge.ts` currently spawns the binary **per file**. A long-lived component
instance (warm in the Vite dev server, or in a Vercel Fluid Compute function for
cloud builds) unlocks: incremental re-slicing (only re-analyze changed
declarations), a shared module graph for cross-file boundary analysis, and
compile-as-a-service (`@blazefw/compiler-server`: POST a source file, get sliced
output back — powers a web playground with no local toolchain).

### Belt-and-suspenders — lazy CDN fetch
If `pkg-node/compiler_bg.wasm` is somehow missing at first `compile()` (old cached
tarball, `--ignore-scripts`, weird hoisting), optionally fetch it from a CDN mirror
(jsDelivr/unpkg of the npm package, or a GitHub release asset, or an OCI registry
via `wkg`) into `node_modules/.cache/blazefw/`. Gate behind `BLAZEFW_COMPILER_AUTOFETCH=1`
so it's never a surprise network call. (The `playwright`/`esbuild-wasm` trick.)

---

## CI gate

`scripts/scaffold-e2e.mjs` (run by the `scaffold-e2e` job in `.github/workflows/deploy.yml`):
scaffolds a project with `scaffold()`, sanity-checks `vite.config.ts`, then runs the
**real compiler** over every generated `*.blazefw.tsx` — via the Vite-plugin bridge
*and* the WASM build directly. This is the gate that catches "scaffold produces a
broken project" and "compiler crashes on its own example app". Runs with Rust +
`wasm-pack` installed so both code paths are exercised. Run it locally with:

```bash
pnpm build
pnpm --filter @blazefw/compiler build:wasm
node scripts/scaffold-e2e.mjs
```

---

## Pre-publish checklist

1. Commit & merge the working-tree changes.
2. Bump `@blazefw/compiler`, `@blazefw/vite-plugin`, `create-blazefw` → next patch (others optional).
3. `pnpm publish` those three. (`@blazefw/compiler` has never been published — it's a 404 on npm; the other ~10 `@blazefw/*` are at 0.1.1. `prepack` ensures the WASM ships.)
4. Smoke the published flow: `npx create-blazefw@latest test-app && cd test-app && pnpm install && pnpm build` — must be green.

---

## Known limitations (document, not crashes)

- **Module-level secret consts aren't tracked.** `const API_URL = process.env.X` *at
  module scope* isn't flagged server-only — it can land in the client bundle (the value
  is `undefined` there, but the code is wrong). Secrets used *inside a function body*
  **are** detected and that function becomes an RPC stub on the client. Fixing this
  needs data-flow analysis in the classifier.
- The RPC stubber rewrites `function` declarations only — not `export const f = async () => {}`
  arrow functions.
- The slicer emits no source maps yet (pending SWC codegen source-map support).
