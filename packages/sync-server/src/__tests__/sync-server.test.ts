/**
 * Integration tests for UltimateSyncServer.
 *
 * Uses Node.js 22+ native globalThis.WebSocket as the test client
 * (avoids ESM/CJS compat issues with the ws package client in this env).
 * The server itself still uses the ws package's WebSocketServer.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as Automerge from "@automerge/automerge";
import { UltimateSyncServer, REJECTION_FRAME } from "../sync-server.js";

// Node.js 22+ ships a native WHATWG-compatible WebSocket global.
const NativeWS = globalThis.WebSocket as typeof WebSocket;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomPort(): number {
  return 41000 + Math.floor(Math.random() * 8000);
}

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new NativeWS(url);
    ws.binaryType = "arraybuffer";
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(new Error(`WS error: ${String(e)}`)));
  });
}

function nextMessage(ws: WebSocket): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    ws.addEventListener(
      "message",
      (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) {
          resolve(new Uint8Array(e.data));
        } else {
          reject(new Error(`Expected ArrayBuffer, got ${typeof e.data}`));
        }
      },
      { once: true }
    );
  });
}

async function sendAndReceive(
  sender: WebSocket,
  receiver: WebSocket,
  bytes: Uint8Array
): Promise<Uint8Array> {
  const promise = nextMessage(receiver);
  sender.send(bytes);
  return promise;
}

function waitForClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => ws.addEventListener("close", () => resolve(), { once: true }));
}

function tick(ms = 30): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UltimateSyncServer", () => {
  let server: UltimateSyncServer;
  let port: number;
  let baseUrl: string;

  beforeEach(async () => {
    port = randomPort();
    baseUrl = `ws://127.0.0.1:${port}`;
    server = new UltimateSyncServer({ port });
    await server.ready;
  });

  afterEach(async () => {
    await server.close();
  });

  // -------------------------------------------------------------------------
  // Snapshot on connect
  // -------------------------------------------------------------------------

  it("sends a binary snapshot immediately on connect", async () => {
    const ws = await connect(`${baseUrl}/sync/todos/1`);
    const snapshot = await nextMessage(ws);

    expect(snapshot).toBeInstanceOf(Uint8Array);
    expect(snapshot.length).toBeGreaterThan(0);

    const doc = Automerge.load<Record<string, unknown>>(snapshot);
    expect(doc).toBeDefined();

    ws.close();
    await waitForClose(ws);
  });

  it("increments peer count on connect", async () => {
    expect(server.peerCount).toBe(0);
    const ws = await connect(`${baseUrl}/sync/todos/1`);
    await nextMessage(ws);
    expect(server.peerCount).toBe(1);
    ws.close();
    await waitForClose(ws);
  });

  // -------------------------------------------------------------------------
  // Broadcast on delta
  // -------------------------------------------------------------------------

  it("broadcasts merged bytes to all other peers in the same room", async () => {
    const url = `${baseUrl}/sync/todos/shared`;

    const clientA = await connect(url);
    await nextMessage(clientA);

    const clientB = await connect(url);
    await nextMessage(clientB);

    let doc = Automerge.init<{ title?: string }>();
    doc = Automerge.change(doc, (d) => { d.title = "From A"; });

    const received = await sendAndReceive(clientA, clientB, Automerge.save(doc));
    const merged = Automerge.load<{ title?: string }>(received);
    expect(merged.title).toBe("From A");

    clientA.close();
    clientB.close();
    await Promise.all([waitForClose(clientA), waitForClose(clientB)]);
  });

  it("does not echo back to the sender", async () => {
    const url = `${baseUrl}/sync/todos/echo-test`;
    const clientA = await connect(url);
    await nextMessage(clientA);

    let doc = Automerge.init<{ val?: string }>();
    doc = Automerge.change(doc, (d) => { d.val = "test"; });
    clientA.send(Automerge.save(doc));

    await tick(60);

    let gotEcho = false;
    clientA.addEventListener("message", () => { gotEcho = true; }, { once: true });
    await tick(60);
    expect(gotEcho).toBe(false);

    clientA.close();
    await waitForClose(clientA);
  });

  it("does not leak messages to peers in a different room", async () => {
    const clientA = await connect(`${baseUrl}/sync/todos/room1`);
    await nextMessage(clientA);

    const clientB = await connect(`${baseUrl}/sync/todos/room2`);
    await nextMessage(clientB);

    let doc = Automerge.init<{ x?: string }>();
    doc = Automerge.change(doc, (d) => { d.x = "private"; });
    clientA.send(Automerge.save(doc));

    await tick(60);

    let leaked = false;
    clientB.addEventListener("message", () => { leaked = true; }, { once: true });
    await tick(60);
    expect(leaked).toBe(false);

    clientA.close();
    clientB.close();
    await Promise.all([waitForClose(clientA), waitForClose(clientB)]);
  });

  // -------------------------------------------------------------------------
  // State persistence
  // -------------------------------------------------------------------------

  it("new client receives current state including prior changes", async () => {
    const url = `${baseUrl}/sync/todos/persist`;

    const clientA = await connect(url);
    await nextMessage(clientA);

    let doc = Automerge.init<{ status?: string }>();
    doc = Automerge.change(doc, (d) => { d.status = "done"; });
    clientA.send(Automerge.save(doc));
    await tick(60);

    const clientB = await connect(url);
    const snapshot = await nextMessage(clientB);
    const loaded = Automerge.load<{ status?: string }>(snapshot);
    expect(loaded.status).toBe("done");

    clientA.close();
    clientB.close();
    await Promise.all([waitForClose(clientA), waitForClose(clientB)]);
  });

  // -------------------------------------------------------------------------
  // GC on disconnect
  // -------------------------------------------------------------------------

  it("GCs the document when the last peer disconnects", async () => {
    const ws = await connect(`${baseUrl}/sync/todos/gc`);
    await nextMessage(ws);
    expect(server.documentCount).toBe(1);

    ws.close();
    await waitForClose(ws);
    await tick(60);

    expect(server.documentCount).toBe(0);
  });

  it("does not GC when at least one peer remains", async () => {
    const url = `${baseUrl}/sync/todos/no-gc`;
    const clientA = await connect(url);
    await nextMessage(clientA);
    const clientB = await connect(url);
    await nextMessage(clientB);

    clientA.close();
    await waitForClose(clientA);
    await tick(60);

    expect(server.documentCount).toBe(1);

    clientB.close();
    await waitForClose(clientB);
  });

  // -------------------------------------------------------------------------
  // Rejection frame (optimistic rollback protocol)
  // -------------------------------------------------------------------------

  it("sends a rejection frame (0xFF) when a client sends invalid bytes", async () => {
    const ws = await connect(`${baseUrl}/sync/todos/reject-test`);
    await nextMessage(ws); // consume snapshot

    // Send garbage bytes that are not a valid Automerge document
    ws.send(new Uint8Array([0x00, 0x01, 0x02, 0x03]));

    const response = await nextMessage(ws);
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBe(1);
    expect(response[0]).toBe(REJECTION_FRAME[0]);

    ws.close();
    await waitForClose(ws);
  });

  it("does not broadcast after a failed merge", async () => {
    const url = `${baseUrl}/sync/todos/no-broadcast-on-reject`;

    const clientA = await connect(url);
    await nextMessage(clientA);

    const clientB = await connect(url);
    await nextMessage(clientB);

    // Client A sends garbage
    clientA.send(new Uint8Array([0xba, 0xad]));

    // Client A should get the rejection frame
    const rejection = await nextMessage(clientA);
    expect(rejection.length).toBe(1);
    expect(rejection[0]).toBe(0xff);

    // Client B should NOT receive anything
    await tick(80);
    let clientBReceived = false;
    clientB.addEventListener("message", () => { clientBReceived = true; }, { once: true });
    await tick(60);
    expect(clientBReceived).toBe(false);

    clientA.close();
    clientB.close();
    await Promise.all([waitForClose(clientA), waitForClose(clientB)]);
  });

  // -------------------------------------------------------------------------
  // URL validation
  // -------------------------------------------------------------------------

  it("rejects connections with an invalid URL (missing id segment)", async () => {
    const ws = new NativeWS(`${baseUrl}/sync/todos`);
    const closeCode = await new Promise<number>((resolve) => {
      ws.addEventListener("close", (e: { code: number }) => resolve(e.code), { once: true });
      ws.addEventListener("error", () => resolve(0), { once: true });
    });
    expect(closeCode).toBe(4404);
  });

  it("rejects connections outside the /sync prefix", async () => {
    const ws = new NativeWS(`${baseUrl}/other/todos/1`);
    const closeCode = await new Promise<number>((resolve) => {
      ws.addEventListener("close", (e: { code: number }) => resolve(e.code), { once: true });
      ws.addEventListener("error", () => resolve(0), { once: true });
    });
    expect(closeCode).toBe(4404);
  });
});
