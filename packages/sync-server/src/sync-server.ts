/**
 * UltimateSyncServer — WebSocket binary transport for Zero-Fetch Sync.
 *
 * Protocol:
 *  - Clients connect to  ws://<host>:<port>/sync/<collection>/<id>
 *  - On connect:   server sends the full current document as a binary frame
 *  - On binary msg: server merges the delta, then broadcasts updated bytes
 *                   to all *other* clients watching the same document
 *  - On close:     client is removed from the peer set; doc GC'd if no peers remain
 *
 * Each (collection, id) pair forms an independent "room" with its own
 * Automerge document and set of connected peers.
 */

import { IncomingMessage, Server as HttpServer, createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { DocumentStore } from "./document-store.js";

/**
 * Rejection frame — a single byte 0xFF sent back to the originating client
 * when the server cannot merge its delta (malformed bytes, version conflict, etc.).
 * The client's useSync hook rolls back all pending optimistic writes on receipt.
 */
export const REJECTION_FRAME = new Uint8Array([0xff]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UltimateSyncServerOptions {
  /** TCP port to listen on. Default: 3001 */
  port?: number;
  /**
   * Optional existing HTTP server to attach to.
   * When provided, `port` is ignored — the HTTP server's port is used.
   */
  server?: HttpServer;
  /**
   * URL path prefix for sync connections. Default: "/sync"
   * Clients connect to  <prefix>/<collection>/<id>
   */
  pathPrefix?: string;
  /**
   * Called when an error occurs on a client socket.
   * Does not close the server.
   */
  onError?: (err: Error, collection: string, id: string) => void;
}

interface PeerInfo {
  collection: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export class UltimateSyncServer {
  private wss: WebSocketServer;
  private store: DocumentStore;
  /** Map from WebSocket instance → its (collection, id) */
  private peers = new Map<WebSocket, PeerInfo>();
  private pathPrefix: string;
  private onError?: UltimateSyncServerOptions["onError"];

  /**
   * Resolves once the underlying WebSocketServer is bound and listening.
   * Await this in tests or startup code before connecting clients.
   */
  readonly ready: Promise<void>;

  constructor(options: UltimateSyncServerOptions = {}) {
    const { port = 3001, server, pathPrefix = "/sync", onError } = options;

    this.store = new DocumentStore();
    this.pathPrefix = pathPrefix.replace(/\/$/, "");
    this.onError = onError;

    this.wss = server
      ? new WebSocketServer({ server })
      : new WebSocketServer({ port });

    this.ready = new Promise((resolve, reject) => {
      // When attaching to an existing HTTP server it may already be listening
      if (server?.listening) {
        resolve();
        return;
      }
      this.wss.once("listening", resolve);
      this.wss.once("error", reject);
    });

    this.wss.on("connection", this.handleConnection.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const parsed = this.parseUrl(req.url ?? "");
    if (!parsed) {
      // URL doesn't match our prefix pattern — reject with close code 4404
      ws.close(4404, "Invalid sync URL");
      return;
    }

    const { collection, id } = parsed;
    this.peers.set(ws, { collection, id });

    // --- Send current snapshot to the newly connected client ---
    try {
      const snapshot = this.store.getBytes(collection, id);
      ws.send(snapshot);
    } catch (err) {
      this.onError?.(err as Error, collection, id);
    }

    ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(ws, collection, id, data);
    });

    ws.on("close", () => {
      this.handleClose(ws, collection, id);
    });

    ws.on("error", (err: Error) => {
      this.onError?.(err, collection, id);
    });
  }

  private handleMessage(
    sender: WebSocket,
    collection: string,
    id: string,
    data: Buffer | ArrayBuffer | Buffer[]
  ): void {
    let bytes: Uint8Array;
    if (Buffer.isBuffer(data)) {
      bytes = new Uint8Array(data);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else {
      // Buffer[] — concatenate
      bytes = new Uint8Array(Buffer.concat(data as Buffer[]));
    }

    if (bytes.length === 0) return;

    let updatedBytes: Uint8Array;
    try {
      updatedBytes = this.store.merge(collection, id, bytes);
    } catch (err) {
      this.onError?.(err as Error, collection, id);
      // Tell the sender its delta was rejected so it can roll back
      if (sender.readyState === WebSocket.OPEN) {
        sender.send(REJECTION_FRAME);
      }
      return;
    }

    // Broadcast merged state to all other peers watching this document
    this.broadcast(collection, id, updatedBytes, sender);
  }

  private handleClose(ws: WebSocket, collection: string, id: string): void {
    this.peers.delete(ws);

    // GC the document if no peers remain for this collection/id
    const hasRemainingPeers = [...this.peers.values()].some(
      (p) => p.collection === collection && p.id === id
    );
    if (!hasRemainingPeers) {
      this.store.delete(collection, id);
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcast
  // ---------------------------------------------------------------------------

  /**
   * Send `bytes` to every connected peer watching (collection, id),
   * excluding `except` (the sender that just triggered the update).
   */
  private broadcast(
    collection: string,
    id: string,
    bytes: Uint8Array,
    except: WebSocket
  ): void {
    for (const [ws, info] of this.peers) {
      if (ws === except) continue;
      if (info.collection !== collection || info.id !== id) continue;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(bytes);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // URL parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse  /sync/<collection>/<id>  (or with query string).
   * Returns null for non-matching URLs.
   */
  private parseUrl(
    url: string
  ): { collection: string; id: string } | null {
    // Strip query string
    const path = url.split("?")[0];
    const prefix = this.pathPrefix + "/";
    if (!path.startsWith(prefix)) return null;

    const rest = path.slice(prefix.length);
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) return null;

    const collection = decodeURIComponent(rest.slice(0, slashIdx));
    const id = decodeURIComponent(rest.slice(slashIdx + 1));

    if (!collection || !id) return null;
    return { collection, id };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Number of currently connected peers across all documents.
   */
  get peerCount(): number {
    return this.peers.size;
  }

  /**
   * Number of documents currently held in memory.
   */
  get documentCount(): number {
    return this.store.size;
  }

  /**
   * Close the server and all connected WebSockets.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close all peer connections first
      for (const ws of this.peers.keys()) {
        ws.terminate();
      }
      this.peers.clear();

      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Create and start a standalone UltimateSyncServer.
 *
 * @example
 * const server = createSyncServer({ port: 3001 });
 * // Clients connect to ws://localhost:3001/sync/<collection>/<id>
 */
export function createSyncServer(
  options?: UltimateSyncServerOptions
): UltimateSyncServer {
  return new UltimateSyncServer(options);
}

/**
 * Attach a UltimateSyncServer to an existing Node.js HTTP server.
 * Useful when the sync server shares a port with an Express/Fastify app.
 *
 * @example
 * const http = createServer(expressApp);
 * attachSyncServer(http);
 * http.listen(3000);
 */
export function attachSyncServer(
  server: HttpServer,
  options?: Omit<UltimateSyncServerOptions, "port" | "server">
): UltimateSyncServer {
  return new UltimateSyncServer({ ...options, server });
}
