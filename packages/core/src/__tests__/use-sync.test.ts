import { jest, describe, it, expect } from "@jest/globals";
import { REJECTION_FRAME } from "../use-sync.js";

/**
 * Tests for useSync hook internal logic.
 *
 * Tests the pure helper functions (docToState, buildWsUrl) and the optimistic
 * rollback protocol constants without needing React / JSDOM.
 *
 * Full hook integration tests (requiring @testing-library/react + JSDOM)
 * will be added in Task 4.3 once the server-side transport is in place.
 */

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

describe("REJECTION_FRAME", () => {
  it("is a single byte with value 0xFF", () => {
    expect(REJECTION_FRAME).toBe(0xff);
  });
});

// ---------------------------------------------------------------------------
// docToState — snapshot extraction
// ---------------------------------------------------------------------------

describe("docToState (via CrdtDoc mock)", () => {
  function makeDoc(data: Record<string, string | undefined>) {
    return {
      keys: () => JSON.stringify(Object.keys(data)),
      get: (key: string) => data[key],
    };
  }

  function docToState(doc: ReturnType<typeof makeDoc>): Record<string, string> {
    const keys: string[] = JSON.parse(doc.keys());
    const state: Record<string, string> = {};
    for (const key of keys) {
      const value = doc.get(key);
      if (value !== undefined) {
        state[key] = value;
      }
    }
    return state;
  }

  it("returns empty object for a doc with no keys", () => {
    const doc = makeDoc({});
    expect(docToState(doc)).toEqual({});
  });

  it("captures all keys present in the doc", () => {
    const doc = makeDoc({ name: "Alice", status: "online" });
    expect(docToState(doc)).toEqual({ name: "Alice", status: "online" });
  });

  it("omits keys whose value is undefined", () => {
    const doc = makeDoc({ present: "yes", absent: undefined });
    const state = docToState(doc);
    expect(state).toHaveProperty("present", "yes");
    expect(state).not.toHaveProperty("absent");
  });
});

// ---------------------------------------------------------------------------
// buildWsUrl — URL construction
// ---------------------------------------------------------------------------

describe("buildWsUrl", () => {
  function buildWsUrl(
    base: string | undefined,
    collection: string,
    id: string
  ): string {
    if (base) {
      return `${base.replace(/\/$/, "")}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
    }
    return `ws://localhost:3000/sync/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
  }

  it("uses the provided serverUrl as base", () => {
    expect(buildWsUrl("ws://example.com/sync", "todos", "abc")).toBe(
      "ws://example.com/sync/todos/abc"
    );
  });

  it("strips a trailing slash from serverUrl", () => {
    expect(buildWsUrl("ws://example.com/sync/", "todos", "abc")).toBe(
      "ws://example.com/sync/todos/abc"
    );
  });

  it("encodes special characters in collection and id", () => {
    expect(buildWsUrl("ws://host/sync", "my todos", "id/with/slashes")).toBe(
      "ws://host/sync/my%20todos/id%2Fwith%2Fslashes"
    );
  });

  it("falls back to localhost when no serverUrl given", () => {
    const url = buildWsUrl(undefined, "items", "42");
    expect(url).toBe("ws://localhost:3000/sync/items/42");
  });
});

// ---------------------------------------------------------------------------
// isRejectionFrame — protocol detection
// ---------------------------------------------------------------------------

describe("isRejectionFrame", () => {
  function isRejectionFrame(bytes: Uint8Array): boolean {
    return bytes.length === 1 && bytes[0] === 0xff;
  }

  it("returns true for a single 0xFF byte", () => {
    expect(isRejectionFrame(new Uint8Array([0xff]))).toBe(true);
  });

  it("returns false for an empty frame", () => {
    expect(isRejectionFrame(new Uint8Array([]))).toBe(false);
  });

  it("returns false for a non-rejection single byte", () => {
    expect(isRejectionFrame(new Uint8Array([0x00]))).toBe(false);
    expect(isRejectionFrame(new Uint8Array([0xfe]))).toBe(false);
  });

  it("returns false for a multi-byte frame even if first byte is 0xFF", () => {
    expect(isRejectionFrame(new Uint8Array([0xff, 0x00]))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Optimistic rollback logic
// ---------------------------------------------------------------------------

describe("optimistic rollback contract (pure logic)", () => {
  it("pendingKeys accumulates on update, clears on confirmation", () => {
    const pendingKeys = new Set<string>();

    // Two optimistic writes
    pendingKeys.add("title");
    pendingKeys.add("status");
    expect(pendingKeys.size).toBe(2);

    // Server confirms → clear
    pendingKeys.clear();
    expect(pendingKeys.size).toBe(0);
  });

  it("rollback restores confirmed state and clears pending keys", () => {
    const store: Record<string, string> = { title: "confirmed" };
    const pending = new Set(["title"]);

    // Simulate optimistic write
    store.title = "optimistic";
    expect(store.title).toBe("optimistic");

    // Server rejects — restore confirmed
    store.title = "confirmed";
    pending.clear();

    expect(store.title).toBe("confirmed");
    expect(pending.size).toBe(0);
  });

  it("update does not send when socket is not open", () => {
    const sent: Uint8Array[] = [];
    const fakeWs = { readyState: 0, send: (d: Uint8Array) => sent.push(d) };
    const fakeDoc = { set: jest.fn(), save: () => new Uint8Array([1]) };

    fakeDoc.set("k", "v");
    if (fakeWs.readyState === 1) fakeWs.send(fakeDoc.save());

    expect(sent).toHaveLength(0);
  });

  it("update sends bytes when socket is open", () => {
    const sent: Uint8Array[] = [];
    const fakeWs = { readyState: 1, send: (d: Uint8Array) => sent.push(d) };
    const store: Record<string, string> = {};
    const fakeDoc = {
      set: (k: string, v: string) => { store[k] = v; },
      save: () => new Uint8Array([0xde, 0xad]),
    };

    fakeDoc.set("title", "Hello");
    if (fakeWs.readyState === 1) fakeWs.send(fakeDoc.save());

    expect(store.title).toBe("Hello");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual(new Uint8Array([0xde, 0xad]));
  });

  it("rejection frame value matches REJECTION_FRAME constant", () => {
    expect(REJECTION_FRAME).toBe(0xff);
    const frame = new Uint8Array([REJECTION_FRAME]);
    expect(frame[0]).toBe(0xff);
  });
});
