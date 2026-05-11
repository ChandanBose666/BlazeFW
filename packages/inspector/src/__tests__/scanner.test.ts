import { describe, it, expect } from '@jest/globals';
import { scanComponents, countByKind, DATA_KIND, DATA_NAME } from '../scanner.js';
import type { Scannable } from '../scanner.js';

// ---------------------------------------------------------------------------
// Minimal DOM mock — no jsdom required
// ---------------------------------------------------------------------------

interface MockElement {
  attrs: Record<string, string>;
  getAttribute(name: string): string | null;
}

function el(attrs: Record<string, string>): MockElement {
  return {
    attrs,
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
  };
}

function makeContainer(elements: MockElement[]): Scannable {
  return {
    querySelectorAll(selector: string) {
      // Extract attribute name from selector: [data-blazefw-kind]
      const match = selector.match(/\[([^\]]+)\]/);
      const attr = match?.[1] ?? '';
      return elements.filter((e) => e.getAttribute(attr) !== null) as unknown as ArrayLike<Element>;
    },
  };
}

// ---------------------------------------------------------------------------
// scanComponents
// ---------------------------------------------------------------------------

describe('scanComponents', () => {
  it('returns ComponentInfo for each valid kind attribute', () => {
    const root = makeContainer([
      el({ [DATA_KIND]: 'server', [DATA_NAME]: 'UserCard' }),
      el({ [DATA_KIND]: 'client', [DATA_NAME]: 'Button' }),
    ]);
    const results = scanComponents(root);
    expect(results).toHaveLength(2);
    expect(results[0].kind).toBe('server');
    expect(results[0].name).toBe('UserCard');
    expect(results[1].kind).toBe('client');
    expect(results[1].name).toBe('Button');
  });

  it('skips elements with an unrecognised kind value', () => {
    const root = makeContainer([
      el({ [DATA_KIND]: 'unknown-kind' }),
      el({ [DATA_KIND]: 'server' }),
    ]);
    expect(scanComponents(root)).toHaveLength(1);
  });

  it('sets name to null when data-blazefw-name is absent', () => {
    const root = makeContainer([el({ [DATA_KIND]: 'shared' })]);
    const [info] = scanComponents(root);
    expect(info.name).toBeNull();
  });

  it('returns an empty array when no matching elements exist', () => {
    const root = makeContainer([el({ class: 'foo' })]);
    expect(scanComponents(root)).toHaveLength(0);
  });

  it('handles all five valid kinds', () => {
    const root = makeContainer([
      el({ [DATA_KIND]: 'server' }),
      el({ [DATA_KIND]: 'client' }),
      el({ [DATA_KIND]: 'shared' }),
      el({ [DATA_KIND]: 'boundary' }),
      el({ [DATA_KIND]: 'mixed' }),
    ]);
    const results = scanComponents(root);
    expect(results.map((r) => r.kind)).toEqual(['server', 'client', 'shared', 'boundary', 'mixed']);
  });

  it('respects a custom dataAttr argument', () => {
    const root = makeContainer([el({ 'data-custom': 'client' })]);
    const results = scanComponents(root, 'data-custom');
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('client');
  });
});

// ---------------------------------------------------------------------------
// countByKind
// ---------------------------------------------------------------------------

describe('countByKind', () => {
  it('counts each kind correctly', () => {
    const root = makeContainer([
      el({ [DATA_KIND]: 'server' }),
      el({ [DATA_KIND]: 'server' }),
      el({ [DATA_KIND]: 'client' }),
      el({ [DATA_KIND]: 'boundary' }),
    ]);
    const stats = countByKind(scanComponents(root));
    expect(stats.server).toBe(2);
    expect(stats.client).toBe(1);
    expect(stats.boundary).toBe(1);
    expect(stats.shared).toBe(0);
    expect(stats.mixed).toBe(0);
  });

  it('sets total to the sum of all counts', () => {
    const root = makeContainer([
      el({ [DATA_KIND]: 'server' }),
      el({ [DATA_KIND]: 'client' }),
      el({ [DATA_KIND]: 'shared' }),
    ]);
    expect(countByKind(scanComponents(root)).total).toBe(3);
  });

  it('returns all-zero stats for an empty list', () => {
    const stats = countByKind([]);
    expect(stats.total).toBe(0);
    expect(stats.server).toBe(0);
  });
});
