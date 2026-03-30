// ─── Feature registry ─────────────────────────────────────────────────────────

export type FeatureId = 'sync' | 'sidecar' | 'inspector' | 'snapshot' | 'a11y';

export interface FeatureFile {
  /** Relative path inside the new project (e.g. "src/sync-server.ts") */
  path: string;
  content: string;
}

export interface FeatureDeps {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  /** Lines to append to the "scripts" block */
  scripts?: Record<string, string>;
}

export interface FeatureTemplate {
  files: FeatureFile[];
  deps: FeatureDeps;
  /** Printed after scaffold completes */
  note: string;
}

// ─── sync ─────────────────────────────────────────────────────────────────────

function syncTemplate(): FeatureTemplate {
  return {
    deps: {
      dependencies: {
        '@blazefw/core': '^0.1.0',
        '@blazefw/crdt': '^0.1.0',
        '@blazefw/sync-server': '^0.1.0',
      },
    },
    note: 'Start the sync server in a separate terminal:\n  node src/sync-server.js',
    files: [
      {
        path: 'src/sync-server.ts',
        content: `import { createSyncServer } from '@blazefw/sync-server';

const server = await createSyncServer({ port: 4000 });
await server.ready;

console.log('[sync-server] Listening on ws://localhost:4000/sync');
console.log('[sync-server] Connect with: useSync("collection", "doc-id")');

// Graceful shutdown
process.on('SIGTERM', () => server.close());
process.on('SIGINT',  () => server.close());
`,
      },
    ],
  };
}

// ─── sidecar ──────────────────────────────────────────────────────────────────

function sidecarTemplate(): FeatureTemplate {
  return {
    deps: {
      dependencies: {
        '@blazefw/sidecar': '^0.1.0',
      },
    },
    note: 'Change <script src="..."> to <script type="text/blazefw" src="..."> for any 3rd-party script you want offloaded.',
    files: [
      {
        path: 'src/sidecar-init.ts',
        content: `import { initSidecar } from '@blazefw/sidecar';

/**
 * Call this once in your app entry point (main.tsx) to activate the
 * Web Worker sidecar. Any <script type="text/blazefw"> tags on the
 * page will be picked up and offloaded to the worker automatically.
 *
 * Example in index.html:
 *   <script type="text/blazefw" src="https://www.googletagmanager.com/gtag.js"></script>
 */
export function startSidecar() {
  return initSidecar({ workerUrl: '/sidecar.worker.js' });
}
`,
      },
    ],
  };
}

// ─── inspector ────────────────────────────────────────────────────────────────

function inspectorTemplate(): FeatureTemplate {
  return {
    deps: {
      devDependencies: {
        '@blazefw/inspector': '^0.1.0',
      },
    },
    note: 'Press Alt+I in the browser to toggle the Nexus Inspector overlay.',
    files: [
      {
        path: 'src/inspector-init.ts',
        content: `import { initInspector } from '@blazefw/inspector';

/**
 * Dev-only inspector overlay. Call from main.tsx inside an
 * import.meta.env.DEV guard so it is stripped from production builds.
 *
 * Components annotated with data-ultimate-kind="server|client|boundary|mixed"
 * will be colour-coded directly on the page.
 */
export function startInspector() {
  const inspector = initInspector();

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'i') inspector.toggle();
  });

  // Clean up on Vite HMR dispose
  if (import.meta.hot) {
    import.meta.hot.dispose(() => inspector.destroy());
  }

  return inspector;
}
`,
      },
    ],
  };
}

// ─── snapshot ─────────────────────────────────────────────────────────────────

