import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FeatureId } from './features.js';
import { FEATURE_TEMPLATES } from './features.js';
import {
  packageJson,
  viteConfig,
  tsConfig,
  indexHtml,
  mainTsx,
  appComponent,
} from './templates/base.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScaffoldOptions {
  destDir: string;
  projectName: string;
  renderer: 'web' | 'native' | 'email';
  features: FeatureId[];
}

interface ScaffoldResult {
  /** Per-feature notes to display after scaffold */
  notes: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function write(destDir: string, relPath: string, content: string): void {
  const abs = join(destDir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

/**
 * Deep-merge two package.json objects.
 * Dependencies and scripts are merged — other scalar fields from `b` win.
 */
export function mergePackageJson(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...a };

  for (const [key, value] of Object.entries(b)) {
    if (
      key === 'dependencies' ||
      key === 'devDependencies' ||
      key === 'scripts'
    ) {
      result[key] = { ...(a[key] as Record<string, string> ?? {}), ...(value as Record<string, string>) };
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ─── Main scaffold ────────────────────────────────────────────────────────────

export function scaffold(opts: ScaffoldOptions): ScaffoldResult {
  const { destDir, projectName, renderer, features } = opts;
  const notes: string[] = [];

  // ── Base files ─────────────────────────────────────────────────────────────
  let pkg = JSON.parse(packageJson({ projectName, renderer, features })) as Record<string, unknown>;

  write(destDir, 'vite.config.ts',          viteConfig());
  write(destDir, 'tsconfig.json',           tsConfig());
  write(destDir, 'index.html',              indexHtml(projectName));
  write(destDir, 'src/main.tsx',            mainTsx());
  write(destDir, 'src/App.ultimate.tsx',    appComponent({ projectName, renderer, features }));
  write(destDir, '.gitignore',              gitIgnore());

  // ── Feature files + dep merges ─────────────────────────────────────────────
  for (const featureId of features) {
    const template = FEATURE_TEMPLATES[featureId]();

    for (const file of template.files) {
      write(destDir, file.path, file.content);
    }

    const { dependencies, devDependencies, scripts } = template.deps;
    if (dependencies)    pkg = mergePackageJson(pkg, { dependencies });
    if (devDependencies) pkg = mergePackageJson(pkg, { devDependencies });
    if (scripts)         pkg = mergePackageJson(pkg, { scripts });

    if (template.note) notes.push(`[${featureId}] ${template.note}`);
  }

  // ── Write final package.json ───────────────────────────────────────────────
  write(destDir, 'package.json', JSON.stringify(pkg, null, 2));

  return { notes };
}

// ─── .gitignore ───────────────────────────────────────────────────────────────

function gitIgnore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
.ultimatejs/

# Environment
.env
.env.local
.env.*.local

# Editor
.vscode/
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store
Thumbs.db
`;
}
