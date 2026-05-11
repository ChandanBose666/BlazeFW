import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  buildStatsRows,
  buildPanelContent,
  createPanel,
  updatePanel,
  removePanel,
  PANEL_ELEMENT_ID,
} from '../panel.js';
import { emptyStats, KIND_LABELS } from '../types.js';

// ---------------------------------------------------------------------------
// buildStatsRows — pure function
// ---------------------------------------------------------------------------

describe('buildStatsRows', () => {
  it('returns an empty string when all counts are zero', () => {
    expect(buildStatsRows(emptyStats())).toBe('');
  });

  it('includes a row for each kind with a count > 0', () => {
    const stats = { ...emptyStats(), server: 3, client: 1 };
    const html = buildStatsRows(stats);
    expect(html).toContain(KIND_LABELS.server);
    expect(html).toContain('3');
    expect(html).toContain(KIND_LABELS.client);
    expect(html).toContain('1');
  });

  it('does not include rows for kinds with zero count', () => {
    const stats = { ...emptyStats(), server: 2 };
    const html = buildStatsRows(stats);
    expect(html).not.toContain(KIND_LABELS.client);
    expect(html).not.toContain(KIND_LABELS.shared);
  });

  it('renders a colour swatch for each present kind', () => {
    const stats = { ...emptyStats(), boundary: 1 };
    const html = buildStatsRows(stats);
    // Boundary colour is #a855f7
    expect(html).toContain('#a855f7');
  });
});

// ---------------------------------------------------------------------------
// buildPanelContent — pure function
// ---------------------------------------------------------------------------

describe('buildPanelContent', () => {
  it('shows "no components" message when total is 0', () => {
    const html = buildPanelContent(emptyStats());
    expect(html.toLowerCase()).toContain('no annotated components');
  });

  it('shows the total count in the footer', () => {
    const stats = { ...emptyStats(), server: 2, client: 1, total: 3 };
    expect(buildPanelContent(stats)).toContain('3 component');
  });

  it('uses singular "component" when total is 1', () => {
    const stats = { ...emptyStats(), shared: 1, total: 1 };
    const html = buildPanelContent(stats);
    expect(html).toContain('1 component ');
    expect(html).not.toContain('1 components');
  });

  it('includes the inspector title', () => {
    expect(buildPanelContent(emptyStats())).toContain('BlazeFW Inspector');
  });
});

// ---------------------------------------------------------------------------
// createPanel / updatePanel / removePanel — DOM tests (jsdom)
// ---------------------------------------------------------------------------

describe('createPanel', () => {
  beforeEach(() => {
    document.getElementById(PANEL_ELEMENT_ID)?.remove();
  });

  it('appends the panel div to document.body', () => {
    createPanel(document);
    expect(document.getElementById(PANEL_ELEMENT_ID)).not.toBeNull();
  });

  it('returns the same element when called twice (idempotent)', () => {
    const a = createPanel(document);
    const b = createPanel(document);
    expect(a).toBe(b);
  });

  it('sets the correct element id', () => {
    const panel = createPanel(document);
    expect(panel.id).toBe(PANEL_ELEMENT_ID);
  });
});

describe('updatePanel', () => {
  beforeEach(() => {
    document.getElementById(PANEL_ELEMENT_ID)?.remove();
  });

  it('sets innerHTML to buildPanelContent output', () => {
    const panel = createPanel(document);
    const stats = { ...emptyStats(), client: 4, total: 4 };
    updatePanel(panel, stats);
    expect(panel.innerHTML).toContain('4');
    expect(panel.innerHTML).toContain(KIND_LABELS.client);
  });
});

describe('removePanel', () => {
  it('removes the panel element when present', () => {
    createPanel(document);
    removePanel(document);
    expect(document.getElementById(PANEL_ELEMENT_ID)).toBeNull();
  });

  it('does not throw when panel is not present', () => {
    expect(() => removePanel(document)).not.toThrow();
  });
});
