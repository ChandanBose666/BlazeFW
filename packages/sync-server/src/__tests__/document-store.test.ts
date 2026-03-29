import { describe, it, expect, beforeEach } from "@jest/globals";
import * as Automerge from "@automerge/automerge";
import { DocumentStore } from "../document-store.js";

describe("DocumentStore", () => {
  let store: DocumentStore;

  beforeEach(() => {
    store = new DocumentStore();
  });

  // ---------------------------------------------------------------------------
  // Basic get / has / size
  // ---------------------------------------------------------------------------

  it("starts empty", () => {
    expect(store.size).toBe(0);
    expect(store.has("todos", "1")).toBe(false);
  });

  it("getBytes creates an empty doc on first access", () => {
    const bytes = store.getBytes("todos", "1");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(store.has("todos", "1")).toBe(true);
    expect(store.size).toBe(1);
  });

  it("treats collection+id as a compound key (no cross-contamination)", () => {
    store.getBytes("todos", "1");
    store.getBytes("todos", "2");
    store.getBytes("notes", "1");
    expect(store.size).toBe(3);
  });

  it("getBytes is stable — repeated calls return the same bytes", () => {
    const a = store.getBytes("todos", "1");
    const b = store.getBytes("todos", "1");
    expect(a).toEqual(b);
  });

  // ---------------------------------------------------------------------------
  // merge
  // ---------------------------------------------------------------------------

  it("merge integrates client changes into the stored doc", () => {
    // Initialise the store's doc
    store.getBytes("todos", "1");

    // Create a client doc with a change
    let clientDoc = Automerge.init<{ title?: string }>();
    clientDoc = Automerge.change(clientDoc, (d) => {
      d.title = "Buy milk";
    });
    const clientBytes = Automerge.save(clientDoc);

    const mergedBytes = store.merge("todos", "1", clientBytes);
    expect(mergedBytes).toBeInstanceOf(Uint8Array);

    // Load the merged result and confirm the change is present
    const merged = Automerge.load<{ title?: string }>(mergedBytes);
    expect(merged.title).toBe("Buy milk");
  });

  it("merge on a non-existent doc creates it first", () => {
    expect(store.has("items", "42")).toBe(false);

    let clientDoc = Automerge.init<{ x?: string }>();
    clientDoc = Automerge.change(clientDoc, (d) => {
      d.x = "hello";
    });

    const mergedBytes = store.merge("items", "42", clientDoc && Automerge.save(clientDoc));
    expect(store.has("items", "42")).toBe(true);

    const result = Automerge.load<{ x?: string }>(mergedBytes);
    expect(result.x).toBe("hello");
  });

  it("merge is idempotent — applying the same bytes twice is safe", () => {
    store.getBytes("todos", "1");

    let clientDoc = Automerge.init<{ count?: number }>();
    clientDoc = Automerge.change(clientDoc, (d) => {
      d.count = 5;
    });
    const bytes = Automerge.save(clientDoc);

    store.merge("todos", "1", bytes);
    const secondMerge = store.merge("todos", "1", bytes);

    const result = Automerge.load<{ count?: number }>(secondMerge);
    expect(result.count).toBe(5);
  });

  it("concurrent changes from two clients are both preserved after merge", () => {
    const initialBytes = store.getBytes("todos", "1");

    // Client A: sets title
    let docA = Automerge.load<{ title?: string; done?: boolean }>(initialBytes);
    docA = Automerge.change(docA, (d) => {
      d.title = "Task A";
    });

    // Client B: sets done (diverged from the same base)
    let docB = Automerge.load<{ title?: string; done?: boolean }>(initialBytes);
    docB = Automerge.change(docB, (d) => {
      d.done = true;
    });

    store.merge("todos", "1", Automerge.save(docA));
    const finalBytes = store.merge("todos", "1", Automerge.save(docB));

    const result = Automerge.load<{ title?: string; done?: boolean }>(finalBytes);
    expect(result.title).toBe("Task A");
    expect(result.done).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // delete / GC
  // ---------------------------------------------------------------------------

  it("delete removes the document from the store", () => {
    store.getBytes("todos", "1");
    expect(store.has("todos", "1")).toBe(true);

    store.delete("todos", "1");
    expect(store.has("todos", "1")).toBe(false);
    expect(store.size).toBe(0);
  });

  it("delete on a non-existent key is a no-op", () => {
    expect(() => store.delete("todos", "99")).not.toThrow();
  });

  it("after delete, getBytes creates a fresh empty doc", () => {
    // Write something
    let clientDoc = Automerge.init<{ msg?: string }>();
    clientDoc = Automerge.change(clientDoc, (d) => {
      d.msg = "old data";
    });
    store.merge("todos", "1", Automerge.save(clientDoc));

    // Evict
    store.delete("todos", "1");

    // Get should now return a fresh empty doc
    const freshBytes = store.getBytes("todos", "1");
    const fresh = Automerge.load<{ msg?: string }>(freshBytes);
    expect(fresh.msg).toBeUndefined();
  });
});
