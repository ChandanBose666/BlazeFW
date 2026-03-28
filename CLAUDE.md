# Nexus.js — Project Context for Claude

## What This Project Is
A high-performance JavaScript framework with a Rust compiler core. It aims to:
- Automatically split components into server/client bundles ("Fluid Execution")
- Provide a semantic UI primitive system (`<Stack>`, `<Text>`, `<Action>`, `<Input>`)
- Sync state via CRDT/WebAssembly with no manual fetch calls ("Zero-Fetch Sync")
- Offload 3rd-party scripts to a Web Worker sidecar (Partytown-style)

## Monorepo Structure
```
NexusJs/
├── apps/
│   └── web/                  # Vite dev app (future: demo/docs site)
├── packages/
│   ├── compiler/             # Rust crate — SWC-based AST analysis + WASM output
│   ├── core/                 # (upcoming) TS runtime core
│   └── primitives/           # (upcoming) Semantic UI components
├── docs/
│   └── action-plan.md        # Master task list (5 phases)
├── package.json              # Root — turbo dev/build/test scripts
├── pnpm-workspace.yaml       # Workspaces: packages/* and apps/*
└── turbo.json                # Pipeline: build depends on ^build; dev is persistent
```

## Tech Stack Decisions
| Layer | Choice | Reason |
|---|---|---|
| Package manager | pnpm | Workspace support, fast installs |
| Monorepo orchestration | Turborepo | Task caching, parallel execution, `dependsOn` ordering |
| Compiler | Rust + SWC | AST-level analysis, WASM output for browser use |
| Dev app | Vite | Fast HMR, plugin API for future nexus-compiler integration |
| WASM bridge | wasm-bindgen | Standard Rust→JS interop |

## Rust Crate: packages/compiler
### Working versions (as of Task 2.1)
```toml
swc_core = { version = "59.0.1", features = ["ecma_parser", "ecma_ast", "ecma_visit", "__common"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
wasm-bindgen = "0.2"
```

### Key lessons from version resolution
- `swc_core` versioning jumped from `0.x` to `59.x` — always run `cargo search swc_core` to find current version
- `swc_core 0.90` used `serde::__private` (removed in serde 1.0.172+) — incompatible with modern serde
- The `__common` feature must be explicitly enabled to access `swc_core::common::{FileName, SourceMap}`
- Do NOT add `swc_ecma_parser` or `swc_ecma_visit` as separate dependencies — they conflict with swc_core's internal versions
- `new_source_file()` requires owned data: pass `src.to_string()`, not `src` or `src.into()`

### Module structure
```
src/
├── lib.rs              — declares all modules
├── triggers.rs         — Trigger enum + CLIENT/SERVER_TRIGGERS constants
├── scanner.rs          — CapabilityScanner: detects browser globals
├── secret_scanner.rs   — SecretScanner: detects process.env + DB imports
└── slicer/
    ├── mod.rs          — re-exports Classifier, Transformer, SliceResult
    ├── classifier.rs   — two-pass AST classifier (5 DeclKinds)
    └── transformer.rs  — produces server/client JS via swc_ecma_codegen
```

### Slicer design decisions
- `DeclKind` has 5 variants: ServerOnly, ClientOnly, Shared, BoundaryCrossing, Mixed
- Classifier runs two passes: (1) direct trigger scan per declaration, (2) cross-boundary call graph analysis
- BoundaryCrossing = server fn called from client context → gets RPC stub in client bundle
- Mixed = same fn uses both browser APIs and server secrets → flagged as error
- `Str.value` in swc v59 is `Wtf8Atom` — use `.into()` for `String → Wtf8Atom` conversion (works via From impl)
- `Ident::new(sym, span, ctxt)` constructor takes 3 args in swc v59
- `BlockStmt` has a `ctxt: SyntaxContext` field in swc v59 — use `Default::default()`
- Transformer uses `module.body.retain()` for filtering, `VisitMut` for RPC stub injection

## Completed Tasks
- [x] Task 1.1 — Monorepo initialized (pnpm + Turborepo)
- [x] Task 1.2 — Rust compiler crate created (packages/compiler)
- [x] Task 1.3 — Cargo.toml configured with swc_core, serde, wasm-bindgen
- [x] Task 1.4 — Dev pipeline configured (turbo dev with dependsOn + Vite config)
- [x] Task 2.1 — CapabilityScanner: detects window, document, localStorage
- [x] Task 2.2 — SecretScanner: detects process.env + DB imports (ESM + require + node: protocol)
- [x] Task 2.3 — Slicer: Classifier (5 DeclKinds + BoundaryCrossing detection) + Transformer (server/client JS output + RPC stubs)

## In Progress
- [ ] Task 2.4 — Vite Plugin: intercept .nexus files and route through Rust Slicer

## Turborepo Pipeline Logic
- `build` depends on `^build` — upstream packages build first
- `dev` depends on `^build` + persistent/uncached — compiler builds before Vite starts
- `outputs: ["dist/**", "pkg/**"]` — caches both TS and WASM build artifacts
- `apps/web` declares `@nexus/compiler: workspace:*` — this is what tells Turbo the dependency edge

## Environment Notes
- User is on Windows 11, uses Git Bash (MINGW64) inside VS Code
- `cargo` is NOT on Git Bash PATH by default — must run Rust commands in Windows CMD or fix with: `echo 'export PATH="/c/Users/Asus/.cargo/bin:$PATH"' >> ~/.bashrc`
- `pnpm` installed globally via `npm install -g pnpm`
- Rust installed via rustup-init.exe (not via VS Code rust-analyzer extension)

## Collaboration Preferences
- Test all Rust code with `cargo test` before declaring a task complete
- When version errors occur: use `cargo search <crate>` to find current version rather than guessing
- Explain the "why" behind architectural decisions, not just the "what"
- Complete any mentioned follow-up suggestions before moving to the next task
