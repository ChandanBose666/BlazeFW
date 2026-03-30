import { defineConfig } from "vite";
import { ultimatePlugin } from "@blazefw/vite-plugin";

export default defineConfig({
  plugins: [
    // Intercepts *.ultimate.tsx / *.ultimate.tsx files and routes them through
    // the Rust Slicer. Server builds receive module.server.js output;
    // client builds receive module.client.js output with RPC stubs.
    ultimatePlugin(),
  ],
  build: {
    outDir: "dist",
    target: "esnext",
  },
});
