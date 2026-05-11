/**
 * blazefw-a11y CLI — WCAG 2.1 AA audit for HTML files.
 *
 * Usage:
 *   blazefw-a11y <html-file> [options]
 *
 * Options:
 *   --output text|json   Output format (default: text)
 *   --exit-zero          Always exit 0 (non-blocking CI mode)
 *   --tags <tags>        Comma-separated axe tags (default: wcag2a,wcag2aa,wcag21a,wcag21aa)
 *   -h, --help           Show this help message
 */
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { auditHtmlFile } from './audit.js';
import { buildReport, buildSummaryLine } from './reporter.js';

// ─── Help ────────────────────────────────────────────────────────────────────

const HELP = `
blazefw-a11y — WCAG 2.1 AA accessibility auditor

Usage:
  blazefw-a11y <html-file> [options]

Options:
  --output text|json   Output format (default: text)
  --exit-zero          Always exit with code 0 (for non-blocking CI)
  --tags <t1,t2,...>   Axe-core tag filter (default: wcag2a,wcag2aa,wcag21a,wcag21aa)
  -h, --help           Print this help message

Examples:
  blazefw-a11y dist/index.html
  blazefw-a11y dist/index.html --output json
  blazefw-a11y dist/index.html --exit-zero
`.trim();

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output:     { type: 'string',  default: 'text' },
      'exit-zero':{ type: 'boolean', default: false },
      tags:       { type: 'string',  default: 'wcag2a,wcag2aa,wcag21a,wcag21aa' },
      help:       { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const filePath = positionals[0];

  if (!filePath) {
    console.error('Error: provide an HTML file path.\n\nRun `blazefw-a11y --help` for usage.');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`Error: file not found: ${filePath}`);
    process.exit(1);
  }

  const tags = String(values.tags).split(',').map((t) => t.trim());

  let results;
  try {
    results = await auditHtmlFile(filePath, { tags });
  } catch (err) {
    console.error(`Audit failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (values.output === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(buildReport(results, filePath));
  }

  // Always print the one-line summary so it appears in build logs
  console.log(buildSummaryLine(results.violations.length));

  const exitCode = values['exit-zero'] || results.violations.length === 0 ? 0 : 1;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
