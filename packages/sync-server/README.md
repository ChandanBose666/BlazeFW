# @blazefw/sync-server

BlazeFW WebSocket sync server — the binary CRDT transport for Zero-Fetch Sync. Manages per-document rooms, broadcasts CRDT deltas to all connected peers, rejects invalid frames, and garbage-collects documents when all peers disconnect.

## Installation

```bash
npm install @blazefw/sync-server
```

Works in Node.js 18+. No browser support (this is a server-side package).

## Quick start — standalone server

```ts
import { createSyncServer } from '@blazefw/sync-server';

const server = await createSyncServer({ port: 3001 });
await server.ready;

console.log(`Sync server running on ws://localhost:3001/sync`);

// Connect clients to: ws://localhost:3001/sync/<collection>/<id>
```

## Quick start — attach to existing HTTP server

Attach to an Express, Fastify, or plain `http.Server` — shares the same port:

```ts
import express from 'express';
import { createServer } from 'node:http';
import { attachSyncServer } from '@blazefw/sync-server';

const app = express();
const httpServer = createServer(app);

app.get('/health', (req, res) => res.json({ ok: true }));

const sync = await attachSyncServer(httpServer, {
  pathPrefix: '/sync',  // default
});

httpServer.listen(3000, () => {
  console.log('HTTP + WebSocket on port 3000');
});
```

## API

### `createSyncServer(options?)`

```ts
import { createSyncServer, type BlazeSyncServerOptions } from '@blazefw/sync-server';

const server = await createSyncServer({
  port: 3001,            // WebSocket port (default: 3001)
  pathPrefix: '/sync',   // URL prefix (default: '/sync')
  host: '0.0.0.0',       // bind address (default: '0.0.0.0')
});

await server.ready;         // resolves when the server is listening

server.peerCount;           // number of currently connected WebSocket clients
server.documentCount;       // number of documents in memory
await server.close();       // graceful shutdown
```

### `attachSyncServer(httpServer, options?)`

```ts
import { attachSyncServer } from '@blazefw/sync-server';

const sync = await attachSyncServer(existingHttpServer, {
  pathPrefix: '/sync',
});
```

### `DocumentStore`

Low-level in-memory document store. Use directly if you need custom persistence:

```ts
import { DocumentStore } from '@blazefw/sync-server';

const store = new DocumentStore();

store.has('todos', 'item-1');                      // boolean
store.merge('todos', 'item-1', deltaBytes);        // merge CRDT delta, returns updated bytes
store.getBytes('todos', 'item-1');                 // Uint8Array | undefined
store.delete('todos', 'item-1');
store.size;                                         // total document count
```

### `REJECTION_FRAME`

```ts
import { REJECTION_FRAME } from '@blazefw/sync-server';
// REJECTION_FRAME === 0xFF
// Sent to a client when their delta cannot be merged (invalid bytes)
```

## URL scheme

Clients connect to:

```
ws://<host>:<port>/sync/<collection>/<id>
```

- `collection` — groups documents by type (e.g. `todos`, `documents`, `profiles`)
- `id` — unique document identifier within the collection
- Both are decoded with `decodeURIComponent` — safe to use UUIDs or slugs
- Invalid URLs (missing collection/id) close the connection with code `4404`

## Protocol

| Direction | Frame | Meaning |
|---|---|---|
| Server → Client | Binary (N bytes) | Full document snapshot on connect |
| Server → Client | Binary (N bytes) | Merged delta from another peer |
| Server → Client | Binary (0 bytes) | Empty document signal |
| Server → Client | `0xFF` single byte | Delta rejected — client should roll back |
| Client → Server | Binary (N bytes) | CRDT delta to merge and broadcast |

## Persistence

The built-in `DocumentStore` is **in-memory only** — documents are lost on restart and garbage-collected when all peers disconnect. For persistence, replace `DocumentStore` with your own implementation backed by Redis, Postgres, or the filesystem:

```ts
import { BlazeSyncServer } from '@blazefw/sync-server';
import { MyPersistentStore } from './my-store';

const server = new BlazeSyncServer({
  store: new MyPersistentStore(),
  port: 3001,
});
await server.ready;
```

A persistent store must implement: `has()`, `merge()`, `getBytes()`, `delete()`, `size`.

## Garbage collection

When the last peer for a `(collection, id)` pair disconnects, the document is automatically evicted from the in-memory store. Reconnecting peers receive an empty-document signal and start fresh.
