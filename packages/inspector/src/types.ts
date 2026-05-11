/**
 * types.ts — shared types for the BlazeFW Inspector
 */

/** The four classification kinds produced by the Rust compiler, plus 'mixed' for errors. */
export type ComponentKind = 'server' | 'client' | 'shared' | 'boundary' | 'mixed';

/** All valid ComponentKind values — used for validation and iteration. */
export const ALL_KINDS: readonly ComponentKind[] = Object.freeze([
  'server',
  'client',
  'shared',
  'boundary',
  'mixed',
] as const);

/** Color associated with each kind — used for outlines and legend badges. */
export const KIND_COLORS: Readonly<Record<ComponentKind, string>> = {
  server:   '#3b82f6', // blue   — pure server execution
  client:   '#f97316', // orange — browser-only
  shared:   '#22c55e', // green  — safe on both sides
  boundary: '#a855f7', // purple — server fn called from client (RPC stub)
  mixed:    '#ef4444', // red    — error: uses both server and client triggers
};

/** Human-readable label for each kind — shown in the inspector panel. */
export const KIND_LABELS: Readonly<Record<ComponentKind, string>> = {
  server:   'Server',
  client:   'Client',
  shared:   'Shared',
  boundary: 'Boundary',
  mixed:    'Mixed ⚠',
};

/** A single annotated component found in the DOM. */
export interface ComponentInfo {
  kind: ComponentKind;
  /** Value of `data-blazefw-name`, or null when absent. */
  name: string | null;
  element: Element;
}

/** Counts of each kind plus a total — used by the panel display. */
export interface InspectorStats {
  server:   number;
  client:   number;
  shared:   number;
  boundary: number;
  mixed:    number;
  total:    number;
}

/** Return a zeroed InspectorStats object. */
export function emptyStats(): InspectorStats {
  return { server: 0, client: 0, shared: 0, boundary: 0, mixed: 0, total: 0 };
}
