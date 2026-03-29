# UltimateJs — Project Context for Claude

## What This Project Is
A high-performance JavaScript framework with a Rust compiler core. It aims to:
- Automatically split components into server/client bundles ("Fluid Execution")
- Provide a semantic UI primitive system (`<Stack>`, `<Text>`, `<Action>`, `<Input>`)
- Sync state via CRDT/WebAssembly with no manual fetch calls ("Zero-Fetch Sync")
- Offload 3rd-party scripts to a Web Worker sidecar (Partytown-style)

## Monorepo Structure
```
UltimateJs/
├── apps/
│   └── web/                  # Vite dev app (future: demo/docs site)
├── packages/
│   ├── compiler/             # Rust crate — SWC-based AST analysis + WASM output
│   ├── crdt/                 # Rust crate — Automerge CRDT compiled to WASM (@ultimatejs/crdt)
│   ├── core/                 # TS runtime core — useSync hook + CRDT loader
│   ├── primitives/           # TS types: Stack/Text/Action/Input + NexusRenderer<TNode>
│   ├── web/                  # Web renderer: maps primitives → HTML + inline styles
│   ├── native/               # Native renderer: maps primitives → React Native View/Text/Pressable/TextInput
│   ├── email/                # Email renderer: maps primitives → MSO-safe HTML strings (TNode=string)
│   ├── sidecar/              # Web Worker sidecar — offloads 3rd-party scripts, DOM proxy
│   └── inspector/            # DevTools overlay — color-coded server/client component map
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

### Vite plugin design decisions
- Nexus files use `.ultimate.tsx` / `.ultimate.tsx` extension to opt into slicing
- The plugin calls the Rust binary as a subprocess via `spawnSync` (stdin → stdout JSON)
- Binary resolution order: `ULTIMATE_COMPILER_BIN` env var → release build → debug build
- Results cached per file ID — cleared on HMR hot update
- SSR detection via `options?.ssr` (Vite 5 transform hook second arg)
- Source maps not yet emitted — pending swc codegen source map support (future task)
- `packages/vite-plugin` is a separate workspace package (`@ultimatejs/vite-plugin`)

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

- [x] Task 2.4 — Vite Plugin + Rust CLI binary (`nexus-compiler`) with stdin/stdout JSON bridge

- [x] Task 3.1 — Core Interface: TypeScript types for `<Stack>`, `<Text>`, `<Action>`, `<Input>` + `NexusRenderer<TNode>` contract
- [x] Task 3.2 — Web Renderer: `@ultimatejs/web` package — maps all four primitives to React/HTML using inline styles + CSS variables

## Web Renderer design decisions (Task 3.2)
- Package: `packages/web` (`@ultimatejs/web`), peer depends on React ^18 || ^19
- Styling strategy: inline styles for everything (colors, spacing, layout) so the renderer is self-contained — no Tailwind config required
- Colors: all `ColorToken` values resolve to `--nexus-*` CSS custom properties; theme is injected at app root
- Spacing: `SpaceScale` integers map to Tailwind's 4px-unit convention (1→4px, 2→8px, etc.); `"Npx"` and `"N%"` strings pass through unchanged
- `NexusRenderer<ReactElement>` is satisfied in `renderer.ts`; children cast is safe because React always passes ReactNode at runtime
- `Spinner` in Action is defined at module level (not inline) to avoid re-mount on each render
- Static style maps hoisted outside components to avoid object recreation per render
- Input bridges `onChange(value: string)` and `onSubmit(value: string)` to the native React event API
- Action renders `<a>` when `href` is set, `<button type="button">` otherwise; `link` variant skips size padding

- [x] Task 3.3 — Native Renderer: `@ultimatejs/native` — maps all four primitives to React Native components

## Native Renderer design decisions (Task 3.3)
- Package: `packages/native` (`@ultimatejs/native`), peer depends on React ^18||^19 + react-native >=0.72
- `@types/react-native` is deprecated — modern RN ships its own types; use `@types/react@^19`
- SpaceValue → dp numbers (unitless, 4dp-per-unit convention matching web renderer)
- ColorToken → resolved against DEFAULT_THEME (hex strings); exported so apps can read the palette
- No CSS custom properties in RN — DEFAULT_THEME is a plain Record<ColorToken, string>
- `as` prop (HTML element override) is web-only — silently ignored in native renderer
- `external` prop is web-only (target="_blank") — ignored in native; all URLs open via Linking
- Action uses `ActivityIndicator` for loading state (native spinner, no animation CSS needed)
- Input uses `aria-required` / `aria-invalid` (new-arch RN accessibility API, not deprecated `accessibilityRequired`)
- Icon slots render the raw icon string — intended to be swapped for an icon library in user code

- [x] Task 3.4 — Email Renderer: `@ultimatejs/email` — maps all four primitives to MSO-safe HTML strings
- [x] Task 4.1 — WASM Bridge: `@ultimatejs/crdt` — Automerge CRDT document compiled to WebAssembly via wasm-pack
- [x] Task 4.2 — useSync hook: `@ultimatejs/core` — React hook connecting CRDT doc to WebSocket transport
- [x] Task 4.3 — WebSocket transport: `@ultimatejs/sync-server` — binary CRDT sync server with broadcast, GC, and persistence
- [x] Task 4.4 — Optimistic rollbacks: rejection frame protocol (0xFF) in server + rollback logic in useSync hook

## Email Renderer design decisions (Task 3.4)
- TNode = string — the only renderer that doesn't use React; all functions return raw HTML strings
- No JSX in this package — pure TypeScript string composition
- Layout: `<table role="presentation">` always (flexbox unsupported in Outlook)
- Stack column → `<table><tr><td>` single-column; row → `<table><tr>` (children expected to be `<td>` elements)
- gap → applied as padding on the `<td>` (CSS `gap` not supported in email clients)
- Color: same DEFAULT_THEME hex strings as native (no CSS variables in email clients)
- Text children are run through `escapeHtml` to prevent injection; apostrophes are NOT escaped (not needed in text nodes, only in attributes)
- Action always renders as `<a>` (no `<button>` in email); defaults to `href="#"` when no href given
- Input renders a static visual placeholder only — label, underline field, error/hint text; no `<input>` tag
- `wrapDocument()` utility produces a full MSO-safe HTML document with preview text, centering shell table, MSO conditional comments
- 40 unit tests cover all four components + wrapDocument; pure string assertions, no DOM/jsdom required

- [x] Task 5.1 — Sidecar Worker: `@ultimatejs/sidecar` — Partytown-style Web Worker that intercepts `<script type="text/ultimatejs">` tags, proxies DOM access async via postMessage, 49 tests

## Sidecar Worker design decisions (Task 5.1)
- Package: `packages/sidecar` (`@ultimatejs/sidecar`), TypeScript ESM, no peer dependencies
- Opt-in via `<script type="text/ultimatejs" src="...">` — browser ignores unknown types, worker loads them
- **Async proxy** (Promise-based, not SharedArrayBuffer/Atomics) — simpler, no COOP/COEP headers required
- `buildProxy(path, pending, send)` — recursive Proxy with apply/set/get traps; accumulates path lazily, only sends message on call or set
- `buildWindowProxy` — window-shaped proxy; native Worker globals (fetch, setTimeout, Math, etc.) return `undefined` so the Worker uses its own implementations
- `handleProxyRequest(win, msg)` — main-thread executor: navigates path on real `window`, returns value; `set` is fire-and-forget (no reply)
- `collectSidecarScripts(container, scriptType)` — accepts a `ScriptContainer` interface so it's testable without jsdom
- Worker entry (`worker-entry.ts`) uses `fetch + new Function('window','document',…, src)` rather than `importScripts` — this is what gives us interception of DOM access (importScripts would run scripts in native worker scope where `window` doesn't exist)
- `MutationObserver` in `initSidecar` watches for scripts injected after page load (e.g. Google Tag Manager injecting pixels)
- Protocol: `WorkerToMain` = get/set/call; `MainToWorker` = response/error/load; type guards `isWorkerMessage` / `isMainMessage`
- 49 unit tests: protocol (15) + worker-proxy (19) + sidecar (15); all run in Node without jsdom

- [x] Task 5.2 — Nexus Inspector: `@ultimatejs/inspector` — browser DevTools overlay with color-coded component outlines + floating stats panel, 59 tests

## Nexus Inspector design decisions (Task 5.2)
- Package: `packages/inspector` (`@ultimatejs/inspector`), TypeScript ESM, browser-only (no Node peer deps)
- Opt-in via `data-ultimate-kind="server|client|shared|boundary|mixed"` on DOM elements (set by web renderer or compiler)
- Optional `data-ultimate-name` attribute for component display name
- **CSS-only outlines**: injects a single `<style>` element with `outline` rules — zero JS per-element, always correctly positioned, no scroll/resize listeners needed
- **`::after` kind badges**: CSS pseudo-element renders a colored label in the top-left of each annotated element; `position: relative !important` is added to the host (acceptable dev-tool tradeoff)
- `buildStylesheet(dataAttr)` — pure function, returns CSS string; fully testable without DOM
- `buildStatsRows(stats)` / `buildPanelContent(stats)` — pure HTML-string builders; testable without DOM
- `scanComponents(root, dataAttr)` — accepts `Scannable` interface (`querySelectorAll`) so it's testable without jsdom
- `initInspector(opts?)` — manages enable/disable/toggle/refresh/destroy lifecycle; installs `MutationObserver` to auto-refresh when DOM changes
- Panel: fixed-position bottom-right overlay, dark theme (`#1e1e2e`/Catppuccin palette), immune to host page CSS (all inline styles)
- `ALL_KINDS` is `Object.freeze()`'d — runtime immutable, not just TypeScript readonly
- 59 tests: types (8) + scanner (13) + styles (11) + panel (14) + inspector (13); uses `jest-environment-jsdom` for DOM tests

