/**
 * useSync — Zero-Fetch Sync hook for UltimateJs
 *
 * Connects a React component to a CRDT document that is kept in sync with
 * all peers via a binary WebSocket. The hook:
 *
 *  1. Lazily loads the @blazefw/crdt WASM module on first call.
 *  2. Opens a WebSocket to `ws[s]://<host>/sync/<collection>/<id>`.
 *  3. On connect, the server sends the current document snapshot as a
 *     binary frame — the hook loads it via CrdtDoc.load().
 *  4. Subsequent binary frames are CRDT deltas — merged via CrdtDoc.merge().
 *  5. Returns `[state, update]` where:
 *     - `state` is a plain Record<string, string> snapshot of all root keys.
 *     - `update(key, value)` applies a local change optimistically, saves
 *       the full doc, and sends the bytes to the server over the WebSocket.
 *
 * Optimistic rollbacks (Task 4.4):
 *  - After every confirmed server message the hook saves a "last confirmed"
 *    snapshot of the doc bytes.
 *  - If the server sends a rejection frame (single byte 0xFF) the local doc
 *    is reloaded from the last confirmed snapshot, reverting any optimistic
 *    writes that the server did not accept.
 *
 * Usage:
 *   const [state, update] = useSync("todos", todoId);
 *   update("title", "Buy milk");   // optimistic + synced
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import { createDoc, loadDoc } from "./crdt-loader.js";
import type { CrdtDoc } from "@blazefw/crdt";

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

/**
 * Rejection frame sent by the server when it cannot merge a client delta.
 * A single byte with value 0xFF.
 */
export const REJECTION_FRAME = 0xff;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncState = Record<string, string>;

export type UpdateFn = (key: string, value: string) => void;

export type UseSyncResult = [state: SyncState, update: UpdateFn];

