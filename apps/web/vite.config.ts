import { defineConfig } from "vite";
import { ultimatePlugin } from "@blazefw/vite-plugin";

export default defineConfig({
  plugins: [
    ultimatePlugin({
      sync: false,      // no persistent WebSocket server on Vercel
      sidecar: true,    // Web Worker sidecar works in static deployments
      inspector: false, // DevTools overlay not needed in production
      a11y: true,       // WCAG scanner always on
    }),
  ],
  build: {
    outDir: "dist",
    target: "esnext",
  },
});