function snapshotTemplate(): FeatureTemplate {
  return {
    deps: {
      dependencies: {
        '@blazefw/snapshot': '^0.1.0',
      },
    },
    note: 'Wrap any stateful component with <SnapshotBoundary> to get automatic time-travel error recovery.',
    files: [
      {
        path: 'src/components/SnapshotWrapper.tsx',
        content: `import { type ReactNode } from 'react';
import { SnapshotBoundary, useSnapshot } from '@blazefw/snapshot';

interface Props<T> {
  initial: T;
  capacity?: number;
  children: (value: T, setValue: (v: T) => void) => ReactNode;
  onRestore?: (data: T) => void;
}

/**
 * Convenience wrapper — combines useSnapshot + SnapshotBoundary.
 * Wrap any component that holds complex state to get automatic
 * time-travel recovery when a render error occurs.
 *
 * Usage:
 *   <SnapshotWrapper initial={myDoc} capacity={5}>
 *     {(doc, setDoc) => <MyEditor value={doc} onChange={setDoc} />}
 *   </SnapshotWrapper>
 */
export function SnapshotWrapper<T>({ initial, capacity = 10, children, onRestore }: Props<T>) {
  const { value, setValue, boundaryProps } = useSnapshot(initial, { capacity });

  return (
    <SnapshotBoundary
      {...boundaryProps}
      onRestore={(data, meta) => {
        onRestore?.(data);
        console.warn(\`[SnapshotBoundary] Restored snapshot. \${meta.remaining} remaining.\`, meta.error);
      }}
    >
      {children(value, setValue)}
    </SnapshotBoundary>
  );
}
`,
      },
    ],
  };
}

// ─── a11y ─────────────────────────────────────────────────────────────────────

function a11yTemplate(): FeatureTemplate {
  return {
    deps: {
      dependencies: {
        '@blazefw/a11y': '^0.1.0',
      },
      scripts: {
        'a11y:audit': 'nexus-a11y dist/index.html',
        'a11y:audit:ci': 'nexus-a11y dist/index.html --exit-zero',
      },
    },
    note: [
      'Accessibility utilities are ready in @blazefw/a11y.',
      'Audit your built HTML with: pnpm a11y:audit',
      'Add to CI with: pnpm a11y:audit:ci (never blocks the build)',
    ].join('\n  '),
    files: [
      {
        path: 'src/a11y-setup.tsx',
        content: `/**
 * Accessibility setup — import this in your root layout component.
 *
 * Exports:
 *   <A11yLayout>   — wraps children with SkipNav + announces route changes
 *   useFocusTrap   — re-exported for convenience
 *   useAnnouncer   — re-exported for convenience
 */
export {
  useFocusTrap,
  useAnnouncer,
  useReducedMotion,
  VisuallyHidden,
} from '@blazefw/a11y';

export { SkipNavLink, SkipNavContent } from '@blazefw/a11y';

import { type ReactNode } from 'react';
import { SkipNavLink, SkipNavContent } from '@blazefw/a11y';

/**
 * Wrap your root layout with <A11yLayout> to get:
 *  - Skip-to-content link for keyboard users
 *  - A stable aria-live region for announcements (via useAnnouncer)
 *
 * Usage:
 *   <A11yLayout>
 *     <Header />
 *     <main>{children}</main>
 *   </A11yLayout>
 */
export function A11yLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipNavLink />
      <SkipNavContent>{children}</SkipNavContent>
    </>
  );
}
`,
      },
    ],
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FEATURE_TEMPLATES: Record<FeatureId, () => FeatureTemplate> = {
  sync: syncTemplate,
  sidecar: sidecarTemplate,
  inspector: inspectorTemplate,
  snapshot: snapshotTemplate,
  a11y: a11yTemplate,
};

export const FEATURE_OPTIONS = [
  {
    value: 'sync' as const,
    label: 'Zero-Fetch Sync',
    hint: '@blazefw/core + CRDT + WebSocket sync server',
  },
  {
    value: 'sidecar' as const,
    label: 'Sidecar Worker',
    hint: '@blazefw/sidecar — offloads 3rd-party scripts to a Web Worker',
  },
  {
    value: 'inspector' as const,
    label: 'Nexus Inspector',
    hint: '@blazefw/inspector — dev overlay (Alt+I to toggle)',
  },
  {
    value: 'snapshot' as const,
    label: 'Snapshot Boundary',
    hint: '@blazefw/snapshot — auto time-travel error recovery',
  },
  {
    value: 'a11y' as const,
    label: 'Accessibility Layer',
    hint: '@blazefw/a11y + nexus-a11y compliance CLI',
  },
];
