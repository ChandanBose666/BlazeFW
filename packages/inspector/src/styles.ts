/**
 * styles.ts — CSS overlay for the BlazeFW Inspector
 *
 * Injects a <style> element that draws colored outlines and small kind-badges
 * on every element carrying a `data-blazefw-kind` attribute.
 *
 * Approach: pure CSS, no JS per-element positioning.
 *   - `outline` draws the colored border without affecting layout.
 *   - `::after` pseudo-element renders the kind label in the top-left corner.
 *     `position: relative` is added to the host element so the label is
 *     anchored to it (acceptable for a dev-only tool).
 */

export const STYLE_ELEMENT_ID = 'blazefw-inspector-styles';

/**
 * Generate the full CSS text for the inspector overlay.
 * Accepts a custom `dataAttr` so callers can use non-default attribute names.
 */
export function buildStylesheet(dataAttr: string): string {
  return [
    `/* BlazeFW Inspector Overlay — do not edit */`,
    `[${dataAttr}="server"]   { --_ul: #3b82f6; }`,
    `[${dataAttr}="client"]   { --_ul: #f97316; }`,
    `[${dataAttr}="shared"]   { --_ul: #22c55e; }`,
    `[${dataAttr}="boundary"] { --_ul: #a855f7; }`,
    `[${dataAttr}="mixed"]    { --_ul: #ef4444; }`,
    `[${dataAttr}] {`,
    `  outline: 2px solid var(--_ul, #888) !important;`,
    `  outline-offset: 1px;`,
    `  position: relative !important;`,
    `}`,
    `[${dataAttr}]::after {`,
    `  content: attr(${dataAttr});`,
    `  position: absolute;`,
    `  top: 0;`,
    `  left: 0;`,
    `  background: var(--_ul, #888);`,
    `  color: #fff;`,
    `  font: bold 10px/1 monospace;`,
    `  padding: 2px 5px;`,
    `  border-radius: 0 0 4px 0;`,
    `  pointer-events: none;`,
    `  z-index: 2147483647;`,
    `  white-space: nowrap;`,
    `}`,
  ].join('\n');
}

/**
 * Inject the inspector stylesheet into `doc.head`.
 * Removes any previously injected stylesheet first (idempotent).
 */
export function injectStylesheet(doc: Document, dataAttr: string): HTMLStyleElement {
  removeStylesheet(doc);
  const el = doc.createElement('style');
  el.id = STYLE_ELEMENT_ID;
  el.textContent = buildStylesheet(dataAttr);
  doc.head.appendChild(el);
  return el;
}

/** Remove the inspector stylesheet from the document, if present. */
export function removeStylesheet(doc: Document): void {
  doc.getElementById(STYLE_ELEMENT_ID)?.remove();
}
