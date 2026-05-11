/**
 * panel.ts — floating inspector panel
 *
 * A fixed-position panel rendered in the bottom-right corner of the viewport.
 * Shows a colour-coded legend and per-kind component counts.
 *
 * Inline styles are used throughout so the panel is self-contained and
 * immune to the host page's CSS (e.g. CSS resets, Tailwind preflight).
 */

import { KIND_COLORS, KIND_LABELS, ALL_KINDS, type InspectorStats } from './types.js';

export const PANEL_ELEMENT_ID = 'blazefw-inspector-panel';

// ---------------------------------------------------------------------------
// Pure HTML builders (testable without a DOM)
// ---------------------------------------------------------------------------

/**
 * Build the inner HTML rows for the stats section of the panel.
 * Only shows kinds with a count > 0. Returns an empty string when nothing found.
 */
export function buildStatsRows(stats: InspectorStats): string {
  const rows = ALL_KINDS
    .filter((k) => stats[k] > 0)
    .map(
      (k) =>
        `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">` +
        `<span style="width:10px;height:10px;border-radius:2px;background:${KIND_COLORS[k]};flex-shrink:0"></span>` +
        `<span style="flex:1;color:#cdd6f4">${KIND_LABELS[k]}</span>` +
        `<span style="font-weight:bold;color:#fff">${stats[k]}</span>` +
        `</div>`
    );
  return rows.join('');
}

/** Build the complete innerHTML string for the panel element. */
export function buildPanelContent(stats: InspectorStats): string {
  const rows = buildStatsRows(stats);
  const body = rows
    ? rows
    : `<div style="opacity:.5;color:#cdd6f4">No annotated components found.<br>Add <code>data-blazefw-kind</code> attributes.</div>`;
  return (
    `<div style="font-weight:bold;margin-bottom:8px;color:#89b4fa;font-size:13px">` +
    `⚡ BlazeFW Inspector</div>` +
    body +
    `<div style="margin-top:8px;border-top:1px solid #45475a;padding-top:6px;` +
    `opacity:.6;font-size:10px;color:#cdd6f4">` +
    `${stats.total} component${stats.total !== 1 ? 's' : ''} annotated` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// DOM operations
// ---------------------------------------------------------------------------

/**
 * Create (or return the existing) inspector panel element and append it to
 * `doc.body`. Idempotent — safe to call multiple times.
 */
export function createPanel(doc: Document): HTMLElement {
  const existing = doc.getElementById(PANEL_ELEMENT_ID);
  if (existing) return existing;

  const panel = doc.createElement('div');
  panel.id = PANEL_ELEMENT_ID;
  panel.setAttribute(
    'style',
    [
      'position:fixed',
      'bottom:16px',
      'right:16px',
      'z-index:2147483646',
      'background:#1e1e2e',
      'border:1px solid #45475a',
      'border-radius:8px',
      'padding:12px 16px',
      'font:12px/1.6 monospace',
      'min-width:180px',
      'max-width:260px',
      'box-shadow:0 4px 24px rgba(0,0,0,.6)',
      'user-select:none',
    ].join(';')
  );

  doc.body.appendChild(panel);
  return panel;
}

/** Re-render the panel's contents with the latest stats. */
export function updatePanel(panel: HTMLElement, stats: InspectorStats): void {
  panel.innerHTML = buildPanelContent(stats);
}

/** Remove the inspector panel from the document, if present. */
export function removePanel(doc: Document): void {
  doc.getElementById(PANEL_ELEMENT_ID)?.remove();
}
