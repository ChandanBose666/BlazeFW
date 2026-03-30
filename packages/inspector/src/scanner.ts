/**
 * scanner.ts — scans the DOM for annotated components
 *
 * Components are identified by a data attribute set by either:
 *   - @blazefw/web renderer  (data-ultimate-kind="server|client|…")
 *   - @blazefw/vite-plugin   (injected at compile time)
 *
 * Accepting a `ParentNode` interface instead of `document` makes every
 * function in this module fully testable without jsdom.
 */

import { ALL_KINDS, emptyStats, type ComponentInfo, type ComponentKind, type InspectorStats } from './types.js';

export const DATA_KIND = 'data-ultimate-kind';
export const DATA_NAME = 'data-ultimate-name';

/** Minimal interface needed for scanning — satisfied by Document, Element, or a test mock. */
export interface Scannable {
  querySelectorAll(selector: string): ArrayLike<Element>;
}

/**
 * Return all elements in `root` that carry a valid `data-ultimate-kind`
 * attribute, in DOM order.
 */
export function scanComponents(
  root: Scannable,
  dataAttr = DATA_KIND,
  nameAttr = DATA_NAME
): ComponentInfo[] {
  const nodes = root.querySelectorAll(`[${dataAttr}]`);
  const results: ComponentInfo[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const raw = el.getAttribute(dataAttr);
    if (!isValidKind(raw)) continue;
    results.push({
      kind: raw,
      name: el.getAttribute(nameAttr),
      element: el,
    });
  }
  return results;
}

/** Aggregate a list of ComponentInfo objects into per-kind counts. */
export function countByKind(infos: ComponentInfo[]): InspectorStats {
  const stats = emptyStats();
  for (const info of infos) {
    stats[info.kind]++;
    stats.total++;
  }
  return stats;
}

function isValidKind(value: string | null): value is ComponentKind {
  return value !== null && (ALL_KINDS as readonly string[]).includes(value);
}
