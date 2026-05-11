/**
 * JSDOM + axe-core HTML auditor for the blazefw-a11y CLI.
 * Runs in Node.js without a browser by injecting axe-core into a JSDOM window.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import type { AxeResults } from 'axe-core';

const require = createRequire(import.meta.url);

/** Lazily resolved path to the axe-core browser bundle. */
function getAxeSource(): string {
  const axePath = require.resolve('axe-core');
  return readFileSync(axePath, 'utf8');
}

export interface AuditOptions {
  /** WCAG tags to run. Defaults to wcag2a, wcag2aa, wcag21a, wcag21aa. */
  tags?: string[];
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Audit an HTML string with axe-core inside a JSDOM sandbox.
 * No browser required — suitable for CI/build pipelines.
 */
export async function auditHtml(
  html: string,
  options: AuditOptions = {}
): Promise<AxeResults> {
  const axeSource = getAxeSource();
  const tags = options.tags ?? DEFAULT_TAGS;

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost',
  });

  // Inject axe-core into the jsdom window so it registers as window.axe
  dom.window.eval(axeSource);

  return new Promise<AxeResults>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dom.window as any).axe.run(
      dom.window.document,
      { runOnly: { type: 'tag', values: tags } },
      (err: Error | null, results: AxeResults) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
}

/**
 * Read an HTML file from disk and audit it.
 */
export async function auditHtmlFile(
  filePath: string,
  options: AuditOptions = {}
): Promise<AxeResults> {
  const html = readFileSync(filePath, 'utf8');
  return auditHtml(html, options);
}