export interface UseSyncOptions {
  /**
   * WebSocket server URL.
   * Defaults to `ws://<window.location.host>/sync`.
   */
  serverUrl?: string;
  /**
   * Called when a local optimistic update is rolled back by the server.
   * Useful for showing toast notifications or logging.
   */
  onRollback?: (rejectedKeys: string[]) => void;
  /**
   * Called when the WebSocket encounters a non-fatal error.
   */
  onError?: (err: Error) => void;
  /**
   * Called when the WebSocket connection closes unexpectedly.
   */
  onClose?: (event: CloseEvent) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read all root keys from a CrdtDoc into a plain object. */
function docToState(doc: CrdtDoc): SyncState {
  const keysJson = doc.keys();
  const keys: string[] = JSON.parse(keysJson);
  const state: SyncState = {};
  for (const key of keys) {
    const value = doc.get(key);
    if (value !== undefined) {
      state[key] = value;
    }
  }
  return state;
}

/** Build the WebSocket URL for a given collection + document id. */
function buildWsUrl(
  base: string | undefined,
  collection: string,
  id: string
): string {
  if (base) {
    return `${base.replace(/\/$/, "")}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
  }
  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss"
      : "ws";
  const host =
    typeof window !== "undefined" ? window.location.host : "localhost:3000";
  return `${proto}://${host}/sync/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
}

/** Returns true when the frame is a server rejection (single byte 0xFF). */
function isRejectionFrame(bytes: Uint8Array): boolean {
  return bytes.length === 1 && bytes[0] === REJECTION_FRAME;
}

// ---------------------------------------------------------------------------
// Hook state machine
// ---------------------------------------------------------------------------

type HookState =
  | { status: "loading" }
  | { status: "ready"; state: SyncState }
  | { status: "error"; error: Error };

type HookAction =
  | { type: "ready"; state: SyncState }
  | { type: "update"; state: SyncState }
  | { type: "rollback"; state: SyncState }
  | { type: "error"; error: Error };

function reducer(_prev: HookState, action: HookAction): HookState {
  switch (action.type) {
    case "ready":
    case "update":
    case "rollback":
      return { status: "ready", state: action.state };
    case "error":
      return { status: "error", error: action.error };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSync(collection, id, options?)
 *
 * @param collection  Logical namespace for the document (e.g. "todos")
 * @param id          Unique document identifier within the collection
 * @param options     Optional configuration
 * @returns           [state, update] — current snapshot and setter
 */
export function useSync(
  collection: string,
  id: string,
  options: UseSyncOptions = {}
): UseSyncResult {
  const { serverUrl, onRollback, onError, onClose } = options;

  const [hookState, dispatch] = useReducer(reducer, { status: "loading" });

  // Stable refs — mutated in place, never trigger re-renders
  const docRef = useRef<CrdtDoc | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Last confirmed snapshot bytes from the server.
   * On rejection the doc is reloaded from this snapshot to roll back any
   * optimistic writes that occurred since the last server acknowledgement.
   */
  const confirmedBytesRef = useRef<Uint8Array | null>(null);

  /** Keys that have been optimistically written since the last confirmation. */
  const pendingKeysRef = useRef<Set<string>>(new Set());

  const onRollbackRef = useRef(onRollback);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);
  onRollbackRef.current = onRollback;
  onErrorRef.current = onError;
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;

    const wsUrl = buildWsUrl(serverUrl, collection, id);
    let ws: WebSocket | null = null;

    async function connect() {
      // 1. Load WASM + create local doc
      let doc: CrdtDoc;
      try {
        doc = await createDoc();
      } catch (err) {
        if (cancelled) return;
        dispatch({ type: "error", error: err as Error });
        return;
      }
      if (cancelled) { doc.free(); return; }
      docRef.current = doc;

      // 2. Open WebSocket
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        // Server will send the snapshot as the first binary frame
      };

      ws.onmessage = async (event: MessageEvent) => {
        if (cancelled) return;
        const currentDoc = docRef.current;
        if (!currentDoc) return;

        if (!(event.data instanceof ArrayBuffer)) return;
        const bytes = new Uint8Array(event.data);

        // --- Rejection frame ---
        if (isRejectionFrame(bytes)) {
          const confirmed = confirmedBytesRef.current;
          if (!confirmed) return; // nothing to roll back to

          try {
            const rolledBack = await loadDoc(confirmed);
            if (cancelled) { rolledBack.free(); return; }

            const rejectedKeys = [...pendingKeysRef.current];
            pendingKeysRef.current.clear();

            currentDoc.free();
            docRef.current = rolledBack;
            dispatch({ type: "rollback", state: docToState(rolledBack) });
            if (rejectedKeys.length > 0) {
              onRollbackRef.current?.(rejectedKeys);
            }
          } catch (err) {
            onErrorRef.current?.(err as Error);
          }
          return;
        }

        if (bytes.length === 0) {
          // Empty frame = empty document ready signal
          confirmedBytesRef.current = bytes;
          dispatch({ type: "ready", state: docToState(currentDoc) });
          return;
        }

        // --- Normal data frame ---
        try {
          if (hookState.status === "loading") {
            // First frame: full snapshot
            const loaded = await loadDoc(bytes);
            if (cancelled) { loaded.free(); return; }

            currentDoc.free();
            docRef.current = loaded;
            confirmedBytesRef.current = bytes;
            pendingKeysRef.current.clear();
            dispatch({ type: "ready", state: docToState(loaded) });
          } else {
            // Subsequent frames: delta from server (confirmed broadcast)
            currentDoc.merge(bytes);
            // Save updated confirmed state
            confirmedBytesRef.current = currentDoc.save();
            pendingKeysRef.current.clear();
            dispatch({ type: "update", state: docToState(currentDoc) });
          }
        } catch (err) {
          onErrorRef.current?.(err as Error);
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        onErrorRef.current?.(new Error(`WebSocket error on ${wsUrl}`));
      };

      ws.onclose = (event: CloseEvent) => {
        if (cancelled) return;
        onCloseRef.current?.(event);
      };
    }

    connect();

    return () => {
      cancelled = true;
      ws?.close();
      wsRef.current = null;
      docRef.current?.free();
      docRef.current = null;
      confirmedBytesRef.current = null;
      pendingKeysRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, id, serverUrl]);

  // ---------------------------------------------------------------------------
  // update() — optimistic write + send to server
  // ---------------------------------------------------------------------------
  const update = useCallback(
    (key: string, value: string) => {
      const doc = docRef.current;
      const ws = wsRef.current;
      if (!doc) return;

      doc.set(key, value);
      pendingKeysRef.current.add(key);

      // Optimistically update React state
      dispatch({ type: "update", state: docToState(doc) });

      // Send to server for merge + broadcast
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(doc.save());
      }
    },
    []
  );

  const state =
    hookState.status === "ready" ? hookState.state : ({} as SyncState);

  return [state, update];
}
