import type { FeatureId } from '../features.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BaseTemplateOptions {
  projectName: string;
  renderer: 'web' | 'native' | 'email';
  features: FeatureId[];
}

// ─── Renderer package map ─────────────────────────────────────────────────────

const RENDERER_PKG: Record<string, string> = {
  web: '@blazefw/web',
  native: '@blazefw/native',
  email: '@blazefw/email',
};

// ─── package.json ─────────────────────────────────────────────────────────────

export function packageJson(opts: BaseTemplateOptions): string {
  const { projectName, renderer } = opts;
  const rendererPkg = RENDERER_PKG[renderer];

  return JSON.stringify(
    {
      name: projectName,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        '@blazefw/primitives': '^0.1.0',
        [rendererPkg]: '^0.1.0',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@blazefw/vite-plugin': '^0.1.0',
        '@types/react': '^18',
        '@types/react-dom': '^18',
        typescript: '^5.4.0',
        vite: '^5.0.0',
      },
    },
    null,
    2,
  );
}

// ─── vite.config.ts ───────────────────────────────────────────────────────────

export function viteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ultimatePlugin } from '@blazefw/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    ultimatePlugin()(),
  ],
});
`;
}

// ─── tsconfig.json ────────────────────────────────────────────────────────────

export function tsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
    },
    null,
    2,
  );
}

// ─── index.html ───────────────────────────────────────────────────────────────

export function indexHtml(projectName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; }
      :root {
        --nexus-background: #0f0f0f;
        --nexus-surface: #1a1a1a;
        --nexus-border: #2a2a2a;
        --nexus-primary: #6366f1;
        --nexus-primary-fg: #ffffff;
        --nexus-secondary: #374151;
        --nexus-secondary-fg: #d1d5db;
        --nexus-success: #22c55e;
        --nexus-warning: #f59e0b;
        --nexus-danger: #ef4444;
        --nexus-muted: #374151;
        --nexus-muted-fg: #9ca3af;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

// ─── src/main.tsx ─────────────────────────────────────────────────────────────

export function mainTsx(): string {
  return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.ultimate.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
}

// ─── src/App.ultimate.tsx — Dashboard ─────────────────────────────────────────

const FEATURE_CARDS: Record<FeatureId, { emoji: string; label: string; desc: string }> = {
  sync: {
    emoji: '⚡',
    label: 'Zero-Fetch Sync',
    desc: 'State syncs over CRDT-powered WebSocket. No fetch() calls needed.',
  },
  sidecar: {
    emoji: '🔀',
    label: 'Sidecar Worker',
    desc: '3rd-party scripts run in a Web Worker — main thread stays fast.',
  },
  inspector: {
    emoji: '🔍',
    label: 'Nexus Inspector',
    desc: 'Alt+I shows a colour-coded overlay of server/client/boundary components.',
  },
  snapshot: {
    emoji: '⏪',
    label: 'Snapshot Boundary',
    desc: 'Render errors auto-rewind to the last good state via ring buffer.',
  },
  a11y: {
    emoji: '♿',
    label: 'Accessibility Layer',
    desc: 'Runtime a11y hooks + nexus-a11y CLI audits WCAG 2.1 AA compliance.',
  },
};

export function appComponent(opts: BaseTemplateOptions): string {
  const { projectName, features } = opts;

  const featureCardJsx = features.length === 0
    ? ''
    : `
      {/* ── Active pillars ───────────────────────────────────────────── */}
      <Stack direction="column" gap={3}>
        <Text variant="label" color="muted">Active pillars</Text>
        <Stack direction="row" gap={4} wrap>
${features.map((f) => {
  const card = FEATURE_CARDS[f];
  return `          <Stack direction="column" gap={2} padding={4} background="surface" radius="md" flex={1}>
            <Text variant="title">${card.emoji}</Text>
            <Text variant="label">${card.label}</Text>
            <Text variant="caption" color="muted">${card.desc}</Text>
          </Stack>`;
}).join('\n')}
        </Stack>
      </Stack>
`;

  const syncNote = features.includes('sync')
    ? `\n      {/* ── Sync status ───────────────────────────────────────────────── */}
      <Stack direction="row" gap={3} padding={4} background="surface" radius="md" align="center">
        <Text variant="body">{synced ? '🟢' : '⚪'}</Text>
        <Stack direction="column" gap={1}>
          <Text variant="label">Zero-Fetch Sync</Text>
          <Text variant="caption" color="muted">
            {synced ? \`doc.title = "\${doc.title ?? 'untitled'}"\` : 'Start the sync server: node src/sync-server.js'}
          </Text>
        </Stack>
      </Stack>\n`
    : '';

  const syncImport = features.includes('sync')
    ? `import { useSync } from '@blazefw/core';\n`
    : '';

  const syncHook = features.includes('sync')
    ? `\n  const [doc, updateDoc] = useSync('demo', 'welcome-doc');\n  const synced = doc.title !== undefined;\n`
    : '';

  return `import { useState } from 'react';
${syncImport}import { Stack, Text, Action } from '@blazefw/web';

export function App() {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);${syncHook}
  return (
    <Stack direction="column" gap={6} padding={8} background="background" style={{ minHeight: '100vh' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <Stack direction="column" gap={2}>
        <Text variant="display" color="primary">${projectName}</Text>
        <Text variant="body" color="muted">
          Powered by UltimateJs — write once, render everywhere.
        </Text>
      </Stack>

      {/* ── Counter demo ─────────────────────────────────────────────── */}
      <Stack direction="column" gap={3} padding={6} background="surface" radius="md">
        <Text variant="label" color="muted">Counter — using semantic primitives</Text>
        <Stack direction="row" gap={4} align="center">
          <Action variant="secondary" onPress={() => setCount((c) => c - step)}>− {step}</Action>
          <Text variant="display">{count}</Text>
          <Action variant="primary" onPress={() => setCount((c) => c + step)}>+ {step}</Action>
          <Action variant="ghost" onPress={() => setCount(0)}>Reset</Action>
        </Stack>
        <Stack direction="row" gap={2} align="center">
          <Text variant="caption" color="muted">Step:</Text>
          {[1, 5, 10].map((s) => (
            <Action
              key={s}
              variant={step === s ? 'primary' : 'ghost'}
              size="xs"
              onPress={() => setStep(s)}
            >
              {s}
            </Action>
          ))}
        </Stack>
      </Stack>
${syncNote}${featureCardJsx}
      {/* ── Next steps ───────────────────────────────────────────────── */}
      <Stack direction="column" gap={3} padding={4} background="surface" radius="md">
        <Text variant="label">Next steps</Text>
        <Stack direction="column" gap={2}>
          <Text variant="body" color="muted">
            Edit <Text variant="code">src/App.ultimate.tsx</Text> — the compiler auto-splits
            server and client bundles, no annotations needed.
          </Text>
          <Text variant="body" color="muted">
            Add more UI with <Text variant="code">Stack</Text>, <Text variant="code">Text</Text>,{' '}
            <Text variant="code">Action</Text>, and <Text variant="code">Input</Text> from{' '}
            <Text variant="code">@blazefw/web</Text>.
          </Text>
          <Action
            variant="link"
            href="https://github.com/ChandanBose666/UltimateJs"
            external
          >
            Read the docs →
          </Action>
        </Stack>
      </Stack>

    </Stack>
  );
}
`;
}
