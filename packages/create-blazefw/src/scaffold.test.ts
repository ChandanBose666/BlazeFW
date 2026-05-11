/**
 * Regression tests for the project scaffolder.
 *
 * These exist primarily to lock down the production-blocker fixes:
 *   - vite.config.ts must call `blazefw(...)` ONCE (not `blazefw()()`)
 *   - generated package.json must include @vitejs/plugin-react and @blazefw/compiler
 *   - feature selections must flow into the plugin options (`sync: false` etc.)
 *
 * Run with: `node --test dist` (after `tsc`). No test framework dependency —
 * uses Node's built-in `node:test` runner.
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { FeatureId } from './features.js';
import { mergePackageJson, scaffold } from './scaffold.js';

const ROOT = mkdtempSync(join(tmpdir(), 'blazefw-scaffold-'));
let counter = 0;

after(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

type Renderer = 'web' | 'native' | 'email';

function run(features: FeatureId[], renderer: Renderer = 'web') {
  const destDir = join(ROOT, `proj-${counter++}`);
  mkdirSync(destDir, { recursive: true });
  scaffold({ destDir, projectName: 'demo-app', renderer, features });
  const read = (rel: string) => readFileSync(join(destDir, rel), 'utf8');
  return {
    destDir,
    viteConfig: read('vite.config.ts'),
    pkg: JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    },
    appComponent: read('src/App.blazefw.tsx'),
    read,
  };
}

describe('scaffold — vite.config.ts', () => {
  it('never emits the double-invocation bug blazefw()()', () => {
    for (const features of [[], ['sync'], ['sync', 'sidecar', 'inspector', 'snapshot', 'a11y']] as FeatureId[][]) {
      assert.doesNotMatch(run(features).viteConfig, /blazefw\(\)\(\)/);
    }
  });

  it('imports @vitejs/plugin-react and calls react()', () => {
    const { viteConfig } = run([]);
    assert.match(viteConfig, /import react from '@vitejs\/plugin-react'/);
    assert.match(viteConfig, /react\(\),/);
  });

  it('disables sync/sidecar/inspector when no features are selected', () => {
    const { viteConfig } = run([]);
    assert.match(viteConfig, /blazefw\(\{[^}]*\}\)/);
    assert.match(viteConfig, /sync: false/);
    assert.match(viteConfig, /sidecar: false/);
    assert.match(viteConfig, /inspector: false/);
  });

  it('does not disable a pillar that was selected', () => {
    const { viteConfig } = run(['sync']);
    assert.doesNotMatch(viteConfig, /sync: false/);
    // the unselected ones are still turned off
    assert.match(viteConfig, /sidecar: false/);
    assert.match(viteConfig, /inspector: false/);
  });

  it('emits a bare blazefw() when every gated pillar is selected', () => {
    const { viteConfig } = run(['sync', 'sidecar', 'inspector']);
    assert.match(viteConfig, /blazefw\(\),/);
    assert.doesNotMatch(viteConfig, /blazefw\(\{/);
  });
});

describe('scaffold — package.json', () => {
  it('includes the build-time deps that make `vite dev` work', () => {
    const { pkg } = run([]);
    assert.ok(pkg.devDependencies['@vitejs/plugin-react'], 'missing @vitejs/plugin-react');
    assert.ok(pkg.devDependencies['@blazefw/compiler'], 'missing @blazefw/compiler');
    assert.ok(pkg.devDependencies['@blazefw/vite-plugin'], 'missing @blazefw/vite-plugin');
    assert.ok(pkg.dependencies['react'], 'missing react');
    assert.ok(pkg.dependencies['react-dom'], 'missing react-dom');
  });

  it('picks the renderer package matching the chosen renderer', () => {
    assert.ok(run([], 'web').pkg.dependencies['@blazefw/web']);
    assert.ok(run([], 'native').pkg.dependencies['@blazefw/native']);
    assert.ok(run([], 'email').pkg.dependencies['@blazefw/email']);
  });

  it('merges feature dependencies and files', () => {
    const { pkg, read } = run(['sync']);
    assert.ok(pkg.dependencies['@blazefw/core']);
    assert.ok(pkg.dependencies['@blazefw/crdt']);
    assert.ok(pkg.dependencies['@blazefw/sync-server']);
    assert.doesNotThrow(() => read('src/sync-server.ts'));
  });

  it('merges feature scripts (a11y adds audit scripts)', () => {
    const { pkg } = run(['a11y']);
    assert.ok(pkg.scripts['a11y:audit']);
    assert.ok(pkg.scripts['a11y:audit:ci']);
  });
});

describe('scaffold — generated app', () => {
  it('is branded BlazeFW (no legacy "ultimate"/"nexus" names)', () => {
    const { appComponent } = run(['sync']);
    assert.match(appComponent, /Powered by BlazeFW/);
    assert.match(appComponent, /github\.com\/ChandanBose666\/BlazeFW/);
    assert.doesNotMatch(appComponent, /ultimate/i);
    assert.doesNotMatch(appComponent, /nexus/i);
  });

  it('writes the .gitignore without any stale "ultimate"/"nexus" entry', () => {
    const { read } = run([]);
    assert.doesNotMatch(read('.gitignore'), /ultimate/i);
    assert.doesNotMatch(read('.gitignore'), /nexus/i);
  });
});

describe('mergePackageJson', () => {
  it('merges dependencies and scripts, lets scalar fields from b win', () => {
    const merged = mergePackageJson(
      { name: 'a', version: '1.0.0', dependencies: { x: '^1' }, scripts: { build: 'tsc' } },
      { name: 'b', dependencies: { y: '^2' }, scripts: { test: 'jest' } },
    );
    assert.equal(merged.name, 'b');
    assert.equal(merged.version, '1.0.0');
    assert.deepEqual(merged.dependencies, { x: '^1', y: '^2' });
    assert.deepEqual(merged.scripts, { build: 'tsc', test: 'jest' });
  });
});
