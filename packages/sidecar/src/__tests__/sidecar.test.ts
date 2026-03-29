import { describe, it, expect } from '@jest/globals';
import { collectSidecarScripts, handleProxyRequest } from '../sidecar.js';
import { SIDECAR_SCRIPT_TYPE } from '../protocol.js';
import type { ScriptContainer } from '../sidecar.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ScriptContainer backed by plain objects — no jsdom needed. */
function makeContainer(
  scripts: Array<{ type: string; src: string }>
): ScriptContainer {
  return {
    querySelectorAll(selector: string) {
      // Parse the type value from selectors like: script[type="text/ultimatejs"]
      const match = selector.match(/\[type="([^"]+)"\]/);
      const wantedType = match?.[1] ?? '';
      return scripts
        .filter((s) => s.type === wantedType)
        .map((s) => ({ src: s.src }));
    },
  };
}

// ---------------------------------------------------------------------------
// collectSidecarScripts
// ---------------------------------------------------------------------------

describe('collectSidecarScripts', () => {
  it('returns the src of scripts matching the default type', () => {
    const container = makeContainer([
      { type: SIDECAR_SCRIPT_TYPE, src: 'https://cdn.example.com/gtm.js' },
      { type: SIDECAR_SCRIPT_TYPE, src: 'https://cdn.example.com/analytics.js' },
    ]);
    expect(collectSidecarScripts(container)).toEqual([
      'https://cdn.example.com/gtm.js',
      'https://cdn.example.com/analytics.js',
    ]);
  });

  it('ignores scripts with a different type attribute', () => {
    const container = makeContainer([
      { type: 'text/javascript', src: 'https://cdn.example.com/normal.js' },
      { type: SIDECAR_SCRIPT_TYPE, src: 'https://cdn.example.com/tracked.js' },
    ]);
    expect(collectSidecarScripts(container)).toEqual(['https://cdn.example.com/tracked.js']);
  });

  it('ignores inline scripts (empty src)', () => {
    const container = makeContainer([
      { type: SIDECAR_SCRIPT_TYPE, src: '' },
      { type: SIDECAR_SCRIPT_TYPE, src: 'https://cdn.example.com/real.js' },
    ]);
    expect(collectSidecarScripts(container)).toEqual(['https://cdn.example.com/real.js']);
  });

  it('returns an empty array when no scripts match', () => {
    const container = makeContainer([{ type: 'text/javascript', src: 'x.js' }]);
    expect(collectSidecarScripts(container)).toEqual([]);
  });

  it('respects a custom scriptType override', () => {
    const container = makeContainer([
      { type: 'text/partytown', src: 'https://cdn.example.com/gtag.js' },
    ]);
    expect(collectSidecarScripts(container, 'text/partytown')).toEqual([
      'https://cdn.example.com/gtag.js',
    ]);
  });
});

// ---------------------------------------------------------------------------
// handleProxyRequest — get
// ---------------------------------------------------------------------------

describe('handleProxyRequest — get', () => {
  it('reads a top-level property from the window object', () => {
    const win: Record<string, unknown> = { innerWidth: 1280 };
    expect(handleProxyRequest(win, { type: 'get', id: 1, path: ['innerWidth'] })).toBe(1280);
  });

  it('reads a nested property', () => {
    const win: Record<string, unknown> = {
      document: { title: 'My Page' },
    };
    expect(handleProxyRequest(win, { type: 'get', id: 2, path: ['document', 'title'] })).toBe(
      'My Page'
    );
  });

  it('returns undefined when the path does not exist', () => {
    const win: Record<string, unknown> = {};
    expect(handleProxyRequest(win, { type: 'get', id: 3, path: ['missing', 'key'] })).toBeUndefined();
  });

  it('returns undefined for an empty path', () => {
    const win: Record<string, unknown> = { x: 1 };
    expect(handleProxyRequest(win, { type: 'get', id: 4, path: [] })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleProxyRequest — set
// ---------------------------------------------------------------------------

describe('handleProxyRequest — set', () => {
  it('assigns a top-level property on the window object', () => {
    const win: Record<string, unknown> = {};
    handleProxyRequest(win, { type: 'set', id: 5, path: ['dataLayer'], value: [] });
    expect(win['dataLayer']).toEqual([]);
  });

  it('assigns a nested property', () => {
    const win: Record<string, unknown> = { document: {} as Record<string, unknown> };
    handleProxyRequest(win, { type: 'set', id: 6, path: ['document', 'title'], value: 'New Title' });
    expect((win['document'] as Record<string, unknown>)['title']).toBe('New Title');
  });
});

// ---------------------------------------------------------------------------
// handleProxyRequest — call
// ---------------------------------------------------------------------------

describe('handleProxyRequest — call', () => {
  it('invokes the function at the path', () => {
    const calls: unknown[][] = [];
    const win: Record<string, unknown> = {
      dataLayer: { push: (...args: unknown[]) => calls.push(args) },
    };
    handleProxyRequest(win, { type: 'call', id: 7, path: ['dataLayer', 'push'], args: [{ event: 'pageview' }] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([{ event: 'pageview' }]);
  });

  it('returns the function return value', () => {
    const win: Record<string, unknown> = {
      Math: { max: (...ns: unknown[]) => Math.max(...(ns as number[])) },
    };
    const result = handleProxyRequest(win, {
      type: 'call',
      id: 8,
      path: ['Math', 'max'],
      args: [3, 7, 2],
    });
    expect(result).toBe(7);
  });

  it('calls the function with the parent object as `this`', () => {
    let capturedThis: unknown;
    const obj = {
      fn() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        capturedThis = this;
      },
    };
    const win: Record<string, unknown> = { obj };
    handleProxyRequest(win, { type: 'call', id: 9, path: ['obj', 'fn'], args: [] });
    expect(capturedThis).toBe(obj);
  });

  it('returns undefined when the path resolves to a non-function', () => {
    const win: Record<string, unknown> = { x: 42 };
    expect(handleProxyRequest(win, { type: 'call', id: 10, path: ['x'], args: [] })).toBeUndefined();
  });
});
