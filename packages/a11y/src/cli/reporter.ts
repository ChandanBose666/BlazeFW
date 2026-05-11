/**
 * Terminal reporter for the blazefw-a11y CLI.
 * All functions return strings (no direct console.log) to keep them testable.
 */
import type { AxeResults } from 'axe-core';
import { MANUAL_CHECKS, WCAG_CRITERIA, getCoverageStats } from './manual-checklist.js';
import type { ManualCheck } from './manual-checklist.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const RULE = '─'.repeat(54);
const THICK = '━'.repeat(54);

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

// ─── Violations section ──────────────────────────────────────────────────────

export function formatViolationsSection(violations: AxeResults['violations']): string {
  if (violations.length === 0) {
    return `✓  No automated violations detected.\n`;
  }

  const sorted = [...violations].sort(
    (a, b) => (IMPACT_ORDER[a.impact ?? ''] ?? 4) - (IMPACT_ORDER[b.impact ?? ''] ?? 4)
  );

  const lines: string[] = [`✗  VIOLATIONS (${violations.length})\n${RULE}`];
  sorted.forEach((v, i) => {
    const impact = (v.impact ?? 'unknown').toUpperCase();
    lines.push(`\n${i + 1}. [${impact}] ${v.id}`);
    lines.push(`   ${v.description}`);
    lines.push(`   Help: ${v.helpUrl}`);
    if (v.nodes.length > 0) {
      lines.push('   Affected:');
      v.nodes.slice(0, 3).forEach((n) => lines.push(`   - ${n.html}`));
      if (v.nodes.length > 3) lines.push(`   … and ${v.nodes.length - 3} more`);
    }
  });
  return lines.join('\n');
}

// ─── Manual checklist section ────────────────────────────────────────────────

export function formatManualChecklist(checks: ManualCheck[] = MANUAL_CHECKS): string {
  const lines: string[] = [
    `⚠  MANUAL VERIFICATION REQUIRED (${checks.length} checks)\n${RULE}`,
    'These criteria cannot be fully verified by automated tools.\n',
  ];
  checks.forEach((c) => {
    lines.push(`  □ ${c.criterionId}  ${c.title}`);
    lines.push(`    ${c.instructions}\n`);
  });
  return lines.join('\n');
}

// ─── Coverage report section ─────────────────────────────────────────────────

export function formatCoverageReport(): string {
  const { byStatus, byPrinciple, total } = getCoverageStats();

  const pad = (s: string | number, n: number) => String(s).padEnd(n);

  const header = `  ${'Principle'.padEnd(15)} ${'Full'.padEnd(6)} ${'Partial'.padEnd(8)} Manual`;
  const divider = `  ${'-'.repeat(40)}`;
  const principles = ['perceivable', 'operable', 'understandable', 'robust'] as const;

  const rows = principles.map((p) => {
    const s = byPrinciple[p];
    return `  ${pad(p.charAt(0).toUpperCase() + p.slice(1), 15)} ${pad(s.full, 6)} ${pad(s.partial, 8)} ${s.manual}`;
  });

  const totalRow = `  ${pad('TOTAL', 15)} ${pad(byStatus.full, 6)} ${pad(byStatus.partial, 8)} ${byStatus.manual}`;

  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  const summary = [
    `  Fully automated : ${byStatus.full} criteria (${pct(byStatus.full)})`,
    `  Partial coverage: ${byStatus.partial} criteria (${pct(byStatus.partial)})`,
    `  Manual required : ${byStatus.manual} criteria (${pct(byStatus.manual)})`,
    `  Total AA criteria checked: ${total}`,
  ];

  return [
    `COVERAGE REPORT — WCAG 2.1 AA (${total} success criteria)\n${RULE}`,
    header,
    divider,
    ...rows,
    divider,
    totalRow,
    '',
    ...summary,
  ].join('\n');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface AuditSummary {
  violations: number;
  passes: number;
  incomplete: number;
  filePath: string;
}

export function formatSummary(summary: AuditSummary): string {
  const status = summary.violations > 0 ? '✗  FAIL' : '✓  PASS';
  return [
    `SUMMARY  ${summary.filePath}`,
    RULE,
    `  Status     : ${status}`,
    `  Violations : ${summary.violations}`,
    `  Passes     : ${summary.passes}`,
    `  Incomplete : ${summary.incomplete}`,
    `  Manual checks: ${MANUAL_CHECKS.length} required`,
  ].join('\n');
}

// ─── Full report ─────────────────────────────────────────────────────────────

/** Combine all sections into a single printable report string. */
export function buildReport(results: AxeResults, filePath: string): string {
  const summary: AuditSummary = {
    violations: results.violations.length,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    filePath,
  };

  return [
    `\n${THICK}`,
    `  blazefw-a11y — WCAG 2.1 AA Audit`,
    `  ${filePath}`,
    THICK,
    '',
    formatViolationsSection(results.violations),
    '',
    formatManualChecklist(),
    '',
    formatCoverageReport(),
    '',
    THICK,
    formatSummary(summary),
    THICK,
    '',
  ].join('\n');
}

/** Exported for build-output summary — always call this at the end of a build. */
export function buildSummaryLine(violations: number): string {
  if (violations === 0) {
    return `blazefw-a11y: ✓ 0 violations — ${MANUAL_CHECKS.length} WCAG 2.1 AA manual checks required`;
  }
  return `blazefw-a11y: ✗ ${violations} violation(s) — review output above and complete ${MANUAL_CHECKS.length} manual checks`;
}

/** Narrow list of automated axe-core rule IDs used across all criteria. */
export function getAutomatedRuleIds(): string[] {
  return [...new Set(WCAG_CRITERIA.flatMap((c) => c.axeRules))].filter(Boolean);
}
