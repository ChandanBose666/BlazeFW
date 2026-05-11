import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { initInspector } from '../inspector.js';
import { STYLE_ELEMENT_ID } from '../styles.js';
import { PANEL_ELEMENT_ID } from '../panel.js';
import { DATA_KIND } from '../scanner.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addComponent(kind: string, name?: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute(DATA_KIND, kind);
  if (name) el.setAttribute('data-blazefw-name', name);
  document.body.appendChild(el);
  return el;
}

function cleanup(): void {
  // Remove inspector artefacts and any test components
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.getElementById(PANEL_ELEMENT_ID)?.remove();
  document.body.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initInspector — startup', () => {
  afterEach(cleanup);

  it('injects a stylesheet when enabled (default)', () => {
    const inspector = initInspector();
    expect(document.getElementById(STYLE_ELEMENT_ID)).not.toBeNull();
    inspector.destroy();
  });

  it('creates the panel element when enabled', () => {
    const inspector = initInspector();
    expect(document.getElementById(PANEL_ELEMENT_ID)).not.toBeNull();
    inspector.destroy();
  });

  it('starts with enabled === true by default', () => {
    const inspector = initInspector();
    expect(inspector.enabled).toBe(true);
    inspector.destroy();
  });

  it('does NOT inject stylesheet when enabled: false', () => {
    const inspector = initInspector({ enabled: false });
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    inspector.destroy();
  });

  it('does NOT create panel when enabled: false', () => {
    const inspector = initInspector({ enabled: false });
    expect(document.getElementById(PANEL_ELEMENT_ID)).toBeNull();
    inspector.destroy();
  });
});

describe('initInspector — enable / disable', () => {
  afterEach(cleanup);

  it('enable() shows the overlay and panel', () => {
    const inspector = initInspector({ enabled: false });
    inspector.enable();
    expect(document.getElementById(STYLE_ELEMENT_ID)).not.toBeNull();
    expect(document.getElementById(PANEL_ELEMENT_ID)).not.toBeNull();
    expect(inspector.enabled).toBe(true);
    inspector.destroy();
  });

  it('disable() removes the overlay and panel', () => {
    const inspector = initInspector();
    inspector.disable();
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    expect(document.getElementById(PANEL_ELEMENT_ID)).toBeNull();
    expect(inspector.enabled).toBe(false);
  });

  it('enable() is a no-op when already enabled', () => {
    const inspector = initInspector();
    inspector.enable(); // second call
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
    inspector.destroy();
  });

  it('disable() is a no-op when already disabled', () => {
    const inspector = initInspector({ enabled: false });
    expect(() => inspector.disable()).not.toThrow();
    inspector.destroy();
  });
});

describe('initInspector — toggle', () => {
  afterEach(cleanup);

  it('toggle() disables an enabled inspector', () => {
    const inspector = initInspector();
    inspector.toggle();
    expect(inspector.enabled).toBe(false);
  });

  it('toggle() enables a disabled inspector', () => {
    const inspector = initInspector({ enabled: false });
    inspector.toggle();
    expect(inspector.enabled).toBe(true);
    inspector.destroy();
  });
});

describe('initInspector — refresh', () => {
  afterEach(cleanup);

  it('refresh() updates the panel to reflect current DOM state', () => {
    const inspector = initInspector();
    addComponent('server', 'UserCard');
    inspector.refresh();
    const panel = document.getElementById(PANEL_ELEMENT_ID)!;
    expect(panel.innerHTML).toContain('Server');
    inspector.destroy();
  });

  it('refresh() is a no-op when disabled', () => {
    const inspector = initInspector({ enabled: false });
    expect(() => {
      addComponent('client');
      inspector.refresh();
    }).not.toThrow();
  });
});

describe('initInspector — destroy', () => {
  afterEach(cleanup);

  it('destroy() removes stylesheet, panel, and sets enabled to false', () => {
    const inspector = initInspector();
    inspector.destroy();
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    expect(document.getElementById(PANEL_ELEMENT_ID)).toBeNull();
    expect(inspector.enabled).toBe(false);
  });

  it('destroy() is safe to call on a disabled inspector', () => {
    const inspector = initInspector({ enabled: false });
    expect(() => inspector.destroy()).not.toThrow();
  });
});

describe('initInspector — panel content', () => {
  afterEach(cleanup);

  it('panel shows correct kind counts after scan', () => {
    addComponent('server');
    addComponent('server');
    addComponent('client');
    const inspector = initInspector();
    const panel = document.getElementById(PANEL_ELEMENT_ID)!;
    // The panel should show "2" for server and "1" for client
    expect(panel.innerHTML).toContain('2');
    expect(panel.innerHTML).toContain('1');
    inspector.destroy();
  });

  it('panel shows "no annotated components" when DOM has none', () => {
    const inspector = initInspector();
    const panel = document.getElementById(PANEL_ELEMENT_ID)!;
    expect(panel.innerHTML.toLowerCase()).toContain('no annotated');
    inspector.destroy();
  });
});
