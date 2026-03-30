import {
  cancel,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FEATURE_OPTIONS, type FeatureId } from './features.js';
import { install, type PackageManager } from './install.js';
import { scaffold } from './scaffold.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function abortOnCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  return value as T;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Accept project name as positional arg (e.g. npx create-ultimatejs my-app)
  const argName = process.argv[2]?.trim();

  intro(' create-ultimatejs ');

  // ── Project name ───────────────────────────────────────────────────────────
  const projectName = argName
    ? argName
    : abortOnCancel(
        await text({
          message: 'What is your project named?',
          placeholder: 'my-app',
          validate(value) {
            if (!value.trim()) return 'Project name is required.';
            if (!/^[a-z0-9-_]+$/.test(value))
              return 'Use only lowercase letters, numbers, hyphens, and underscores.';
          },
        }),
      );

  const destDir = resolve(process.cwd(), projectName);

  if (existsSync(destDir)) {
    cancel(`Directory "${projectName}" already exists. Choose a different name.`);
    process.exit(1);
  }

  // ── Renderer ───────────────────────────────────────────────────────────────
  const renderer = abortOnCancel(
    await select<'web' | 'native' | 'email'>({
      message: 'Which renderer do you need?',
      options: [
        { value: 'web',    label: 'Web (React)',            hint: 'Renders to HTML with inline styles — for browsers' },
        { value: 'native', label: 'Native (React Native)',  hint: 'Renders to RN View/Text/Pressable — for iOS & Android' },
        { value: 'email',  label: 'Email (HTML strings)',   hint: 'Renders MSO-safe HTML strings — for transactional email' },
      ],
    }),
  );

  // ── Feature pillars ────────────────────────────────────────────────────────
  const features = abortOnCancel(
    await multiselect<FeatureId>({
      message: 'Which pillars do you want to include?  (space to select, enter to confirm)',
      options: FEATURE_OPTIONS,
      required: false,
    }),
  );

  // ── Package manager ────────────────────────────────────────────────────────
  const pkgManager = abortOnCancel(
    await select<PackageManager>({
      message: 'Package manager',
      options: [
        { value: 'pnpm', label: 'pnpm', hint: 'recommended' },
        { value: 'npm',  label: 'npm' },
        { value: 'yarn', label: 'yarn' },
      ],
    }),
  );

  // ── Scaffold ───────────────────────────────────────────────────────────────
  mkdirSync(destDir, { recursive: true });

  const s = spinner();

  s.start('Scaffolding project files…');
  const { notes } = scaffold({ destDir, projectName, renderer, features });
  s.stop('Project files created.');

  // ── Install ────────────────────────────────────────────────────────────────
  s.start(`Installing dependencies with ${pkgManager}…`);
  try {
    install({ destDir, pkgManager });
    s.stop('Dependencies installed.');
  } catch (err) {
    s.stop('Dependency install failed — run it manually.');
    console.error((err as Error).message);
  }

  // ── Post-scaffold notes ────────────────────────────────────────────────────
  const nextSteps = [
    `cd ${projectName}`,
    `${pkgManager} run dev`,
    '',
    '# Optional: faster builds with the Rust compiler',
    '# Install Rust at https://rustup.rs, then:',
    '#   cargo build --release -p ultimate-compiler',
    ...(notes.length > 0 ? ['', '# Feature notes:', ...notes.map((n) => `# ${n}`)] : []),
    ...(features.includes('sync')
      ? ['', '# Start the sync server in a separate terminal:', `  node ${projectName}/src/sync-server.js`]
      : []),
  ].join('\n');

  note(nextSteps, 'Next steps');

  outro(`You're all set! Happy building with UltimateJs. 🚀`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
