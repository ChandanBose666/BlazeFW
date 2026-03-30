/**
 * blazefw add<feature>
 *
 * Adds a pillar feature to an existing UltimateJs project.
 * Run from inside the project root.
 *
 * Usage:
 *   npx blazefw add sync
 *   npx blazefw add a11y
 *   npx blazefw add snapshot inspector
 */
import { cancel, intro, log, multiselect, note, outro, spinner, isCancel } from '@clack/prompts';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { FEATURE_OPTIONS, FEATURE_TEMPLATES, type FeatureId } from './features.js';
import { mergePackageJson } from './scaffold.js';
import { install, type PackageManager } from './install.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPackageManager(): PackageManager {
  if (existsSync(join(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(process.cwd(), 'yarn.lock')))      return 'yarn';
  return 'npm';
}

function readProjectPackageJson(): Record<string, unknown> {
  const pkgPath = join(process.cwd(), 'package.json');
  if (!existsSync(pkgPath)) {
    cancel('No package.json found. Run this command from inside your UltimateJs project.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
}

function alreadyInstalled(pkg: Record<string, unknown>, featureId: FeatureId): boolean {
  const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
  const template = FEATURE_TEMPLATES[featureId]();
  const allNew = { ...template.deps.dependencies, ...template.deps.devDependencies };
  return Object.keys(allNew).every((k) => k in deps);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const subcommand = process.argv[2];

  if (subcommand !== 'add') {
    console.error(`Unknown command: ${subcommand ?? '(none)'}`);
    console.error('Usage: npx blazefw add <feature> [feature...]');
    console.error(`Features: ${FEATURE_OPTIONS.map((f) => f.value).join(', ')}`);
    process.exit(1);
  }

  intro(' blazefw add');

  // Features can be passed as CLI args or selected interactively
  const argFeatures = process.argv.slice(3).filter(
    (a) => FEATURE_OPTIONS.some((f) => f.value === a),
  ) as FeatureId[];

  let features: FeatureId[];

  if (argFeatures.length > 0) {
    features = argFeatures;
  } else {
    const selected = await multiselect<FeatureId>({
      message: 'Which pillars do you want to add?',
      options: FEATURE_OPTIONS,
      required: true,
    });
    if (isCancel(selected)) { cancel('Operation cancelled.'); process.exit(0); }
    features = selected;
  }

  const cwd = process.cwd();
  const pkgManager = detectPackageManager();
  let pkg = readProjectPackageJson();
  const notes: string[] = [];
  const added: FeatureId[] = [];
  const skipped: FeatureId[] = [];

  for (const featureId of features) {
    if (alreadyInstalled(pkg, featureId)) {
      skipped.push(featureId);
      continue;
    }

    const template = FEATURE_TEMPLATES[featureId]();
    added.push(featureId);

    // Copy feature files
    for (const file of template.files) {
      const abs = join(cwd, file.path);
      if (existsSync(abs)) {
        log.warn(`  Skipped ${file.path} (already exists)`);
        continue;
      }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, file.content, 'utf8');
      log.success(`  Created ${file.path}`);
    }

    // Merge deps
    const { dependencies, devDependencies, scripts } = template.deps;
    if (dependencies)    pkg = mergePackageJson(pkg, { dependencies });
    if (devDependencies) pkg = mergePackageJson(pkg, { devDependencies });
    if (scripts)         pkg = mergePackageJson(pkg, { scripts });

    if (template.note) notes.push(`[${featureId}] ${template.note}`);
  }

  if (skipped.length > 0) {
    log.info(`Already installed: ${skipped.join(', ')} — skipped.`);
  }

  if (added.length === 0) {
    outro('Nothing new to add.');
    return;
  }

  // Write updated package.json
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

  // Run install
  const s = spinner();
  s.start(`Installing new dependencies with ${pkgManager}…`);
  try {
    install({ destDir: cwd, pkgManager });
    s.stop('Dependencies installed.');
  } catch (err) {
    s.stop('Install failed — run it manually.');
    console.error((err as Error).message);
  }

  if (notes.length > 0) {
    note(notes.join('\n\n'), 'Notes');
  }

  outro(`Added: ${added.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
