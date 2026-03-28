import { defineConfig } from "vite";
import { nexusPlugin } from "@nexus/vite-plugin";

export default defineConfig({
  plugins: [
    // Intercepts *.nexus.tsx / *.nexus.ts files and routes them through
    // the Rust Slicer. Server builds receive module.server.js output;
    // client builds receive module.client.js output with RPC stubs.
    nexusPlugin(),
  ],
  build: {
    outDir: "dist",
    target: "esnext",
  },
});
