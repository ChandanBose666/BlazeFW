import type { Plugin } from "vite";
import { sliceSource } from "./bridge.js";

export interface NexusPluginOptions {
  /**
   * Glob pattern for files the Nexus slicer should process.
   * Defaults to any file whose path includes `.nexus.ts` or `.nexus.tsx`.
   */
  include?: RegExp;
}

const DEFAULT_PATTERN = /\.nexus\.tsx?$/;

/**
 * Vite plugin that intercepts Nexus component files and routes them
 * through the Rust Slicer instead of Vite's default TypeScript loader.
 *
 * For server builds  → returns the server bundle (no browser APIs).
 * For client builds  → returns the client bundle (RPC stubs replace server fns).
 *
 * @example
 * // vite.config.ts
 * import { nexusPlugin } from '@nexus/vite-plugin';
 * export default defineConfig({ plugins: [nexusPlugin()] });
 */
export function nexusPlugin(options: NexusPluginOptions = {}): Plugin {
  const pattern = options.include ?? DEFAULT_PATTERN;
  // Cache keyed by file id → sliced result, cleared on each hot-reload.
  const cache = new Map<string, { server_js: string; client_js: string }>();

  return {
    name: "nexus-compiler",

    // Tell Vite this plugin handles its own HMR invalidation.
    handleHotUpdate({ file, server }) {
      if (pattern.test(file)) {
        cache.delete(file);
        server.ws.send({ type: "full-reload" });
      }
    },

    transform(code, id, options) {
      if (!pattern.test(id)) return null;

      const isSSR = options?.ssr ?? false;

      // Use cached result if available (avoids re-running the Rust binary
      // on every module graph re-evaluation within the same build).
      let sliced = cache.get(id);
      if (!sliced) {
        sliced = sliceSource(code);
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
