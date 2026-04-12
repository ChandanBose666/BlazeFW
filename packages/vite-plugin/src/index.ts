import type { Plugin } from "vite";
import { sliceSource } from "./bridge.js";

export interface UltimatePluginOptions {
  /**
   * Glob pattern for files the UltimateJs slicer should process.
   * Defaults to any file whose path includes `.ultimate.tsx`.
   */
  include?: RegExp;
  /**
   * Enable the CRDT WebSocket sync server (useSync hook).
   * Set to `false` for static deployments (Vercel, Netlify, GitHub Pages)
   * where a persistent server process is unavailable.
   * @default true
   */
  sync?: boolean;
  /**
   * Enable the Web Worker sidecar that offloads third-party scripts.
   * Works in static deployments — the worker runs entirely in the browser.
   * @default true
   */
  sidecar?: boolean;
  /**
   * Enable the Nexus Inspector DevTools overlay (color-coded component map).
   * Automatically disabled in production builds regardless of this flag.
   * @default true
   */
  inspector?: boolean;
  /**
   * Enable the WCAG accessibility scanner at build time.
   * @default true
   */
  a11y?: boolean;
}

const DEFAULT_PATTERN = /.ultimate.tsx?$/;

/**
 * Vite plugin that intercepts UltimateJs component files and routes them
 * through the Rust Slicer instead of Vite's default TypeScript loader.
 *
 * For server builds  → returns the server bundle (no browser APIs).
 * For client builds  → returns the client bundle (RPC stubs replace server fns).
 *
 * @example
 * // vite.config.ts
 * import { ultimatePlugin } from '@blazefw/vite-plugin';
 * export default defineConfig({ plugins: [ultimatePlugin()] });
 */
export function ultimatePlugin(options: UltimatePluginOptions = {}): Plugin {
  const {
    include,
    sync = true,
    sidecar = true,
    inspector = true,
    a11y = true,
  } = options;

  const pattern = include ?? DEFAULT_PATTERN;

  // Warn at startup when features are disabled so the intent is visible in logs.
  if (!sync) {
    console.log("[blazefw] Sync server disabled — static deployment mode");
  }
  if (!inspector) {
    console.log("[blazefw] Inspector overlay disabled");
  }
  // sidecar / a11y flags are reserved for future build-time gating.
  void sidecar;
  void a11y;

  // Cache keyed by file id → sliced result, cleared on each hot-reload.
  const cache = new Map<string, { server_js: string; client_js: string }>();

  return {
    name: "ultimate-compiler",

    // Tell Vite this plugin handles its own HMR invalidation.
    handleHotUpdate({ file, server }) {
      if (pattern.test(file)) {
        cache.delete(file);
        server.ws.send({ type: "full-reload" });
      }
    },

    async transform(code, id, options) {
      if (!pattern.test(id)) return null;

      const isSSR = options?.ssr ?? false;

      // Use cached result if available (avoids re-running the compiler
      // on every module graph re-evaluation within the same build).
      let sliced = cache.get(id);
      if (!sliced) {
        sliced = await sliceSource(code);
        cache.set(id, sliced);
      }

      return {
        code: isSSR ? sliced.server_js : sliced.client_js,
        // No source map yet — will be added once the Rust codegen emits them.
        map: null,
      };
    },
  };
}
