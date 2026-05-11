# @blazefw/vite-plugin

BlazeFW Vite plugin — intercepts `.blazefw.tsx` files and routes them through the Rust compiler binary via a `stdin → stdout` JSON bridge. Automatically splits each file into a **server bundle** (no browser APIs) and a **client bundle** (RPC stubs replace server functions). Results are cached per file and cleared on HMR.

## Installation

```bash
npm install -D @blazefw/vite-plugin
```

The plugin requires the `blazefw-compiler` Rust binary. It resolves in this order:
1. `BLAZEFW_COMPILER_BIN` environment variable
2. `packages/compiler/target/release/blazefw-compiler` (release build)
3. `packages/compiler/target/debug/blazefw-compiler` (debug build)

To build the binary:

```bash
cd packages/compiler
cargo build --release
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { blazefw } from '@blazefw/vite-plugin';

export default defineConfig({
  plugins: [blazefw()],
});
```

## Options

```ts
import { blazefw, type BlazefwPluginOptions } from '@blazefw/vite-plugin';

blazefw({
  // Glob pattern for files to process.
  // Default: /.blazefw.tsx?$/  (matches .blazefw.tsx and .blazefw.ts)
  include: /.blazefw.tsx?$/,
})
```

## How it works

Given a single mixed `.blazefw.tsx` file:

```tsx
// components/UserDashboard.blazefw.tsx
import { db } from './db';                     // ← server trigger (DB import)

export async function getUser(id: string) {    // classified: ServerOnly
  return db.user.findUnique({ where: { id } });
}

export function UserCard({ userId }) {         // classified: ClientOnly
  window.analytics.track('view');              // ← client trigger (browser global)
  return <button onClick={() => getUser(userId)}>Load</button>;
}
```

The plugin produces two outputs automatically:

**Server bundle** — contains `getUser`, strips `UserCard`:
```js
// .blazefw/UserDashboard.server.js (auto-generated)
export async function getUser(id) {
  return db.user.findUnique({ where: { id } });
}
```

**Client bundle** — contains `UserCard`, replaces `getUser` with a type-safe RPC stub:
```js
// .blazefw/UserDashboard.client.js (auto-generated)
export async function getUser(id) {
  return __blazefw_rpc('/api/__blazefw/getUser', { id });
}
export function UserCard({ userId }) {
  window.analytics.track('view');
  return <button onClick={() => getUser(userId)}>Load</button>;
}
```

## Classification rules

| Classification | Trigger | Behaviour |
|---|---|---|
| `ServerOnly` | `process.env`, DB imports, `node:*` | Kept in server bundle only |
| `ClientOnly` | `window`, `document`, `localStorage` | Kept in client bundle only |
| `Shared` | Pure logic, no triggers | Included in both bundles |
| `BoundaryCrossing` | Server fn called from client code | Gets RPC stub in client bundle |
| `Mixed` | Both triggers in same function | **Compile error** — must be split manually |

## HMR

The plugin hooks into Vite's `handleHotUpdate` — when a `.blazefw.tsx` file changes, its cache entry is cleared and a full page reload is triggered automatically. No manual restart needed.

## Environment variable

```bash
# Point to a custom compiler binary location
BLAZEFW_COMPILER_BIN=/path/to/blazefw-compiler vite dev
```
