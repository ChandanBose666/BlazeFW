/**
 * inspector.ts — main entry point for the UltimateJs Inspector
 *
 * Usage (dev mode only):
 *
 *   import { initInspector } from '@blazefw/inspector';
 *   const inspector = initInspector();
 *
 *   // Toggle with keyboard shortcut
 *   document.addEventListener('keydown', (e) => {
 *     if (e.altKey && e.key === 'i') inspector.toggle();
 *   });
 *
 *   // Clean up on HMR dispose
 *   if (import.meta.hot) {
 *     import.meta.hot.dispose(() => inspector.destroy());
 *   }
 */

import { scanComponents, countByKind, DATA_KIND } from './scanner.js';
import { injectStylesheet, removeStylesheet } from './styles.js';
import { createPanel, updatePanel, removePanel } from './panel.js';

export interface InspectorOptions {
  /**
   * The data attribute used to identify annotated components.
   * Default: `"data-ultimate-kind"`
   */
  dataAttribute?: string;
  /**
   * Whether the inspector starts enabled.
   * Default: `true`
   */
  enabled?: boolean;
}

export interface InspectorHandle {
  /** Whether the overlay is currently visible. */
  readonly enabled: boolean;
  /** Show the overlay and panel. No-op when already enabled. */
  enable(): void;
  /** Hide the overlay and panel. No-op when already disabled. */
  disable(): void;
  /** Toggle between enabled and disabled. */
  toggle(): void;
  /** Re-scan the DOM and update the panel — useful after manual DOM changes. */
  refresh(): void;
  /** Fully remove the inspector (overlay + panel + observer). */
  destroy(): void;
}

/**
 * Initialise the inspector on the current page.
 *
 * 1. Injects a `<style>` element that draws colored outlines + kind badges.
 * 2. Creates a floating panel in the bottom-right corner.
 * 3. Scans the DOM for `[data-ultimate-kind]` elements and fills the panel.
 * 4. Installs a MutationObserver to refresh the panel when the DOM changes.
 */
export function initInspector(opts?: InspectorOptions): InspectorHandle {
  const dataAttr = opts?.dataAttribute ?? DATA_KIND;
  let active = opts?.enabled ?? true;
  let observer: MutationObserver | null = null;

  // ---------------------------------------------------------------------------
  // Core operations
  // ---------------------------------------------------------------------------

  function doRefresh(): void {
    const panel = document.getElementById('ultimatejs-inspector-panel') as HTMLElement | null;
    if (!panel) return;
    const infos = scanComponents(document.body, dataAttr);
    updatePanel(panel, countByKind(infos));
  }

  function startObserver(): void {
    if (observer) return;
    observer = new MutationObserver(doRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [dataAttr],
    });
  }

  function stopObserver(): void {
    observer?.disconnect();
    observer = null;
  }

  // ---------------------------------------------------------------------------
  // Public handle methods
  // ---------------------------------------------------------------------------

  function enable(): void {
    if (active) return;
    active = true;
    injectStylesheet(document, dataAttr);
    const panel = createPanel(document);
    const infos = scanComponents(document.body, dataAttr);
    updatePanel(panel, countByKind(infos));
    startObserver();
  }

  function disable(): void {
    if (!active) return;
    active = false;
    stopObserver();
    removeStylesheet(document);
    removePanel(document);
  }

  function toggle(): void {
    active ? disable() : enable();
  }

  function refresh(): void {
    if (!active) return;
    doRefresh();
  }

  function destroy(): void {
    stopObserver();
    if (active) {
      removeStylesheet(document);
      removePanel(document);
      active = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Initialise
  // ---------------------------------------------------------------------------

  if (active) {
    injectStylesheet(document, dataAttr);
    const panel = createPanel(document);
    const infos = scanComponents(document.body, dataAttr);
    updatePanel(panel, countByKind(infos));
    startObserver();
  }

  return {
    get enabled() { return active; },
    enable,
    disable,
    toggle,
    refresh,
    destroy,
  };
}
