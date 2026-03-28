# Nexus.js

A high-performance JavaScript framework with a Rust compiler core.

## Vision

Nexus.js eliminates entire categories of boilerplate by making the infrastructure invisible:

| Pillar | What it does |
|---|---|
| **Fluid Execution** | Automatically splits a single component file into Server and Client bundles — no manual `"use client"` annotations |
| **Zero-Fetch Sync** | Replaces `fetch()` calls with a CRDT-powered WebSocket delta stream compiled to WebAssembly |
| **Semantic UI** | A single `<Stack>`, `<Text>`, `<Action>`, `<Input>` component tree renders to Web, React Native, and Email simultaneously |

## Architecture

```
NexusJs/
├── apps/
│   └── web/                  # Vite dev/demo app
├── packages/
│   ├── compiler/             # Rust — SWC-based AST analyzer and code slicer
│   ├── core/                 # TypeScript runtime (upcoming)
│   └── primitives/           # Semantic UI components (upcoming)
└── docs/
    ├── action-plan.md        # Task-by-task build plan
    └── implementation-plan.md
```

## How the Slicer Works

Given a single mixed component:

```tsx
import { db } from './db';           // server-only

export async function getUser(id) {  // runs on server
  return db.user.findUnique({ where: { id } });
}

export function UserCard({ userId }) {
  window.analytics.track('view');    // browser-only
  return <button onClick={() => getUser(userId)}>Load</button>;
}
```

The compiler produces two outputs automatically:

**`.nexus/module.server.js`** — keeps `getUser`, strips `UserCard`

**`.nexus/module.client.js`** — keeps `UserCard`, replaces `getUser` with a type-safe RPC bridge:
```ts
export async function getUser(id) {
  return __nexus_rpc('/api/__nexus/getUser', { id });
}
```

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Compiler | Rust + SWC (AST parsing and transformation) |
| WASM bridge | wasm-bindgen |
| Dev app | Vite |
| Runtime | TypeScript |

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) — `npm install -g pnpm`
- [Rust](https://rustup.rs) — required to build the compiler

## Getting Started

```bash
# Install JS dependencies
pnpm install

# Build and test the Rust compiler
cd packages/compiler
cargo test

# Start the dev server (runs compiler watcher + Vite)
pnpm dev
```

## Build Status

| Task | Description | Status |
|---|---|---|
| 1.1 | Monorepo setup (pnpm + Turborepo) | ✅ Done |
| 1.2 | Rust compiler crate | ✅ Done |
| 1.3 | Cargo.toml (swc_core, serde, wasm-bindgen) | ✅ Done |
| 1.4 | Dev pipeline (turbo dev + Vite) | ✅ Done |
| 2.1 | CapabilityScanner (window, document, localStorage) | ✅ Done |
| 2.2 | SecretScanner (process.env, DB imports) | ✅ Done |
| 2.3 | Slicer — Classifier + Transformer + RPC stubs | ✅ Done |
| 2.4 | Vite Plugin | 🔨 Next |
| 3.x | Semantic UI primitives | ⏳ Planned |
| 4.x | Zero-Fetch Sync (CRDT + WebSocket) | ⏳ Planned |
| 5.x | Error Resilience & Nexus Inspector | ⏳ Planned |

## Contributing

This project is currently in early development. The architecture is being established phase by phase — see `docs/action-plan.md` for the full task list.
