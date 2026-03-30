/**
 * @blazefw/a11y/test
 *
 * axe-core helpers for jest + jsdom test environments.
 * Import from '@blazefw/a11y/test'.
 *
 * Requires: axe-core, @testing-library/react (for renderWithA11y)
 */
import axe from 'axe-core';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface A11yNode {
  html: string;
  failureSummary: string | undefined;
}

export interface A11yViolation {
  id: string;
  impact: string | undefined;
  description: string;
  helpUrl: string;
  nodes: A11yNode[];
}

export interface A11yAuditResult {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toViolation(result: axe.Result): A11yViolation {
  return {
    id: result.id,
    impact: result.impact ?? undefined,
    description: result.description,
    helpUrl: result.helpUrl,
    nodes: result.nodes.map((n) => ({
      html: n.html,
      failureSummary: n.failureSummary ?? undefined,
    })),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run axe-core on any DOM element or document.
 * Works in any jest + jsdom environment — no browser required.
 *
 * @example
 * const result = await runA11yAudit(container);
 * expect(result.violations).toHaveLength(0);
 */
export async function runA11yAudit(
  container: Element | Document,
  options: axe.RunOptions = {}
): Promise<A11yAuditResult> {
  const results = await axe.run(container, options);
  return {
    violations: results.violations.map(toViolation),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}

/**
 * Assert that a container has zero axe-core violations.
 * Throws a descriptive error listing every violation on failure.
 *
 * @example
 * const { container } = render(<MyComponent />);
 * await expectNoViolations(container);
 */
export async function expectNoViolations(
  container: Element | Document,
  options: axe.RunOptions = {}
): Promise<void> {
  const { violations } = await runA11yAudit(container, options);
  if (violations.length > 0) {
    throw new Error(
      `${violations.length} accessibility violation(s) detected:\n\n${formatViolations(violations)}`
    );
  }
}

/**
 * Render a React element with @testing-library/react and run axe-core on it.
 *
 * @example
 * const { violations } = await renderWithA11y(<MyButton label="Save" />);
 * expect(violations).toHaveLength(0);
 */
export async function renderWithA11y(ui: ReactElement): Promise<{
  container: HTMLElement;
  violations: A11yViolation[];
}> {
  const { container } = render(ui);
  const { violations } = await runA11yAudit(container);
  return { container, violations };
}

/**
 * Format an array of violations into a human-readable, numbered list.
 * Returns "No violations found." for an empty array.
 */
export function formatViolations(violations: A11yViolation[]): string {
  if (violations.length === 0) return 'No violations found.';

  return violations
    .map((v, i) => {
      const impact = (v.impact ?? 'unknown').toUpperCase();
      const lines = [
        `${i + 1}. [${impact}] ${v.id}`,
        `   ${v.description}`,
        `   Help: ${v.helpUrl}`,
      ];
      if (v.nodes.length > 0) {
        lines.push('   Affected nodes:');
        v.nodes.forEach((n) => lines.push(`   - ${n.html}`));
      }
      return lines.join('\n');
    })
    .join('\n\n');
}
