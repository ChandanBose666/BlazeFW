/**
 * Tests for crdt-loader.ts
 *
 * @blazefw/crdt is mapped to the manual stub in jest.config.js — WASM cannot
 * run in Node. These tests verify the *behaviour* of the loader wrapper:
 *   1. loadCrdtModule() returns a module with CrdtDoc
 *   2. Repeated / concurrent calls return the same module instance (singleton)
 *   3. createDoc() returns a usable CrdtDoc
 *   4. loadDoc() delegates to CrdtDoc.load
 */

import { jest, beforeEach, describe, it, expect } from "@jest/globals";

// Clear the loader's module-level cache between tests by resetting the module.
// ESM module isolation: each dynamic import after resetModules gets a fresh instance.
beforeEach(() => {
  jest.resetModules();
});

// ---------------------------------------------------------------------------

describe("loadCrdtModule", () => {
  it("returns an object with CrdtDoc", async () => {
    const { loadCrdtModule } = await import("../crdt-loader.js");
    const mod = await loadCrdtModule();
    expect(mod).toBeDefined();
    expect(typeof mod.CrdtDoc).toBe("function");
  });

  it("returns the same module instance on repeated calls (singleton)", async () => {
    const { loadCrdtModule } = await import("../crdt-loader.js");
    const a = await loadCrdtModule();
    const b = await loadCrdtModule();
    expect(a).toBe(b);
  });

  it("concurrent calls all resolve to the same module instance", async () => {
    const { loadCrdtModule } = await import("../crdt-loader.js");
    const [a, b, c] = await Promise.all([
      loadCrdtModule(),
      loadCrdtModule(),
      loadCrdtModule(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("createDoc", () => {
  it("returns a CrdtDoc instance with the expected API surface", async () => {
    const { createDoc } = await import("../crdt-loader.js");
    const doc = await createDoc();
    expect(typeof doc.set).toBe("function");
    expect(typeof doc.get).toBe("function");
    expect(typeof doc.save).toBe("function");
    expect(typeof doc.merge).toBe("function");
    expect(typeof doc.keys).toBe("function");
    expect(typeof doc.free).toBe("function");
  });

  it("new docs start with no keys", async () => {
    const { createDoc } = await import("../crdt-loader.js");
    const doc = await createDoc();
    expect(doc.keys()).toBe("[]");
  });
});

describe("loadDoc", () => {
  it("returns a CrdtDoc instance for valid bytes", async () => {
    const { loadDoc } = await import("../crdt-loader.js");
    const bytes = new Uint8Array([1, 2, 3]);
    const doc = await loadDoc(bytes);
    expect(typeof doc.get).toBe("function");
    expect(typeof doc.merge).toBe("function");
  });
});
