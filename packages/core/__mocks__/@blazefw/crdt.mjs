/**
 * Manual Jest mock for @blazefw/crdt
 *
 * This stub is used by Jest in Node test environments where the real WASM
 * binary cannot run. Individual test files override this with jest.mock()
 * factories when they need fine-grained control over CrdtDoc behaviour.
 *
 * This file has NO effect on runtime builds or browser execution.
 */

export const __esModule = true;

export default async function init() {}

export class CrdtDoc {
  static load(_data) {
    return new CrdtDoc();
  }
  get(_key) { return undefined; }
  get_json(_key) { return "null"; }
  set(_key, _value) {}
  set_number(_key, _value) {}
  set_bool(_key, _value) {}
  delete(_key) {}
  save() { return new Uint8Array(); }
  merge(_data) {}
  keys() { return "[]"; }
  free() {}
}
