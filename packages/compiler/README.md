# @blazefw/compiler

BlazeFW Rust compiler — SWC-based AST analyser that classifies every declaration in a `.ultimate.tsx` file as `ServerOnly`, `ClientOnly`, `Shared`, `BoundaryCrossing`, or `Mixed`, then produces two JS bundles automatically. Also compiles to WASM for browser-side use.

> **Not published to npm.** This is an internal package. Consumers use `@blazefw/vite-plugin` which calls the `nexus-compiler` binary automatically. Direct use is only needed when building custom tooling.

## Prerequisites

- Rust toolchain (`rustup` + `cargo`) — [install](https://rustup.rs)
- `wasm-pack` for WASM builds — `cargo install wasm-pack`

**Windows:** `cargo` is not on Git Bash's PATH by default. Either run Rust commands in Windows CMD, or add to `~/.bashrc`:
```bash
export PATH="/c/Users/$USER/.cargo/bin:$PATH"
```

## Building

```bash
cd packages/compiler

# Build the CLI binary (used by @blazefw/vite-plugin)
cargo build --release
# Output: target/release/nexus-compiler

# Build the WASM module (used by browser-side tooling)
wasm-pack build --target web --out-dir pkg

# Run all tests (39 tests)
cargo test
```

## CLI usage

The `nexus-compiler` binary reads a source file from `stdin` and writes a JSON result to `stdout`:

```bash
echo 'export function foo() { return window.x; }' | ./target/release/nexus-compiler
```

**Input:** raw TypeScript/TSX source on `stdin`

**Output:** JSON on `stdout`:

```json
{
  "server_js": "// server bundle — empty (no server declarations)",
  "client_js": "export function foo() { return window.x; }",
  "violations": []
}
```

## Module structure

```
src/
├── lib.rs                  — declares all modules; WASM entry point
├── main.rs                 — CLI binary (stdin → stdout JSON)
├── triggers.rs             — CLIENT_TRIGGERS / SERVER_TRIGGERS constants
├── scanner.rs              — CapabilityScanner: detects browser globals
├── secret_scanner.rs       — SecretScanner: detects process.env + DB imports
├── accessibility_scanner.rs — AccessibilityScanner: 6 WCAG 2.1 AA rules
└── slicer/
    ├── mod.rs              — re-exports Classifier, Transformer, SliceResult
    ├── classifier.rs       — two-pass AST classifier (5 DeclKinds)
    └── transformer.rs      — produces server/client JS + RPC stubs
```

## Classification system

The `Classifier` runs two passes over every declaration:

| `DeclKind` | Trigger | Output |
|---|---|---|
| `ServerOnly` | `process.env`, DB imports, `node:*` | Server bundle only |
| `ClientOnly` | `window`, `document`, `localStorage` | Client bundle only |
| `Shared` | No triggers (pure logic) | Both bundles |
| `BoundaryCrossing` | Server fn called from client code | RPC stub in client bundle |
| `Mixed` | Both server + client triggers in same fn | **Error** — flagged in `violations` |

## Server triggers (`SecretScanner`)

- `process.env.*`
- DB imports: `prisma`, `drizzle`, `mongoose`, `pg`, `mysql2`, `better-sqlite3`, `sequelize`
- Node.js protocol: `node:fs`, `node:crypto`, `node:path`, etc.
- CommonJS `require()` with the above

## Client triggers (`CapabilityScanner`)

- `window`, `document`, `navigator`, `location`
- `localStorage`, `sessionStorage`
- `addEventListener`, `removeEventListener`

## Accessibility rules (`AccessibilityScanner`)

Six WCAG 2.1 AA rules checked at AST level:

| Rule ID | Criterion | Severity |
|---|---|---|
| `missing-alt` | 1.1.1 — `<img>` without `alt` | Error |
| `unlabeled-action` | 4.1.2 — `<Action>` without label | Error |
| `heading-order` | 1.3.1 — heading level skips (h1→h3) | Warning |
| `missing-input-label` | 1.3.1 — `<input>` without label or id | Error |
| `empty-link` | 2.4.4 — `<a>` with no text or `aria-label` | Error |
| `positive-tabindex` | 2.4.3 — `tabIndex > 0` | Warning |

## RPC stub shape

`BoundaryCrossing` functions get this stub in the client bundle:

```ts
// Auto-generated — never written by hand
export async function getUser(id: string) {
  return __ultimate_rpc('/api/__ultimate/getUser', { id });
}
```

## Key swc_core notes (v59.x)

- `Str.value` is `Wtf8Atom` — use `.to_string_lossy()` to convert to `&str`
- `Ident::new(sym, span, ctxt)` takes 3 args (not 2)
- `BlockStmt` has `ctxt: SyntaxContext` field — use `Default::default()`
- `JSXAttrValue::Lit` removed — string attrs use `JSXAttrValue::Str(Str)`
- Do **not** add `swc_ecma_parser` or `swc_ecma_visit` as separate deps — they conflict with `swc_core`'s internal versions