- [x] Task 5.3 — Snapshot Boundary: `@ultimatejs/snapshot` — React Error Boundary with automatic time-travel restore via ring buffer, 39 tests

## Snapshot Boundary design decisions (Task 5.3)
- Package: `packages/snapshot` (`@ultimatejs/snapshot`), TypeScript ESM, peer depends on React ^18||^19 + react-dom ^18||^19
- **`SnapshotBuffer<T>`** — generic fixed-capacity LIFO ring buffer; `push()` evicts oldest when at capacity, `pop()` returns newest (time-travel); `getAll()` returns a non-mutating copy newest-first
- **`SnapshotBoundary<T>`** — class component (hooks can't catch errors); uses `SnapshotBuffer` to record each successfully-rendered `snapshot` prop; on child throw: `componentDidCatch` pops the newest snapshot, calls `onRestore(data, meta)`, then `setState({ hasError: false })` — React batches these two state updates in one flush so children re-render with restored data without a flash of the fallback
- **Default fallback** hoisted outside class (`rendering-hoist-jsx`) — `DefaultFallback` function component, not recreated on every render
- **Conditional render** uses ternary not `&&` (`rendering-conditional-render`) for the error message `<pre>`
- **`RestoreMeta`** carries `timestamp`, `remaining` (snapshots left after this restore), and `error` — useful for telemetry and retry-limit UI
- Buffer exhaustion: when `pop()` returns `undefined` (all snapshots tried), `componentDidCatch` skips the `setState` reset → boundary stays in error state and renders `fallback` prop or `DefaultFallback`
- **`useSnapshot<T>(initial, opts?)`** — convenience hook; returns `{ value, setValue, boundaryProps }`; `setValue` uses functional setState (`rerender-functional-setstate`); `onRestore` wrapped in `useCallback([])` for a permanently stable reference that won't cause `SnapshotBoundary.componentDidUpdate` to re-record snapshots spuriously
- **jest-dom types**: uses `@testing-library/jest-dom/jest-globals` (ESM-compatible, augments `@jest/expect`) in `setupFilesAfterEnv`; ts-jest `diagnostics: false` avoids a module-augmentation resolution issue with the inline tsconfig — type safety is preserved for source files via the main tsconfig
- 39 tests: snapshot-buffer (17) + snapshot-boundary (14) + use-snapshot (8); uses `jest-environment-jsdom` + `@testing-library/react`

- [x] Task 6.1 — AccessibilityScanner (Rust): SWC AST visitor detecting 6 WCAG 2.1 AA rules, 20 tests

## AccessibilityScanner design decisions (Task 6.1)
- Module: `packages/compiler/src/accessibility_scanner.rs`, follows CapabilityScanner / SecretScanner pattern
- **swc_ecma_ast v21 API differences** from older swc versions:
  - `JSXAttrValue::Lit` no longer exists — string literal attributes use `JSXAttrValue::Str(Str)` instead
  - `Wtf8Atom` (the type of `Str.value`) does NOT implement `AsRef<str>` — use `.to_string_lossy()` (via `Deref` to `Wtf8`, which has `to_string_lossy() -> Cow<str>`)
  - Numeric literals in JSX expressions `{-1}` are `Expr::Unary { op: Minus, arg: Lit::Num }` — need to handle the unary case for negative tabindex
- **6 rules implemented**:
  - `missing-alt` (WCAG 1.1.1, Error) — `<img>` without any `alt` attribute; `alt=""` is intentionally valid (decorative images)
  - `unlabeled-action` (WCAG 4.1.2, Error) — `<Action>` with no text child and no `aria-label`/`aria-labelledby`
  - `heading-order` (WCAG 1.3.1, Warning) — heading level skips (e.g. h1→h3); decreasing levels (h2→h1) are fine
  - `missing-input-label` (WCAG 1.3.1, Error) — `<input>` / `<Input>` without `aria-label`, `aria-labelledby`, or `id`
  - `empty-link` (WCAG 2.4.4, Error) — `<a>` with no text content and no `aria-label`
  - `positive-tabindex` (WCAG 2.4.3, Warning) — `tabIndex` > 0 disrupts natural focus order
- `AccessibilityViolation` struct serialises to JSON via `serde::Serialize` (same output format as CLI + WASM consumers)
- Uses `Syntax::Typescript { tsx: true }` parser in tests (JSX is only valid in TSX/JSX files)
- `children_have_visible_text()` is a free recursive function (not a method) to avoid `Self` scope issues
- 20 unit tests: one positive + one negative per rule plus a clean-component integration test
- All 39 compiler tests pass (20 new + 19 existing)

## In Progress
- [ ] Phase 6 — Accessibility Layer (Task 6.2 next)

## Optimistic rollback design decisions (Task 4.4)
- Protocol: server sends single byte 0xFF (REJECTION_FRAME) when store.merge() throws on invalid bytes
- Client (useSync): tracks `confirmedBytesRef` (last server-acknowledged snapshot) and `pendingKeysRef` (keys written optimistically since last confirmation)
- On rejection frame: doc is reloaded from `confirmedBytesRef` via `loadDoc()`, pending keys cleared, `onRollback(rejectedKeys)` callback fired, React state dispatched as "rollback"
- On successful server delta: `confirmedBytesRef` updated to `doc.save()`, `pendingKeysRef` cleared
- REJECTION_FRAME constant exported from both `@ultimatejs/core` and `@ultimatejs/sync-server` — same value (0xFF) used by both sides
- 46 total tests passing: @ultimatejs/core (23) + @ultimatejs/sync-server (23); rejection frame tests cover: single-byte detection, invalid-bytes trigger, no-broadcast-on-reject

## WebSocket sync server design decisions (Task 4.3)
- Package: `packages/sync-server` (`@ultimatejs/sync-server`), pure Node.js, no React dependency
- Uses `ws` WebSocketServer + `@automerge/automerge` v3 (JS, not WASM — runs in Node without a browser)
- Protocol: connect → server sends full snapshot; subsequent binary frames = CRDT delta → merge + broadcast
- `DocumentStore`: in-memory Map keyed by `collection/id` → Automerge document; `getBytes()`, `merge()`, `delete()`, `has()`, `size`
- `NexusSyncServer`: wraps WebSocketServer; exposes `ready: Promise<void>` (await before connecting clients); `peerCount`, `documentCount`, `close()`
- Factory helpers: `createSyncServer(opts)` (standalone) and `attachSyncServer(httpServer, opts)` (shared port with Express/Fastify)
- GC: when last peer for a (collection, id) disconnects, the document is evicted from the store
- Broadcast excludes the sender — no echo
- URL scheme: `ws://<host>:<port>/sync/<collection>/<id>` — decoded with `decodeURIComponent`; invalid URLs close with code 4404
- `pathPrefix` configurable (default `/sync`)
- Test clients use `globalThis.WebSocket` (Node.js 22+ native) instead of the `ws` client — avoids ESM compat issues in `--experimental-vm-modules` mode
- 21 tests: document-store (11) + integration server tests (10) including broadcast, no-echo, room isolation, persistence, GC, URL validation

## useSync hook design decisions (Task 4.2)
- Package: `packages/core` (`@ultimatejs/core`), TypeScript ESM, peer depends on React ^18||^19
- `crdt-loader.ts` — singleton async loader for the WASM module; init runs exactly once even with concurrent hook mounts; uses a module-level promise to dedup concurrent calls
- `use-sync.ts` — `useSync(collection, id, options?)` returns `[state, update]`
  - `state`: `Record<string, string>` — snapshot of all root CRDT keys, updated on every incoming frame
  - `update(key, value)`: applies local change to doc, dispatches optimistic state, sends `doc.save()` bytes to server over WebSocket
- WebSocket URL: `ws[s]://<host>/sync/<collection>/<id>` (auto wss on HTTPS); overridable via `options.serverUrl`
- First binary frame from server = full snapshot → loaded via `CrdtDoc.load()`; subsequent frames = deltas → merged via `CrdtDoc.merge()`
- Empty binary frame (0 bytes) = server signals empty doc → hooks dispatches ready with empty state
- WASM memory is freed (`doc.free()`) on hook unmount via `useEffect` cleanup
- `ws.binaryType = "arraybuffer"` — frames arrive as `ArrayBuffer`, converted to `Uint8Array` before CRDT calls
- Manual Jest mock at `__mocks__/@ultimatejs/crdt.js` + `moduleNameMapper` in jest.config.js — WASM cannot run in Node; mock provides the full API surface as no-ops; never affects runtime builds
- 16 unit tests: singleton loader, API surface, docToState, buildWsUrl (encoding, fallback), send/no-send based on WS ready state

## WASM Bridge design decisions (Task 4.1)
- Package: `packages/crdt` (`@ultimatejs/crdt`), Rust crate with `crate-type = ["cdylib", "rlib"]`
- Uses `automerge 0.8` with `features = ["wasm"]` — ships its own `js-sys`/`web-sys`/`wasm-bindgen` via feature flag
- `CrdtDoc` is a flat key-value document (root Automerge Map) — sufficient for component state sync
- API: `new()`, `get()`, `get_json()`, `set()`, `set_number()`, `set_bool()`, `delete()`, `save()`, `load()`, `merge()`, `keys()`
- `save()` → `Vec<u8>` / `Uint8Array` (Automerge binary format); `load()` and `merge()` both accept raw bytes
- `merge()` is CRDT-safe: concurrent writes resolve deterministically, no data lost
- Built with `wasm-pack build --target web --out-dir pkg` → outputs to `packages/crdt/pkg/`
- Workspace `package.json` at crate root wraps the `pkg/` output as `@ultimatejs/crdt`; `pnpm-workspace.yaml` picks it up via `packages/*`
- `turbo.json` already has `outputs: ["pkg/**"]` — WASM build artifacts are cached correctly
- automerge 0.8 API notes: range iterators yield `MapRangeItem`/`ListRangeItem` structs (not tuples); map values are `ValueRef<'_>` / `ScalarValueRef<'_>` (not `Value`/`ScalarValue`)
- 12 unit tests: new/empty, set+get string/number/bool, delete, missing key, save+load roundtrip, merge independent docs, concurrent merge, keys listing, get_json

## Turborepo Pipeline Logic
- `build` depends on `^build` — upstream packages build first
- `dev` depends on `^build` + persistent/uncached — compiler builds before Vite starts
- `outputs: ["dist/**", "pkg/**"]` — caches both TS and WASM build artifacts
- `apps/web` declares `@ultimatejs/compiler: workspace:*` — this is what tells Turbo the dependency edge

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
