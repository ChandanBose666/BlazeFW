/**
 * DocumentStore — in-memory persistence for CRDT documents.
 *
 * Holds one Automerge document per (collection, id) pair.
 * The stored value is always the *merged* binary representation —
 * new clients receive it as their initial snapshot, and each incoming
 * client delta is merged in before being broadcast to peers.
 *
 * Thread safety: Node.js is single-threaded, so no locking is required.
 * Persistence to disk / database is a future concern (Task 4.3 scope is
 * in-memory only; durability can be layered on top via the save/load API).
 */

import * as Automerge from "@automerge/automerge";

export class DocumentStore {
  /** Map key: "<collection>/<id>" → live Automerge document */
  private docs = new Map<string, Automerge.Doc<Record<string, unknown>>>();

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  /**
   * Return the serialised bytes for the document at (collection, id).
   * Creates an empty document if none exists yet.
   */
  getBytes(collection: string, id: string): Uint8Array {
    const key = this.key(collection, id);
    if (!this.docs.has(key)) {
      this.docs.set(key, Automerge.init());
    }
    return Automerge.save(this.docs.get(key)!);
  }

  /**
   * Merge incoming bytes (from a client) into the stored document.
   *
   * Returns the updated serialised bytes so the caller can broadcast
   * them to all other connected peers.
   *
   * Throws if the bytes are not a valid Automerge document.
   */
  merge(collection: string, id: string, incomingBytes: Uint8Array): Uint8Array {
    const key = this.key(collection, id);

    // Ensure we have a base document
    if (!this.docs.has(key)) {
      this.docs.set(key, Automerge.init());
    }

    const remote = Automerge.load<Record<string, unknown>>(incomingBytes);
    const merged = Automerge.merge(this.docs.get(key)!, remote);
    this.docs.set(key, merged);

    return Automerge.save(merged);
  }

  /**
   * Remove the document from the store.
   * Called when all clients for a document have disconnected (optional GC).
   */
  delete(collection: string, id: string): void {
    this.docs.delete(this.key(collection, id));
  }

  /** Total number of documents currently held in memory. */
  get size(): number {
    return this.docs.size;
  }

  /** Check whether a document exists for the given (collection, id). */
  has(collection: string, id: string): boolean {
    return this.docs.has(this.key(collection, id));
  }
}
